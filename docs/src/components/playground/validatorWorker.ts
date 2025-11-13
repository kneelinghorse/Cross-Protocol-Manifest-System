/// <reference lib="webworker" />
import jsonSourceMap from 'json-source-map';
import type {PointerInfo} from 'json-source-map';

const {parse: parseWithPointers} = jsonSourceMap;
import {createDataProtocol} from '@cpms/data';
import {createEventProtocol} from '@cpms/event';
import {createApiProtocol} from '@cpms/api';
import {createAgentProtocol} from '@cpms/agent';
import {createSemanticProtocol} from '@cpms/semantic';
import type {ProtocolId} from './sampleManifests';
import type {
  MarkerPayload,
  ValidatorIssue,
  ValidatorRequest,
  ValidatorResponse,
} from './workerTypes';

const factories: Record<ProtocolId, (manifest: unknown) => any> = {
  data: createDataProtocol,
  event: createEventProtocol,
  api: createApiProtocol,
  agent: createAgentProtocol,
  semantic: createSemanticProtocol,
};

const severityMap: Record<string, MarkerPayload['severity']> = {
  error: 'error',
  warn: 'warn',
  warning: 'warn',
  info: 'info',
};

const normalizeSeverity = (level?: string): MarkerPayload['severity'] => {
  const normalized = level?.toLowerCase?.() ?? 'error';
  return severityMap[normalized] ?? 'error';
};

function toPointer(path?: string): string {
  if (!path) return '';
  const normalized = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .map((segment) => segment.replace(/~/g, '~0').replace(/\//g, '~1'))
    .join('/');
  return normalized ? `/${normalized}` : '';
}

function toMarker(issue: ValidatorIssue, pointers: Record<string, PointerInfo>): MarkerPayload {
  const pointer = toPointer(issue.path);
  const key = pointers[pointer] ? pointer : fallbackPointer(pointer, pointers);
  if (key && pointers[key]) {
    const loc = pointers[key];
    return {
      message: issue.msg,
      severity: normalizeSeverity(issue.level),
      startLineNumber: loc.value.line + 1,
      startColumn: loc.value.column + 1,
      endLineNumber: loc.valueEnd.line + 1,
      endColumn: Math.max(loc.valueEnd.column + 1, loc.value.column + 2),
    };
  }
  return {
    message: issue.msg,
    severity: normalizeSeverity(issue.level),
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1,
  };
}

function fallbackPointer(pointer: string, pointers: Record<string, PointerInfo>): string | '' {
  if (!pointer) return '';
  const parts = pointer.split('/').filter(Boolean);
  while (parts.length) {
    const candidate = `/${parts.join('/')}`;
    if (candidate in pointers) return candidate;
    parts.pop();
  }
  return '';
}

function flattenIssues(results: Array<{name?: string; issues?: ValidatorIssue[]}>) {
  const issues: ValidatorIssue[] = [];
  for (const res of results) {
    for (const issue of res.issues ?? []) {
      issues.push({...issue, validator: res.name});
    }
  }
  return issues;
}

function datasetName(manifest: any): string | undefined {
  return (
    manifest?.dataset?.name ||
    manifest?.service?.name ||
    manifest?.agent?.name ||
    manifest?.channel?.name ||
    manifest?.intent?.id
  );
}

self.onmessage = (event: MessageEvent<ValidatorRequest>) => {
  const {data} = event;
  if (data?.type !== 'validate') return;
  const start = performance.now();
  try {
    const {data: manifest, pointers} = parseWithPointers(data.code || '{}');
    const factory = factories[data.protocol] ?? factories.data;
    const instance = factory(manifest);
    const validation = instance.validate ? instance.validate() : {ok: true, results: []};
    const issues = flattenIssues(validation.results ?? []);
    const markers = issues.map((issue) => toMarker(issue, pointers));
    const response: ValidatorResponse = {
      version: data.version,
      protocol: data.protocol,
      status: validation.ok ? 'ok' : 'error',
      elapsedMs: Math.round(performance.now() - start),
      datasetName: datasetName(manifest),
      validatorsRan: validation.results?.length ?? 0,
      issues,
      markers,
    };
    postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to validate manifest';
    const response: ValidatorResponse = {
      version: data.version,
      protocol: data.protocol,
      status: 'error',
      elapsedMs: Math.round(performance.now() - start),
      datasetName: undefined,
      validatorsRan: 0,
      issues: [{msg: message, level: 'error', path: ''}],
      markers: [
        {
          message,
          severity: 'error',
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        },
      ],
      error: message,
    };
    postMessage(response);
  }
};

export {};
