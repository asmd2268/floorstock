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

for json_path in [ROOT / "firebase.json", ROOT / "vercel.json", ROOT / "firestore.indexes.json", ROOT / ".firebaserc", ROOT / "module-manifest.json"]:
    try:
        json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid JSON {json_path.name}: {exc}")

public_html = (PUBLIC / "index.html").read_text(encoding="utf-8") if (PUBLIC / "index.html").exists() else ""
root_html = (ROOT / "index.html").read_text(encoding="utf-8") if (ROOT / "index.html").exists() else ""

expected_root_html = public_html.replace('./assets/', './public/assets/')
normalize_html = lambda value: re.sub(r"\s*;\s*", ";", re.sub(r"\s+", " ", value)).strip()
if normalize_html(root_html) != normalize_html(expected_root_html):
    errors.append("index.html must remain a generated root-path mirror of public/index.html")

if 'name="asdhealth-architecture"' not in public_html or 'content="es-modules-v3"' not in public_html:
    errors.append("public/index.html is not marked as the ES-module architecture")
if len(re.findall(r'<script\b[^>]*\btype="module"[^>]*\bsrc="\./assets/js/auth-bootstrap\.js', public_html)) != 1:
    errors.append("public/index.html must have exactly one ES-module application entrypoint")
if re.search(r'\son[a-z]+\s*=', public_html, re.I):
    errors.append("static inline event handlers remain in public/index.html")
if 'assets/js/modules/' in public_html:
    errors.append("public/index.html still loads legacy modules directly")

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

integrated = (PUBLIC / "assets" / "js" / "modules" / "50-r617-integrated-operations.js").read_text(encoding="utf-8")
for required in [
    "['pharmacy','inpatient_supervisor','pharmacy_staff']",
    "window.r17CrashExecuteBulk",
    "window.renderMedicationAccountability",
    "crash_cart_open_report",
]:
    if required not in integrated:
        errors.append(f"integrated operations missing {required}")

rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
for role in ["pharmacy_staff", "inpatient_supervisor"]:
    if role not in rules:
        errors.append(f"Firestore Rules missing role {role}")

firebase_config = json.loads((ROOT / "firebase.json").read_text(encoding="utf-8"))
firebase_headers = {
    header.get("key")
    for entry in firebase_config.get("hosting", {}).get("headers", [])
    for header in entry.get("headers", [])
}
for required_header in ["Strict-Transport-Security", "X-Frame-Options", "Content-Security-Policy"]:
    if required_header not in firebase_headers:
        errors.append(f"Firebase Hosting missing security header {required_header}")

auth_module = (PUBLIC / "assets" / "js" / "modules" / "03-core-application-firebase-state-auth.js").read_text(encoding="utf-8")
for required in [
    "FB_APPCHECK.activate(",
    "floorstock_last_cache_v2_",
    "fsHydrateDepartmentDirectoryForLogin(profile)",
    "fsStateLoadFloorstockForProfileViaRest(profileHint)",
]:
    if required not in auth_module:
        errors.append(f"Firebase authentication bootstrap missing {required}")
if "localStorage.setItem('floorstock_last_cache_v1'" in auth_module:
    errors.append("legacy cross-account Floor Stock cache write remains enabled")

modules_check = subprocess.run(["node", str(ROOT / "tools" / "verify_modules.mjs")], capture_output=True, text=True)
if modules_check.returncode:
    errors.append("ES module verification failed: " + (modules_check.stderr.strip() or modules_check.stdout.strip()))

if errors:
    print("FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print("PASS: repository structure, ES modules, assets, Functions, roles, permissions, and security markers verified.")
