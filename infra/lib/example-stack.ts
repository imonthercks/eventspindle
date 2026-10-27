import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

/** M0 synth-only stack: NO AWS event store, API, DSQL, or Durable Functions yet. */
export class ExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    new CfnOutput(this, 'Stage', { value: 'M0-scaffolding-only' });
  }
}
