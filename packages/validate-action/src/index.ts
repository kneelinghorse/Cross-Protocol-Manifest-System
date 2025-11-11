import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import path from 'path';
import { promises as fs } from 'fs';
import { createDataProtocol } from '@proto/data';

type Octokit = ReturnType<typeof github.getOctokit>;

type IssueLevel = 'error' | 'warn' | 'info';

interface Inputs {
  manifestGlobs: string[];
  failOnBreaking: boolean;
  failOnWarnings: boolean;
  commentOnPr: boolean;
  commentSentinel: string;
  compareBranch?: string;
  outputFormat: 'github-annotations' | 'json';
  protoCliVersion: string;
  githubToken: string;
}

interface Issue {
  level: IssueLevel;
  message: string;
  path?: string;
  validator?: string;
}

interface BreakingChange {
  path: string;
  reason?: string;
  from?: unknown;
  to?: unknown;
}

interface ManifestResult {
  path: string;
  absolutePath: string;
  errors: Issue[];
  warnings: Issue[];
  piiWarnings: Issue[];
  breakingChanges: BreakingChange[];
  parseError?: string;
}

interface ValidationSummary {
  validatedCount: number;
  passedCount: number;
  failedCount: number;
  warningsCount: number;
  breakingChangesCount: number;
}

const SENTINEL_FALLBACK = '<!-- proto-validate-action -->';
const MAX_LIST_ITEMS = 20;

async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
    const octokit = github.getOctokit(inputs.githubToken);
    const manifestPaths = await discoverManifestPaths(inputs.manifestGlobs, workspace);

    if (manifestPaths.length === 0) {
      core.setOutput('validated-count', '0');
      core.setOutput('passed-count', '0');
      core.setOutput('failed-count', '0');
      core.setOutput('breaking-changes-count', '0');
      core.setOutput('validation-report-json', JSON.stringify({ manifests: [], summary: {} }));
      throw new Error(
        `No manifest files matched the provided patterns: ${inputs.manifestGlobs.join(', ')}`
      );
    }

    const baseRef =
      inputs.compareBranch ||
      github.context.payload.pull_request?.base?.sha ||
      github.context.payload.pull_request?.base?.ref;

    if (baseRef) {
      core.info(`Breaking-change detection enabled (base ref: ${baseRef}).`);
    } else {
      core.info('Breaking-change detection skipped (no base branch/sha resolved).');
    }

    const { owner, repo } = github.context.repo;
    const isPullRequest = Boolean(github.context.payload.pull_request);

    const results: ManifestResult[] = [];

    for (const absolutePath of manifestPaths) {
      const relativePath = toRelativePath(absolutePath, workspace);
      const result = await evaluateManifest({
        absolutePath,
        relativePath,
        baseRef,
        octokit,
        owner,
        repo
      });
      results.push(result);
    }

    const summary = summarize(results);
    await writeJobSummary(results, summary);

    const runUrl = `${github.context.serverUrl}/${owner}/${repo}/actions/runs/${github.context.runId}`;
    if (inputs.commentOnPr && isPullRequest) {
      await upsertPrComment({
        octokit,
        owner,
        repo,
        sentinel: inputs.commentSentinel,
        runUrl,
        summary,
        results
      });
    }

    const sanitizedResults = results.map(({ absolutePath, ...rest }) => rest);
    const reportPayload = {
      summary,
      manifests: sanitizedResults
    };

    core.setOutput('validated-count', summary.validatedCount.toString());
    core.setOutput('passed-count', summary.passedCount.toString());
    core.setOutput('failed-count', summary.failedCount.toString());
    core.setOutput('breaking-changes-count', summary.breakingChangesCount.toString());
    core.setOutput('validation-report-json', JSON.stringify(reportPayload));

    const shouldFail =
      summary.failedCount > 0 ||
      (inputs.failOnBreaking && summary.breakingChangesCount > 0) ||
      (inputs.failOnWarnings && summary.warningsCount > 0);

    if (shouldFail) {
      const reasons: string[] = [];
      if (summary.failedCount > 0) reasons.push(`${summary.failedCount} manifest(s) failed validation`);
      if (inputs.failOnBreaking && summary.breakingChangesCount > 0) {
        reasons.push(`${summary.breakingChangesCount} breaking change(s) detected`);
      }
      if (inputs.failOnWarnings && summary.warningsCount > 0) {
        reasons.push(`${summary.warningsCount} warning(s) reported`);
      }
      throw new Error(reasons.join('; '));
    }

    core.info('All manifests validated successfully.');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred while running proto-validate-action.');
    }
  }
}

