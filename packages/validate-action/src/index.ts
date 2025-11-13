import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import * as tc from '@actions/tool-cache';
import path from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { execFile, ExecFileException } from 'child_process';
import { promisify } from 'util';
import { createDataProtocol } from '@cpms/data';

type Octokit = ReturnType<typeof github.getOctokit>;

type IssueLevel = 'error' | 'warn' | 'info';

interface Inputs {
  manifestGlobs: string[];
  failOnBreaking: boolean;
  failOnWarnings: boolean;
  commentOnPr: boolean;
  commentSentinel: string;
  compareBranch?: string;
  outputFormat: OutputFormat;
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
const REPORT_FILE_NAME = 'proto-validation-report.json';
const execFileAsync = promisify(execFile);
const ACTION_ROOT = path.resolve(__dirname, '..');
const BUNDLED_CLI_DIR = path.join(ACTION_ROOT, 'bundled');
const BUNDLED_ARCHIVE_CANDIDATES: Array<{ file: string; type: 'tar' | 'zip' }> = [
  { file: 'proto-cli-v0.4.0.tar.gz', type: 'tar' },
  { file: 'proto-cli-v0.4.0.zip', type: 'zip' }
];
let jobSummary = core.summary;

type OutputFormat = 'github-annotations' | 'json';
type SanitizedManifestResult = Omit<ManifestResult, 'absolutePath'>;

interface ValidationReportPayload {
  summary: ValidationSummary;
  manifests: SanitizedManifestResult[];
}

interface AnnotationApi {
  error: (message: string, properties?: core.AnnotationProperties) => void;
  warning: (message: string, properties?: core.AnnotationProperties) => void;
  notice: (message: string, properties?: core.AnnotationProperties) => void;
}

const defaultAnnotationApi: AnnotationApi = {
  error: (message, properties) => core.error(message, properties),
  warning: (message, properties) => core.warning(message, properties),
  notice: (message, properties) => core.notice(message, properties)
};

interface ProtoCliContext {
  command: string;
  args: string[];
  binaryPath: string;
}

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

    const protoCli = await resolveProtoCliContext(inputs.protoCliVersion).catch((error: Error) => {
      core.warning(
        `Unable to resolve proto CLI (version ${inputs.protoCliVersion}): ${error.message}. Falling back to embedded protocol logic.`
      );
      return null;
    });

    if (protoCli) {
      core.info(`Using proto CLI binary at ${protoCli.binaryPath}`);
    }

    const results: ManifestResult[] = [];

    for (const absolutePath of manifestPaths) {
      const relativePath = toRelativePath(absolutePath, workspace);
      const result = await evaluateManifest({
        absolutePath,
        relativePath,
        baseRef,
        octokit,
        owner,
        repo,
        protoCli
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
    const reportPayload: ValidationReportPayload = {
      summary,
      manifests: sanitizedResults
    };

    await deliverDetailedReport({
      format: inputs.outputFormat,
      results,
      reportPayload,
      workspace
    });

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
    outputFormat: parseOutputFormat(core.getInput('output-format')),
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
  protoCli: ProtoCliContext | null;
}): Promise<ManifestResult> {
  const { absolutePath, relativePath, baseRef, octokit, owner, repo, protoCli } = options;
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

  try {
    const validationOutcome = protoCli
      ? await runProtoValidate(protoCli, absolutePath)
      : runLocalValidation(parsedManifest);
    result.errors.push(...validationOutcome.errors);
    result.warnings.push(...validationOutcome.warnings);
  } catch (error) {
    core.warning(
      `Validation fallback for ${relativePath}: ${(error as Error).message}`
    );
    const fallback = runLocalValidation(parsedManifest);
    result.errors.push(...fallback.errors);
    result.warnings.push(...fallback.warnings);
  }

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
      const baseManifest = safeParse(baseContent);
      if (protoCli && baseManifest) {
        try {
          result.breakingChanges = await runProtoDiff(protoCli, baseContent, absolutePath);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown diff error';
          core.warning(`Diff fallback for ${relativePath}: ${message}`);
          result.breakingChanges = runLocalDiff(baseManifest, parsedManifest);
        }
      } else if (baseManifest) {
        result.breakingChanges = runLocalDiff(baseManifest, parsedManifest);
      }
    }
  }

