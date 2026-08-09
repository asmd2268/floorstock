#!/usr/bin/env python3
"""Build the conservative R6.65 ES-module entrypoint.

The application grew as ordered browser scripts. Five source files intentionally
provide the shared legacy API; the remaining files are isolated feature patches.
This build keeps that order, publishes only the provider declarations needed by
later modules, and replaces static inline DOM handlers with declarative bindings.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
JS = PUBLIC / "assets" / "js"
MODULES = JS / "modules"
CORE = JS / "core"
BUILD_VERSION = "R6.76.7"
PROVIDERS = {
    "01-firebase-global-bootstrap.js",
    "03-core-application-firebase-state-auth.js",
    "07-expiry-requests-and-primary-features.js",
    "08-controlled-shared-list-filters.js",
    "51-asdhealth-canonical-r6-32-20260727.js",
}
EVENT_RE = re.compile(r"\s(on[a-z]+)=(['\"])(.*?)\2", re.I | re.S)
SCRIPT_RE = re.compile(r"\s*<script\b[^>]*\bsrc=(['\"])\./assets/js/modules/[^'\"]+\1[^>]*></script>", re.I)
MAIN_SCRIPT_RE = re.compile(r"\s*<script\b[^>]*\bsrc=(['\"])\./assets/js/main\.js[^'\"]*\1[^>]*></script>", re.I)


def strip_lexical(text: str) -> str:
    """Blank strings/comments while preserving offsets and line breaks."""
    out = list(text)
    i = 0
    state = "code"
    quote = ""
    while i < len(text):
        c = text[i]
        n = text[i + 1] if i + 1 < len(text) else ""
        if state == "code":
            if c in "'\"`":
                state, quote = "string", c
                out[i] = " "
            elif c == "/" and n == "/":
                state = "line"
                out[i] = out[i + 1] = " "
                i += 1
            elif c == "/" and n == "*":
                state = "block"
                out[i] = out[i + 1] = " "
                i += 1
        elif state == "string":
            if c == "\\":
                out[i] = " "
                if i + 1 < len(text):
                    out[i + 1] = " "
                    i += 1
            elif c == quote:
                out[i] = " "
                state = "code"
            elif c != "\n":
                out[i] = " "
        elif state == "line":
            if c == "\n":
                state = "code"
            else:
                out[i] = " "
        elif state == "block":
            if c == "*" and n == "/":
                out[i] = out[i + 1] = " "
                i += 1
                state = "code"
            elif c != "\n":
                out[i] = " "
        i += 1
    return "".join(out)


def transform_provider(source: str) -> dict[str, object]:
    scratch = ROOT / 'work-provider-source.js'
    scratch.write_text(source, encoding='utf-8')
    try:
        result = subprocess.run(
            ['node', str(ROOT / 'tools' / 'transform_provider.mjs'), str(scratch)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)
    finally:
        scratch.unlink(missing_ok=True)


def validate_handler(source: str) -> None:
    source = source.strip()
    allowed_document = (
        "document.querySelectorAll('.pchk').forEach(function(c){c.checked=true;})",
        "document.querySelectorAll('.pchk').forEach(function(c){c.checked=this.checked;}.bind(this))",
        "document.getElementById('xlsx-file-inp').click()",
        "el('logo-file-inp').click()",
        "this.style.borderColor='var(--bd)'",
        "event.preventDefault();this.style.borderColor='var(--ac)'",
    )
    if source in allowed_document:
        return
    if re.fullmatch(r"if\(event\.key==='Enter'\)[A-Za-z_$][\w$]*\(\)", source):
        return
    call = r"[A-Za-z_$][\w$]*\((?:[^()'\"]|'[^']*'|\"[^\"]*\")*\)"
    if re.fullmatch(call + r"(?:;" + call + r")*;?", source):
        return
    raise ValueError(f"Unsupported inline handler: {source}")


def migrate_handlers(html: str, bindings: list[dict[str, str]] | None = None) -> tuple[str, list[dict[str, str]]]:
    bindings = list(bindings or [])

    def replace_tag(match: re.Match[str]) -> str:
        tag = match.group(0)
        if not EVENT_RE.search(tag):
            return tag
        bid = f"b{len(bindings) + 1:03d}"
        events = []

        def remove_event(event_match: re.Match[str]) -> str:
            event = event_match.group(1)[2:].lower()
            source = event_match.group(3).replace("&quot;", '"').strip()
            validate_handler(source)
            events.append({"event": event, "source": source})
            return ""

        updated = EVENT_RE.sub(remove_event, tag)
        for event in events:
            bindings.append({"id": bid, **event})
        existing = re.search(r'data-asdh-binding="([^"]*)"', updated)
        if existing:
            combined = " ".join(filter(None, [existing.group(1), bid]))
            return updated[:existing.start()] + f'data-asdh-binding="{combined}"' + updated[existing.end():]
        if updated.endswith("/>"):
            return updated[:-2].rstrip() + f' data-asdh-binding="{bid}"/>'
        return updated[:-1].rstrip() + f' data-asdh-binding="{bid}">' if updated.endswith(">") else updated

    opening_tag = re.compile(r"<(?!!|/)[A-Za-z][^<>]*>", re.S)
    return opening_tag.sub(replace_tag, html), bindings


def provider_footer(filename: str, functions: list[str], variables: list[str]) -> str:
    valid_functions = [name for name in functions if re.fullmatch(r"[A-Za-z_$][\w$]*", name)]
    valid_variables = [name for name in variables if re.fullmatch(r"[A-Za-z_$][\w$]*", name)]
    entries = ",\n  ".join(
        [f"{name}: {name}" for name in valid_functions]
        + [f"{name}: globalThis.{name}" for name in valid_variables]
    )
    exports = ",\n  ".join(valid_functions)
    return (
        "\n\nconst __asdhLegacyApi = {\n  " + entries + "\n};\n"
        + f"publishLegacy({json.dumps(filename)}, __asdhLegacyApi);\n"
        + ("export {\n  " + exports + "\n};\n" if valid_functions else "")
        + "export const legacyVariableNames = Object.freeze(" + json.dumps(valid_variables) + ");\n"
        + "export default __asdhLegacyApi;\n"
    )


def main() -> None:
    CORE.mkdir(parents=True, exist_ok=True)
    current_main = (JS / "main.js").read_text(encoding="utf-8") if (JS / "main.js").exists() else ""
    ordered_names = re.findall(r"import ['\"]\.\/modules\/([^?'\"]+)(?:\?[^'\"]*)?['\"]", current_main)
    available = {path.name: path for path in MODULES.glob("*.js")}
    module_files = [available[name] for name in ordered_names if name in available]
    module_files.extend(path for name, path in sorted(available.items()) if name not in ordered_names)
    if not module_files:
        raise SystemExit("No application modules found")

    provider_report = {}
    for path in module_files:
        source = path.read_text(encoding="utf-8")
        source = re.sub(r"^import \{ publishLegacy \} from '../core/legacy-registry\.js';\n\n", "", source)
        source = re.sub(r"\n\nconst __asdhLegacyApi = \{.*\Z", "", source, flags=re.S)
        source = re.sub(r"\nexport \{\};\n?\Z", "\n", source)
        source = re.sub(r"^/\* ASDHealth R6\.65 Modular.*?\*/\s*", "", source, count=1, flags=re.S)
        if path.name in PROVIDERS:
            provider = transform_provider(source)
            source = str(provider['source'])
            functions = list(provider['functions'])
            variables = list(provider['variables'])
            provider_report[path.name] = {"functions": functions, "variables": variables}
            source = "import { publishLegacy } from '../core/legacy-registry.js';\n\n" + source
            source += provider_footer(path.name, functions, variables)
        elif not re.search(r"\bexport\s+", source):
            # Keep generated feature modules byte-for-byte stable across builds.
            # The previous append preserved an extra trailing newline each run.
            source = source.rstrip() + "\n\nexport {};\n"
        path.write_text(source, encoding="utf-8")

    index_path = PUBLIC / "index.html"
    html = index_path.read_text(encoding="utf-8")
    html = SCRIPT_RE.sub("", html)
    html = MAIN_SCRIPT_RE.sub("", html)
    bindings_path = CORE / "event-bindings.js"
    existing_bindings = []
    json_path = CORE / "event-bindings.json"
    if json_path.exists() and "data-asdh-binding" in html:
        existing_bindings = json.loads(json_path.read_text(encoding="utf-8"))
    elif bindings_path.exists() and "data-asdh-binding" in html:
        binding_text = bindings_path.read_text(encoding="utf-8")
        existing_bindings = json.loads(re.sub(r"^export default\s+|;\s*$", "", binding_text, flags=re.S))
    html = re.sub(r"/\s+(data-asdh-binding=)", r"\1", html)
    html = re.sub(
        r'data-asdh-binding="([^"]+)"\s+data-asdh-binding="([^"]+)"',
        lambda match: f'data-asdh-binding="{match.group(1)} {match.group(2)}"',
        html,
    )
    html, bindings = migrate_handlers(html, existing_bindings)
    html = html.replace("multi-file-classic-modules-v1", "es-modules-v3")
    html = html.replace("es-modules-v2", "es-modules-v3")
    html = re.sub(r"main\.js\?v=[^\"']+", f"main.js?v={BUILD_VERSION}", html)
    entry = f'<script type="module" src="./assets/js/main.js?v={BUILD_VERSION}"></script>'
    html = html.replace("</body>", entry + "\n</body>")
    index_path.write_text(html, encoding="utf-8")

    imports = "\n".join(f"import './modules/{path.name}?v={BUILD_VERSION}';" for path in module_files)
    (JS / "main.js").write_text(
        f"/* ASDHealth {BUILD_VERSION} ES-module entrypoint. Import order is intentional. */\n"
        f"import './core/legacy-registry.js?v={BUILD_VERSION}';\n"
        f"import './core/runtime-health.js?v={BUILD_VERSION}';\n" + imports + "\n"
        f"import {{ installDomBindings }} from './core/dom-bindings.js?v={BUILD_VERSION}';\n"
        "const requiredActions = ['doLogin','startApp','r17CrashExecuteBulk','renderMedicationAccountability','r664OpenSealCorrection','fsCanWriteStateKey'];\n"
        "const missingActions = requiredActions.filter((name) => typeof globalThis[name] !== 'function');\n"
        "document.documentElement.dataset.asdhMissingActions = missingActions.join(',');\n"
        "if (missingActions.length) throw new Error(`Missing application actions: ${missingActions.join(', ')}`);\n"
        "installDomBindings();\n"
        "document.documentElement.dataset.asdhModules = 'ready';\n"
        "window.__asdhRuntime?.state && (window.__asdhRuntime.state.readyAt = Date.now());\n"
        "window.__asdhRuntime?.mark('application');\n"
        "export const architecture = 'es-modules-v3';\n",
        encoding="utf-8",
    )

    binding_source = "export default " + json.dumps(bindings, indent=2, ensure_ascii=False) + ";\n"
    bindings_path.write_text(binding_source, encoding="utf-8")
    if json_path.exists():
        json_path.unlink()
    root_html = html.replace('./assets/', './public/assets/')
    (ROOT / 'index.html').write_text(root_html, encoding='utf-8')
    manifest_path = ROOT / 'module-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['build'] = f'{BUILD_VERSION} ES Modules Protected'
    manifest['architecture'] = 'Native ES modules with ordered imports, centralized runtime health, explicit provider exports, a constrained legacy registry, and external DOM event bindings.'
    manifest['entrypoint'] = 'assets/js/main.js'
    manifest['staticEventBindings'] = len(bindings)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (ROOT / "docs" / "es-module-report.json").write_text(
        json.dumps({"providers": provider_report, "staticEventBindings": len(bindings), "modules": len(module_files)}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(module_files)} ES modules and migrated {len(bindings)} static event handlers.")


if __name__ == "__main__":
    main()