function getInputs(): Inputs {
  const manifestRaw = core.getInput('manifest-glob', { required: true });
  const manifestGlobs = manifestRaw
    .split(/\r?\n/)
    .flatMap((line) => line.split(','))
    .map((token) => token.trim())
    .filter(Boolean);

  if (!manifestGlobs.length) {
    throw new Error('At least one manifest glob is required.');
  }

  return {
    manifestGlobs,
    failOnBreaking: getBooleanInput('fail-on-breaking', true),
    failOnWarnings: getBooleanInput('fail-on-warnings', false),
    commentOnPr: getBooleanInput('comment-on-pr', true),
    commentSentinel: core.getInput('comment-on-pr-sentinel') || SENTINEL_FALLBACK,
    compareBranch: core.getInput('compare-branch') || undefined,
    outputFormat: (core.getInput('output-format') || 'github-annotations') as
      | 'github-annotations'
      | 'json',
    protoCliVersion: core.getInput('proto-cli-version') || 'latest',
    githubToken: core.getInput('github-token', { required: true })
  };
}

async function discoverManifestPaths(patterns: string[], workspace: string): Promise<string[]> {
  const seen = new Set<string>();
  for (const pattern of patterns) {
    const globber = await glob.create(pattern, {
      matchDirectories: false,
      followSymbolicLinks: true,
      implicitDescendants: true
    });
    for await (const file of globber.globGenerator()) {
      const absolute = path.isAbsolute(file) ? file : path.join(workspace, file);
      seen.add(path.normalize(absolute));
    }
  }
  return Array.from(seen).sort();
}