  return result;
}

function collectIssues(validationResult: {
  ok: boolean;
  results?: Array<{ name?: string; ok?: boolean; issues?: Array<Record<string, any>> }>;
  errors?: string[];
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

  for (const message of validationResult.errors ?? []) {
    if (typeof message === 'string' && message.trim().length > 0) {
      errors.push({ level: 'error', message: message.trim() });
    }
  }

  return { errors, warnings };
}

function safeParse(content: string): Record<string, any> | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
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

function runLocalValidation(manifest: Record<string, any>): { errors: Issue[]; warnings: Issue[] } {
  const protocol = createDataProtocol(manifest);
  const validation = protocol.validate();
  return collectIssues(validation);
}

function runLocalDiff(baseManifest: Record<string, any>, headManifest: Record<string, any>): BreakingChange[] {
  const protocol = createDataProtocol(baseManifest);
  const diff = protocol.diff(headManifest) as {
    breaking?: Array<{ path: string; reason?: string; from?: unknown; to?: unknown }>;
  };
  const breaking = diff.breaking ?? [];
  return breaking.map((change) => ({
    path: change.path,
    reason: change.reason,
    from: sanitizeValue(change.from),
    to: sanitizeValue(change.to)
  }));
}

async function runProtoValidate(
  protoCli: ProtoCliContext,
  manifestPath: string
): Promise<{ errors: Issue[]; warnings: Issue[] }> {
  const args = ['validate', `--manifest=${manifestPath}`, '--format=json'];
  const result = await runProto(protoCli, args, { acceptExitCodes: [0, 2] });
  const payload = safeParse(result.stdout) ?? {};
  const normalized = {
    ok: typeof payload.valid === 'boolean' ? payload.valid : payload.ok ?? true,
    results: payload.validatorResults ?? payload.results ?? [],
    errors: payload.errors ?? []
  };
  return collectIssues(normalized);
}

async function runProtoDiff(
  protoCli: ProtoCliContext,
  baseContent: string,
  headPath: string
): Promise<BreakingChange[]> {
  const tempBase = await writeTempManifest(baseContent);
  try {
    const args = ['diff', `--from=${tempBase.filePath}`, `--to=${headPath}`, '--format=json'];
    const result = await runProto(protoCli, args);
    const payload = safeParse(result.stdout) ?? {};
    const breaking = Array.isArray(payload.breaking) ? payload.breaking : [];
    return breaking.map((change: any) => ({
      path: change?.path || 'unknown',
      reason: change?.reason,
      from: sanitizeValue(change?.from),
      to: sanitizeValue(change?.to)
    }));
  } finally {
    await cleanupTempDir(tempBase.dir);
  }
}

async function runProto(
  protoCli: ProtoCliContext,
  args: string[],
  options: { acceptExitCodes?: number[] } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const finalArgs = [...protoCli.args, ...args];
  try {
    const { stdout, stderr } = await execFileAsync(protoCli.command, finalArgs, {
      env: process.env
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (error) {
    const execError = error as ExecFileException & { stdout?: string; stderr?: string };
    const exitCode =
      typeof execError.code === 'number'
        ? execError.code
        : typeof execError.code === 'string'
          ? parseInt(execError.code, 10)
          : 1;
    if (options.acceptExitCodes?.includes(exitCode)) {
      return {
        stdout: (execError.stdout ?? '').trim(),
        stderr: (execError.stderr ?? '').trim(),
        exitCode
      };
    }
    const message = execError.message || 'proto CLI execution failed';
    throw new Error(`${message} (exit code ${exitCode})`);
  }
}

async function resolveProtoCliContext(version: string): Promise<ProtoCliContext> {
  const explicit = process.env.PROTO_CLI_PATH;
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (!(await fileExists(resolved))) {
      throw new Error(`PROTO_CLI_PATH ${resolved} does not exist`);
    }
    return await prepareCliContext(resolved);
  }

  const cachedDir = tc.find('proto', version);
  if (cachedDir) {
    const candidate = await resolveBinaryWithinDir(cachedDir);
    if (candidate) {
      return await prepareCliContext(candidate);
    }
  }

  const downloaded = await maybeDownloadProtoCli(version);
  if (downloaded) {
    return await prepareCliContext(downloaded);
  }

  const bundled = await useBundledProtoCli(version);
  if (bundled) {
    core.info('Using bundled proto CLI archive packaged with proto-validate-action.');
    return await prepareCliContext(bundled);
  }

  const local = await findLocalProtoBinary();
  if (local) {
    return await prepareCliContext(local);
  }

  throw new Error('Proto CLI binary not found. Set PROTO_CLI_PATH or PROTO_CLI_DOWNLOAD_URL.');
}

async function prepareCliContext(binaryPath: string): Promise<ProtoCliContext> {
  await ensureExecutable(binaryPath);
  const script = isScriptFile(binaryPath);
  return {
    command: script ? process.execPath : binaryPath,
    args: script ? [binaryPath] : [],
    binaryPath
  };
}

async function maybeDownloadProtoCli(version: string): Promise<string | null> {
  const url = buildDownloadUrl(version);
  if (!url) {
    return null;
  }
  const downloadPath = await tc.downloadTool(url);
  let extractedDir: string;
  if (url.endsWith('.zip')) {
    extractedDir = await tc.extractZip(downloadPath);
  } else {
    extractedDir = await tc.extractTar(downloadPath);
  }
  const cachedDir = await tc.cacheDir(extractedDir, 'proto', version);
  const candidate = await resolveBinaryWithinDir(cachedDir);
  if (!candidate) {
    throw new Error('Downloaded proto CLI archive did not contain a recognizable binary.');
  }
  return candidate;
}

async function useBundledProtoCli(version: string): Promise<string | null> {
  for (const candidate of BUNDLED_ARCHIVE_CANDIDATES) {
    const archivePath = path.join(BUNDLED_CLI_DIR, candidate.file);
    if (!(await fileExists(archivePath))) {
      continue;
    }
    try {
      const extractedDir =
        candidate.type === 'zip' ? await tc.extractZip(archivePath) : await tc.extractTar(archivePath);
      const cachedDir = await tc.cacheDir(extractedDir, 'proto', version);
      const binary = await resolveBinaryWithinDir(cachedDir);
      if (binary) {
        return binary;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown extraction failure';
      core.warning(`Unable to hydrate bundled proto CLI archive ${candidate.file}: ${message}`);
    }
  }
  return null;
}

function buildDownloadUrl(version: string): string | null {
  if (process.env.PROTO_CLI_DOWNLOAD_URL) {
    return process.env.PROTO_CLI_DOWNLOAD_URL;
  }
  const template = process.env.PROTO_CLI_DOWNLOAD_TEMPLATE;
  if (!template) return null;
  return template
    .replace('{version}', version)
    .replace('{platform}', process.platform)
    .replace('{arch}', process.arch);
}

async function resolveBinaryWithinDir(root: string): Promise<string | null> {
  const candidates = (process.env.PROTO_CLI_BIN || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const searchOrder = candidates.length > 0 ? candidates : defaultBinaryCandidates();
  for (const candidate of searchOrder) {
    const candidatePath = path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
    if (await fileExists(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

function defaultBinaryCandidates(): string[] {
  if (process.platform === 'win32') {
    return ['proto.cmd', 'proto.exe', 'bin/proto.cmd', 'dist/proto.js'];
  }
  return ['proto', 'bin/proto', 'dist/proto.js', 'proto.js'];
}

async function findLocalProtoBinary(): Promise<string | null> {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const binName = process.platform === 'win32' ? 'proto.cmd' : 'proto';
  const candidates = [
    path.join(workspace, 'node_modules', '.bin', binName),
    path.join(workspace, 'packages', 'cli', 'dist', 'proto.js')
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureExecutable(filePath: string): Promise<void> {
  if (process.platform === 'win32') {
    return;
  }
  try {
    await fs.chmod(filePath, 0o755);
  } catch {
    // Ignore chmod errors on read-only file systems.
  }
}

function isScriptFile(filePath: string): boolean {
  return filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs');
}

async function writeTempManifest(content: string): Promise<{ dir: string; filePath: string }> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'proto-cli-'));
  const filePath = path.join(dir, `manifest-${Date.now()}.json`);
  await fs.writeFile(filePath, content, 'utf8');
  return { dir, filePath };
}

async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Swallow cleanup errors.
  }
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

function parseOutputFormat(raw: string): OutputFormat {
  const normalized = (raw || 'github-annotations').trim().toLowerCase();
  return normalized === 'json' ? 'json' : 'github-annotations';
}

function setSummaryForTesting(summary: typeof core.summary): void {
  jobSummary = summary;
}

function resetSummaryForTesting(): void {
  jobSummary = core.summary;
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

  jobSummary.addHeading('Proto Manifest Validation', 2).addTable(summaryTable);

  if (highlights.length) {
    jobSummary
      .addHeading('Key Findings', 3)
      .addList(highlights.slice(0, MAX_LIST_ITEMS));
    if (highlights.length > MAX_LIST_ITEMS) {
      jobSummary.addQuote(
        `...${highlights.length - MAX_LIST_ITEMS} additional findings truncated for brevity.`
      );
    }
  } else {
    jobSummary.addRaw('No validation errors or warnings reported.\n');
  }

  await jobSummary.write();
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

async function deliverDetailedReport(options: {
  format: OutputFormat;
  results: ManifestResult[];
  reportPayload: ValidationReportPayload;
  workspace: string;
}): Promise<void> {
  if (options.format === 'json') {
    await writeJsonReport(options.reportPayload, options.workspace);
    return;
  }
  emitAnnotations(options.results);
}

function emitAnnotations(results: ManifestResult[], api: AnnotationApi = defaultAnnotationApi): void {
  let hasFindings = false;
  for (const result of results) {
    const fileRef = result.path || result.absolutePath;
    const manifestLabel = result.path || 'manifest';

    for (const error of result.errors) {
      api.error(formatIssueAnnotation(manifestLabel, error), {
        file: fileRef,
        title: 'Manifest Validation Error'
      });
      hasFindings = true;
    }

    for (const warning of [...result.warnings, ...result.piiWarnings]) {
      api.warning(formatIssueAnnotation(manifestLabel, warning), {
        file: fileRef,
        title: 'Manifest Warning'
      });
      hasFindings = true;
    }

    for (const breaking of result.breakingChanges) {
      api.error(formatBreakingAnnotation(manifestLabel, breaking), {
        file: fileRef,
        title: 'Breaking Change Detected'
      });
      hasFindings = true;
    }
  }

  if (!hasFindings) {
    api.notice('No manifest validation issues detected.', {
      title: 'proto/validate-action'
    });
  }
}

async function writeJsonReport(payload: ValidationReportPayload, workspace: string): Promise<string> {
  const targetPath = path.join(workspace, REPORT_FILE_NAME);
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  core.info(`Validation report written to ${targetPath}`);
  return targetPath;
}

function formatIssueAnnotation(manifestLabel: string, issue: Issue): string {
  const extras: string[] = [];
  if (issue.path) extras.push(issue.path);
  if (issue.validator) extras.push(issue.validator);
  const suffix = extras.length ? ` (${extras.join(' · ')})` : '';
  return `${manifestLabel}: ${issue.message}${suffix}`;
}

function formatBreakingAnnotation(manifestLabel: string, change: BreakingChange): string {
  const extras: string[] = [];
  if (change.path) extras.push(change.path);
  const descriptor = change.reason || 'breaking change detected';
  const suffix = extras.length ? ` (${extras.join(' · ')})` : '';
  return `${manifestLabel}: ${descriptor}${suffix}`;
}

async function upsertPrComment(options: {
  octokit: Octokit;
  owner: string;
  repo: string;
  sentinel: string;
  runUrl: string;
  summary: ValidationSummary;
  results: ManifestResult[];
  context?: typeof github.context;
}): Promise<void> {
  const { octokit, owner, repo, sentinel, runUrl, summary, results, context } = options;
  const githubContext = context ?? github.context;
  const pullRequestNumber = githubContext.payload.pull_request?.number;
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

const __testing = {
  runProtoValidate,
  runProtoDiff,
  runProto,
  prepareCliContext,
  resolveProtoCliContext,
  writeJobSummary,
  upsertPrComment,
  setSummaryForTesting,
  resetSummaryForTesting,
  deliverDetailedReport,
  emitAnnotations,
  writeJsonReport
};

export { detectPiiWarnings, collectIssues, summarize, buildCommentBody, __testing };
export type { Issue, ManifestResult, ValidationSummary };

if (typeof require !== 'undefined' && require.main === module) {
  void run();
}
