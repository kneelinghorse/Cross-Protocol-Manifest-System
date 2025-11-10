import type {ProtocolId} from './sampleManifests';

export interface ValidatorIssue {
  path?: string;
  msg: string;
  level: 'error' | 'warn' | 'info' | string;
  validator?: string;
}

export interface MarkerPayload {
  message: string;
  severity: 'error' | 'warn' | 'info';
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface ValidatorResponse {
  version: number;
  protocol: ProtocolId;
  status: 'ok' | 'error';
  elapsedMs: number;
  datasetName?: string;
  validatorsRan: number;
  issues: ValidatorIssue[];
  markers: MarkerPayload[];
  error?: string;
}

export interface ValidatorRequest {
  type: 'validate';
  code: string;
  protocol: ProtocolId;
  version: number;
}