async function evaluateManifest(options: {
  absolutePath: string;
  relativePath: string;
  baseRef?: string;
  octokit: Octokit;
  owner: string;
  repo: string;
}): Promise<ManifestResult> {
  const { absolutePath, relativePath, baseRef, octokit, owner, repo } = options;
  const result: ManifestResult = {
    path: relativePath,
    absolutePath,
    errors: [],
    warnings: [],
    piiWarnings: [],
    breakingChanges: []
  };

  let fileContent: string;
  try {
    fileContent = await fs.readFile(absolutePath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown read error';
    result.parseError = `Failed to read manifest: ${message}`;
    result.errors.push({ level: 'error', message: result.parseError });
    return result;
  }

  let parsedManifest: Record<string, any>;
  try {
    parsedManifest = JSON.parse(fileContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    result.parseError = `Invalid JSON: ${message}`;
    result.errors.push({ level: 'error', message: result.parseError });
    return result;
  }

  const protocol = createDataProtocol(parsedManifest);
  const validation = protocol.validate();
  const { errors, warnings } = collectIssues(validation);
  result.errors.push(...errors);
  result.warnings.push(...warnings);

  result.piiWarnings.push(...detectPiiWarnings(parsedManifest, relativePath));

  if (baseRef) {
    const baseContent = await fetchBaseContent({
      octokit,
      owner,
      repo,
      relativePath,
      ref: baseRef
    });
    if (baseContent) {
      try {
        const baseManifest = JSON.parse(baseContent);
        const baseProtocol = createDataProtocol(baseManifest);
        const diffResult = baseProtocol.diff(parsedManifest) as {
          breaking?: Array<{ path: string; reason?: string; from?: unknown; to?: unknown }>;
        };
        const breaking = diffResult.breaking ?? [];
        result.breakingChanges = breaking.map((change) => ({
          path: change.path,
          reason: change.reason,
          from: sanitizeValue(change.from),
          to: sanitizeValue(change.to)
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown diff error';
        result.warnings.push({
          level: 'warn',
          message: `Unable to diff against base for ${relativePath}: ${message}`
        });
      }
    }
  }

  return result;
}

function collectIssues(validationResult: {
  ok: boolean;
  results?: Array<{ name?: string; ok?: boolean; issues?: Array<Record<string, any>> }>;
}): { errors: Issue[]; warnings: Issue[] } {
  const issues = validationResult.results ?? [];
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  for (const validator of issues) {
    const validatorName = validator.name;
    for (const issue of validator.issues ?? []) {
      const normalized: Issue = {
        level: (issue.level as IssueLevel) || (validator.ok ? 'warn' : 'error'),
        message: issue.msg || 'Validation issue detected',
        path: issue.path,
        validator: validatorName
      };
      if (normalized.level === 'warn') {
        warnings.push(normalized);
      } else {
        errors.push({ ...normalized, level: 'error' });
      }
    }
  }

  return { errors, warnings };
}

function detectPiiWarnings(manifest: Record<string, any>, relativePath: string): Issue[] {
  const fields = manifest?.schema?.fields || {};
  const hasPii = Object.values(fields).some((field: any) => field?.pii === true);
  if (!hasPii) return [];

  const consumers: Array<{ type?: string; id?: string }> = manifest?.lineage?.consumers || [];
  const warnings: Issue[] = [];
  for (const consumer of consumers) {
    const consumerType = (consumer.type || '').toLowerCase();
    const consumerId = (consumer.id || '').toLowerCase();
    if (
      consumerType === 'external' ||
      consumerId.includes('external') ||
      consumerId.includes('vendor')
    ) {
      warnings.push({
        level: 'warn',
        path: `${relativePath}:lineage.consumers`,
        message: `PII dataset consumed by external target (${consumer.id || 'unknown'})`
      });
    }
  }
  return warnings;
}

async function fetchBaseContent(options: {
  octokit: Octokit;
  owner: string;
  repo: string;
  relativePath: string;
  ref: string;
}): Promise<string | null> {
  const { octokit, owner, repo, relativePath, ref } = options;
  const posixPath = relativePath.split(path.sep).join('/');
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: posixPath,
      ref
    });
    if (Array.isArray(response.data)) {
      return null;
    }
    if (!('content' in response.data) || !response.data.content) {
      return null;
    }
    const encoding = (response.data.encoding || 'base64') as BufferEncoding;
    return Buffer.from(response.data.content, encoding).toString('utf8');
  } catch (error) {
    if (typeof error === 'object' && error && 'status' in error && error.status === 404) {
      return null;
    }
    const message = error instanceof Error ? error.message : 'Unknown GitHub API error';
    throw new Error(`Failed to fetch base manifest for ${relativePath}: ${message}`);
  }
}

function summarize(results: ManifestResult[]): ValidationSummary {
  const validatedCount = results.length;
  const failedCount = results.filter((result) => result.errors.length > 0 || result.parseError).length;
  const warningsCount = results.reduce(
    (total, result) => total + result.warnings.length + result.piiWarnings.length,
    0
  );
  const breakingChangesCount = results.reduce(
    (total, result) => total + result.breakingChanges.length,
    0
  );
  return {
    validatedCount,
    passedCount: validatedCount - failedCount,
    failedCount,
    warningsCount,
    breakingChangesCount
  };
}

async function writeJobSummary(results: ManifestResult[], summary: ValidationSummary): Promise<void> {
  const summaryTable = [
    [{ data: 'Metric', header: true }, { data: 'Value', header: true }],
    ['Validated', summary.validatedCount.toString()],
    ['Passed', summary.passedCount.toString()],
    ['Failed', summary.failedCount.toString()],
    ['Warnings', summary.warningsCount.toString()],
    ['Breaking Changes', summary.breakingChangesCount.toString()]
  ];

  const highlights = collectHighlights(results);

  core.summary.addHeading('Proto Manifest Validation', 2).addTable(summaryTable);

  if (highlights.length) {
    core.summary
      .addHeading('Key Findings', 3)
      .addList(highlights.slice(0, MAX_LIST_ITEMS));
    if (highlights.length > MAX_LIST_ITEMS) {
      core.summary.addQuote(
        `...${highlights.length - MAX_LIST_ITEMS} additional findings truncated for brevity.`
      );
    }
  } else {
    core.summary.addRaw('No validation errors or warnings reported.\n');
  }

  await core.summary.write();
}

function collectHighlights(results: ManifestResult[]): string[] {
  const findings: string[] = [];
  for (const result of results) {
    const prefix = result.path;
    for (const error of result.errors) {
      findings.push(`❌ ${prefix}: ${error.message}${error.path ? ` (${error.path})` : ''}`);
    }
    for (const warning of [...result.warnings, ...result.piiWarnings]) {
      findings.push(`⚠️ ${prefix}: ${warning.message}`);
    }
    for (const breaking of result.breakingChanges) {
      findings.push(
        `💥 ${prefix}: ${breaking.reason || 'breaking change'} @ ${breaking.path}`
      );
    }
  }
  return findings;
}

async function upsertPrComment(options: {
  octokit: Octokit;
  owner: string;
  repo: string;
  sentinel: string;
  runUrl: string;
  summary: ValidationSummary;
  results: ManifestResult[];
}): Promise<void> {
  const { octokit, owner, repo, sentinel, runUrl, summary, results } = options;
  const pullRequestNumber = github.context.payload.pull_request?.number;
  if (!pullRequestNumber) return;

  const body = buildCommentBody(summary, results, runUrl, sentinel);

  try {
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: pullRequestNumber,
      per_page: 100
    });
    const existing = comments.find((comment) => comment.body?.includes(sentinel));
    if (existing) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body
      });
      core.info('Updated existing PR comment with validation summary.');
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullRequestNumber,
        body
      });
      core.info('Created PR comment with validation summary.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown GitHub API error';
    core.warning(`Unable to post PR comment: ${message}`);
  }
}

