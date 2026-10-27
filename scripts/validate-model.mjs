import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv';

const schemaPath = 'schemas/upstream/eventmodeling.schema.json';
const lockPath = 'schemas/upstream/eventmodeling.schema.lock.json';
function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
try {
  const schemaText = readFileSync(schemaPath, 'utf8');
  const lock = json(lockPath);
  const actual = createHash('sha256').update(schemaText).digest('hex');
  if (actual !== lock.sha256)
    throw new Error(`Pinned upstream schema checksum mismatch (${actual})`);
  const schema = JSON.parse(schemaText);
  if (!schema.$schema?.includes('draft-07'))
    throw new Error('Expected upstream JSON Schema Draft-07');
  const model = json('event-model/model.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(model)) throw new Error(ajv.errorsText(validate.errors, { separator: '\n' }));
  const ids = model.slices.map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate slice IDs');
  console.log(
    `Model valid: ${ids.length} slices; upstream commit ${lock.commit.slice(0, 12)}; checksum verified.`,
  );
  console.log('NOTE: semantic compiler and manifest validation are M0 follow-on tasks.');
} catch (error) {
  console.error(`Model validation failed: ${error.message}`);
  process.exitCode = 1;
}
