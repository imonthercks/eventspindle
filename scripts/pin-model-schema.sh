#!/usr/bin/env bash
# Capture an immutable upstream schema commit and checksum at bootstrap time.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
repo='https://github.com/dilgerma/event-modeling-spec.git'
commit="${EVENT_MODELING_SCHEMA_COMMIT:-}"
if [[ -z "$commit" ]]; then
  commit="$(git ls-remote "$repo" refs/heads/main | awk '{print $1}')"
fi
if [[ ! "$commit" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo 'Unable to resolve valid upstream schema commit' >&2
  exit 1
fi
out='schemas/upstream/eventmodeling.schema.json'
url="https://raw.githubusercontent.com/dilgerma/event-modeling-spec/${commit}/eventmodeling.schema.json"
curl --fail --location --retry 3 --silent --show-error "$url" --output "$out"
node --input-type=module - "$commit" "$url" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const commit = process.argv[2], url = process.argv[3];
const file = 'schemas/upstream/eventmodeling.schema.json';
const text = readFileSync(file, 'utf8');
const schema = JSON.parse(text);
if (!schema.$schema?.includes('draft-07')) throw new Error('Unexpected upstream schema draft');
const sha256 = createHash('sha256').update(text).digest('hex');
const lock = { source: 'dilgerma/event-modeling-spec', commit, url, sha256 };
writeFileSync('schemas/upstream/eventmodeling.schema.lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log('Pinned official Event Modeling schema at ' + commit + ' (' + sha256 + ')');
NODE
