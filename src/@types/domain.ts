import { StepKind } from './enums';

export type StepConfig =
  | { kind: StepKind.RECEIVE; source: EndpointSpec }
  | { kind: StepKind.VALIDATE; schema: JsonSchema }
  | { kind: StepKind.TRANSFORM; mapping: FieldMapping[] }
  | { kind: StepKind.DISPATCH; destination: EndpointSpec; auth: AuthSpec }
  | { kind: StepKind.LOG; level: 'info' | 'error' };

export interface EndpointSpec {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
}

export interface FieldMapping {
  sourcePath: string; // ex: "$.customer.email"
  targetPath: string; // ex: "$.contact.email_address"
  transform?: 'toUpperCase' | 'toISODate' | 'identity';
}

export interface AuthSpec {
  type: 'none' | 'apiKey' | 'oauth2';
  [key: string]: unknown;
}

export type JsonSchema = Record<string, unknown>;
