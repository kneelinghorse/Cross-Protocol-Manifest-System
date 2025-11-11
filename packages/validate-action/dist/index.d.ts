import * as core from '@actions/core';
import * as github from '@actions/github';

type Octokit = ReturnType<typeof github.getOctokit>;
type IssueLevel = 'error' | 'warn' | 'info';
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
interface ProtoCliContext {
    command: string;
    args: string[];
    binaryPath: string;
}
declare function collectIssues(validationResult: {
    ok: boolean;
    results?: Array<{
        name?: string;
        ok?: boolean;
        issues?: Array<Record<string, any>>;
    }>;
    errors?: string[];
}): {
    errors: Issue[];
    warnings: Issue[];
};
declare function detectPiiWarnings(manifest: Record<string, any>, relativePath: string): Issue[];
declare function runProtoValidate(protoCli: ProtoCliContext, manifestPath: string): Promise<{
    errors: Issue[];
    warnings: Issue[];
}>;
declare function runProtoDiff(protoCli: ProtoCliContext, baseContent: string, headPath: string): Promise<BreakingChange[]>;
declare function runProto(protoCli: ProtoCliContext, args: string[], options?: {
    acceptExitCodes?: number[];
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
declare function resolveProtoCliContext(version: string): Promise<ProtoCliContext>;
declare function prepareCliContext(binaryPath: string): Promise<ProtoCliContext>;
declare function summarize(results: ManifestResult[]): ValidationSummary;
declare function setSummaryForTesting(summary: typeof core.summary): void;
declare function resetSummaryForTesting(): void;
declare function writeJobSummary(results: ManifestResult[], summary: ValidationSummary): Promise<void>;
declare function deliverDetailedReport(options: {
    format: OutputFormat;
    results: ManifestResult[];
    reportPayload: ValidationReportPayload;
    workspace: string;
}): Promise<void>;
declare function emitAnnotations(results: ManifestResult[], api?: AnnotationApi): void;
declare function writeJsonReport(payload: ValidationReportPayload, workspace: string): Promise<string>;
declare function upsertPrComment(options: {
    octokit: Octokit;
    owner: string;
    repo: string;
    sentinel: string;
    runUrl: string;
    summary: ValidationSummary;
    results: ManifestResult[];
    context?: typeof github.context;
}): Promise<void>;
declare function buildCommentBody(summary: ValidationSummary, results: ManifestResult[], runUrl: string, sentinel: string): string;
declare const __testing: {
    runProtoValidate: typeof runProtoValidate;
    runProtoDiff: typeof runProtoDiff;
    runProto: typeof runProto;
    prepareCliContext: typeof prepareCliContext;
    resolveProtoCliContext: typeof resolveProtoCliContext;
    writeJobSummary: typeof writeJobSummary;
    upsertPrComment: typeof upsertPrComment;
    setSummaryForTesting: typeof setSummaryForTesting;
    resetSummaryForTesting: typeof resetSummaryForTesting;
    deliverDetailedReport: typeof deliverDetailedReport;
    emitAnnotations: typeof emitAnnotations;
    writeJsonReport: typeof writeJsonReport;
};

export { type Issue, type ManifestResult, type ValidationSummary, __testing, buildCommentBody, collectIssues, detectPiiWarnings, summarize };
