export interface StreamIdentity {
  boundedContext: string;
  aggregateType: string;
  aggregateId: string;
}

/** v0.0.1 identity shape; encoding and validation rules are M1 work. */
export function formatStreamId(stream: StreamIdentity): string {
  return `${stream.boundedContext}/${stream.aggregateType}/${stream.aggregateId}`;
}
