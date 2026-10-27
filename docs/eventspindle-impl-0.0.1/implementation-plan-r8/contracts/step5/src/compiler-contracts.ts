/** Proposed EventSpindle v0.0.1 compiler interfaces — design contract, not implementation. */
export type SliceKind = 'STATE_CHANGE' | 'STATE_VIEW' | 'AUTOMATION' | 'TRANSLATION';
export type DiagnosticSeverity = 'error' | 'warning';
export type DiagnosticCode =
  | 'EM001' | 'EM002' | 'EM003' | 'EM004' | 'EM005'
  | 'EM006' | 'EM007' | 'EM008' | 'EM009'
  | 'SCHEMA_INVALID' | 'MANIFEST_INVALID' | 'LOCK_MISMATCH'
  | 'GENERATED_DRIFT' | 'INTERNAL_ERROR';

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly modelPath?: string;
  readonly jsonPointer?: string;
  readonly sliceId?: string;
  readonly hint?: string;
}

export interface CompilerInputs {
  readonly modelFile: string;
  readonly manifestFile: string;
  readonly lockFile: string;
  readonly workspaceRoot: string;
}

export interface SliceKey {
  readonly boundedContext: string;
  readonly sliceId: string;
}

export interface SourceRef {
  readonly path: string;
  readonly pointer: string;
  readonly elementId?: string;
  readonly specificationId?: string;
}

export interface IrElement {
  readonly id: string;
  readonly kind: 'COMMAND' | 'EVENT' | 'READMODEL' | 'SCREEN' | 'AUTOMATION';
  readonly source: SourceRef;
  readonly schemaId?: string;
}

export interface IrSlice {
  readonly identity: SliceKey;
  readonly version: number;
  readonly kind: SliceKind;
  readonly source: SourceRef;
  readonly elements: readonly IrElement[];
  readonly dependencies: readonly string[];
  readonly specificationIds: readonly string[];
}

export interface NormalizedModel {
  readonly irVersion: '1';
  readonly modelDigest: string;
  readonly slices: readonly IrSlice[];
}

export type CompilerResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export interface PlannedOutput {
  readonly path: string; // relative to workspace
  readonly owner: 'generated' | 'developer-scaffold';
  readonly sourceRefs: readonly SourceRef[];
}
export interface GenerationPlan {
  readonly inputDigest: string;
  readonly outputs: readonly PlannedOutput[];
}
export interface GenerationManifest {
  readonly generatorDigest: string;
  readonly modelDigest: string;
  readonly outputFiles: Readonly<Record<string, string>>; // path -> sha256
}

export interface EventSpindleCompiler {
  validate(inputs: CompilerInputs): Promise<CompilerResult<NormalizedModel>>;
  plan(inputs: CompilerInputs): Promise<CompilerResult<GenerationPlan>>;
  generate(inputs: CompilerInputs): Promise<CompilerResult<GenerationManifest>>;
  checkGenerated(inputs: CompilerInputs): Promise<CompilerResult<GenerationManifest>>;
}

export interface SuccessorRequest {
  readonly slice: SliceKey;
  readonly fromVersion: number;
  readonly toVersion: number;
}
export interface SliceVersionManager {
  createSuccessor(inputs: CompilerInputs, request: SuccessorRequest): Promise<CompilerResult<GenerationPlan>>;
  // Release operation is CI-authorized, not automatically performed by generate/deploy.
  verifyRelease(inputs: CompilerInputs, releaseId: string): Promise<CompilerResult<GenerationManifest>>;
}
