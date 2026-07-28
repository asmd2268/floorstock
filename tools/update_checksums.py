#!/usr/bin/env python3
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {'.git', 'node_modules', '.firebase'}
EXCLUDED_FILES = {'checksums.sha256'}

rows = []
for path in sorted(ROOT.rglob('*')):
    if not path.is_file() or any(part in EXCLUDED_PARTS for part in path.relative_to(ROOT).parts):
        continue
    if path.name in EXCLUDED_FILES or path.suffix in {'.xlsx', '.xls'}:
        continue
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    rows.append(f"{digest}  ./{path.relative_to(ROOT).as_posix()}")

(ROOT / 'checksums.sha256').write_text('\n'.join(rows) + '\n', encoding='utf-8')
print(f'Updated {len(rows)} checksums.')
