#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
INDEXES = [PUBLIC / "index.html", ROOT / "index.html"]

errors: list[str] = []

for path in INDEXES:
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")

for json_path in [ROOT / "firebase.json", ROOT / "firestore.indexes.json", ROOT / ".firebaserc", ROOT / "module-manifest.json"]:
    try:
        json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid JSON {json_path.name}: {exc}")

public_html = (PUBLIC / "index.html").read_text(encoding="utf-8") if (PUBLIC / "index.html").exists() else ""
root_html = (ROOT / "index.html").read_text(encoding="utf-8") if (ROOT / "index.html").exists() else ""

for html, base, label in [(public_html, PUBLIC, "public/index.html"), (root_html, ROOT, "index.html")]:
    refs = re.findall(r'''(?:src|href)=["']([^"']+)["']''', html)
    for ref in refs:
        if ref.startswith(("http://", "https://", "data:", "#", "mailto:")):
            continue
        clean = ref.split("?", 1)[0].split("#", 1)[0]
        if not clean:
            continue
        target = (base / clean).resolve()
        if not target.is_file():
            errors.append(f"missing asset from {label}: {ref}")

ids = re.findall(r'''\bid=["']([^"']+)["']''', public_html)
dupes = sorted({value for value in ids if ids.count(value) > 1})
if dupes:
    errors.append("duplicate HTML IDs: " + ", ".join(dupes))

for marker in ["EMBEDDED_CARTS", "almftres@hotmail.com", "abdulrahmanjudayba@gmail.com"]:
    for path in PUBLIC.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".html", ".js", ".css"}:
            if marker in path.read_text(encoding="utf-8", errors="ignore"):
                errors.append(f"sensitive marker {marker!r} in {path.relative_to(ROOT)}")

for js_path in sorted((PUBLIC / "assets" / "js").rglob("*.js")):
    result = subprocess.run(["node", "--check", str(js_path)], capture_output=True, text=True)
    if result.returncode:
        errors.append(f"JavaScript syntax failed: {js_path.relative_to(ROOT)}\n{result.stderr.strip()}")

functions_check = subprocess.run(["node", "--check", str(ROOT / "functions" / "index.js")], capture_output=True, text=True)
if functions_check.returncode:
    errors.append("Functions syntax failed: " + functions_check.stderr.strip())

functions_text = (ROOT / "functions" / "index.js").read_text(encoding="utf-8")
for role in ["pharmacy_staff", "inpatient_supervisor"]:
    if role not in functions_text:
        errors.append(f"Cloud Functions missing role {role}")

runtime = (PUBLIC / "assets" / "js" / "modules" / "59-r664-security-complete-runtime.js").read_text(encoding="utf-8")
for required in ["crash_cart_master_seal_correction", "masterCreateCloudBackup", "fsCanWriteStateKey"]:
    if required not in runtime:
        errors.append(f"security runtime missing {required}")

if "http://localhost:9100" in public_html or "https://localhost:9101" in public_html:
    errors.append("production CSP still allows localhost Zebra connector")

if errors:
    print("FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print("PASS: repository structure, assets, JavaScript, Functions, roles, and security markers verified.")
