import { App } from 'aws-cdk-lib';
import { ExampleStack } from '../lib/example-stack';

const app = new App();
new ExampleStack(app, 'EventSpindleBootstrap');
app.synth();
