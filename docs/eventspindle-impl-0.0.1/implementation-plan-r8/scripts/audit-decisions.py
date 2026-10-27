#!/usr/bin/env python3
"""Conservative guard against reintroducing prior undecided policies in live plan files."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parent.parent
checks = {
    'DECISIONS-AND-DEFERRED.md': ['## Step 1–5 decisions accepted', 'explicit'],
    'IMPLEMENTATION-PLAN.md': ['RECOVERY-BOUNDARY.md', 'M-1'],
    'RECOVERY-BOUNDARY.md': ['RECOVERY_INCOMPLETE', 'not supported'],
    'RELEASE-READINESS.md': ['NO-GO', 'R-01', 'R-02'],
}
issues = []
for filename, markers in checks.items():
    text=(root/filename).read_text()
    for marker in markers:
        if marker.lower() not in text.lower(): issues.append(f'{filename}: missing {marker}')
if issues:
    print('DECISION AUDIT FAILED\n'+'\n'.join(issues));sys.exit(1)
print('Decision-document audit passed (does not replace manual semantic review).')