function buildCommentBody(
  summary: ValidationSummary,
  results: ManifestResult[],
  runUrl: string,
  sentinel: string
): string {
  const statusEmoji =
    summary.failedCount === 0 && summary.breakingChangesCount === 0 ? '✅' : '❌';
  const headline = `${statusEmoji} Proto Manifest Validation`;

  const rows = [
    ['Validated', summary.validatedCount],
    ['Passed', summary.passedCount],
    ['Failed', summary.failedCount],
    ['Warnings', summary.warningsCount],
    ['Breaking Changes', summary.breakingChangesCount]
  ];

  const statsTable = rows.map(([label, value]) => `| ${label} | ${value} |`).join('\n');
  const issues = collectHighlights(results);
  const findings = issues.length
    ? issues.slice(0, 10).map((entry) => `- ${entry}`).join('\n')
    : '- No issues reported';
  const truncated =
    issues.length > 10 ? `\n- ...${issues.length - 10} additional finding(s)` : '';

  const body = `${headline}

| Metric | Value |
| --- | --- |
${statsTable}

<details>
<summary>Findings</summary>

${findings}${truncated}

</details>

[View workflow run](${runUrl})

${sentinel}`;

  return body;
}

function getBooleanInput(name: string, defaultValue: boolean): boolean {
  const raw = core.getInput(name);
  if (!raw) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function toRelativePath(filePath: string, workspace: string): string {
  const relative = path.relative(workspace, filePath);
  if (!relative || relative.startsWith('..')) {
    return path.basename(filePath);
  }
  return relative.split(path.sep).join('/');
}

function sanitizeValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5);
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 5);
    return Object.fromEntries(entries);
  }
  return value;
}

export { detectPiiWarnings, collectIssues, summarize, buildCommentBody };
export type { Issue, ManifestResult, ValidationSummary };

if (typeof require !== 'undefined' && require.main === module) {
  void run();
}
