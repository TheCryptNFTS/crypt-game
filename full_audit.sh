#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/audit_$STAMP"

mkdir -p "$OUT"

echo "Writing audit to: $OUT"

# --------------------------------------------------
# 0) basic project info
# --------------------------------------------------
{
  echo "ROOT: $ROOT"
  echo "DATE: $(date)"
  echo "NODE: $(node -v 2>/dev/null || true)"
  echo "NPM: $(npm -v 2>/dev/null || true)"
  echo
  echo "GIT STATUS"
  git status --short 2>/dev/null || true
  echo
  echo "TOP LEVEL"
  find . -maxdepth 2 -mindepth 1 | sort
} > "$OUT/00_project_info.txt"

# --------------------------------------------------
# 1) full TS/TSX/file inventory
# --------------------------------------------------
find src -type f | sort > "$OUT/01_src_files.txt"
find . -maxdepth 3 -type f \( -name "*.json" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | sort > "$OUT/02_code_and_json_files.txt"

# --------------------------------------------------
# 2) compile check
# --------------------------------------------------
(npx tsc --noEmit > "$OUT/03_tsc_stdout.txt" 2> "$OUT/03_tsc_stderr.txt" || true)

# --------------------------------------------------
# 3) search for legacy/fake commander junk
# --------------------------------------------------
{
  echo "=== fake commander ids / names ==="
  rg -n "cmd_stone_warden|cmd_iron_warlord|cmd_bronze_raider|cmd_silver_oracle|cmd_golden_emperor|Stone Warden|Iron Warlord|Bronze Raider|Silver Oracle|Golden Emperor" src . || true
  echo
  echo "=== commanderOgMap ==="
  rg -n "commanderOgMap|COMMANDER_OG_MAP" src . || true
  echo
  echo "=== old commander specs ==="
  rg -n "COMMANDER_SPECS|generatedCommanderSpecs|allCommanders" src . || true
} > "$OUT/04_legacy_commander_checks.txt"

# --------------------------------------------------
# 4) search for old dead data-source usage
# --------------------------------------------------
{
  echo "=== curatedCoreSet ==="
  rg -n "curatedCoreSet" src . || true
  echo
  echo "=== runtimeMatchUnits / units.json / baseUnits ==="
  rg -n "runtimeMatchUnits|units.json|baseUnits" src . || true
  echo
  echo "=== generatedTcgCards ==="
  rg -n "generatedTcgCards" src . || true
  echo
  echo "=== generatedNftCards ==="
  rg -n "generatedNftCards" src . || true
  echo
  echo "=== openseaAssets ==="
  rg -n "openseaAssets" src . || true
} > "$OUT/05_data_source_checks.txt"

# --------------------------------------------------
# 5) TODO/FIXME/HACK/XXX scan
# --------------------------------------------------
rg -n "TODO|FIXME|HACK|XXX|TEMP|temporary|debug only|remove me" src . > "$OUT/06_todo_fixme_scan.txt" || true

# --------------------------------------------------
# 6) biggest files
# --------------------------------------------------
python3 - <<'PY' > "$OUT/07_biggest_files.txt"
from pathlib import Path
files = []
for p in Path(".").rglob("*"):
    if p.is_file():
        try:
            files.append((p.stat().st_size, str(p)))
        except:
            pass
for size, path in sorted(files, reverse=True)[:200]:
    print(f"{size:>12}  {path}")
PY

# --------------------------------------------------
# 7) duplicate-ish filenames
# --------------------------------------------------
python3 - <<'PY' > "$OUT/08_duplicate_basenames.txt"
from pathlib import Path
from collections import defaultdict
m = defaultdict(list)
for p in Path(".").rglob("*"):
    if p.is_file():
        m[p.name].append(str(p))
for name, paths in sorted(m.items()):
    if len(paths) > 1:
        print(f"\n=== {name} ({len(paths)}) ===")
        for x in paths:
            print(x)
PY

# --------------------------------------------------
# 8) runtime source sanity checks
# --------------------------------------------------
python3 - <<'PY' > "$OUT/09_runtime_source_sanity.txt"
import json
from pathlib import Path

def load(path):
    p = Path(path)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception as e:
        return {"__error__": str(e)}

targets = [
    "src/data/runtimeMatchPlayableCards.json",
    "src/data/generatedTcgCards.json",
    "src/data/openseaAssets.json",
    "src/data/commanders.json",
]

for t in targets:
    print(f"\n=== {t} ===")
    data = load(t)
    if data is None:
        print("MISSING")
        continue
    if isinstance(data, dict):
        print("TYPE: dict")
        print("KEYS:", list(data.keys())[:20])
        for k, v in data.items():
            if isinstance(v, list):
                print(f"LIST {k}: {len(v)}")
    elif isinstance(data, list):
        print("TYPE: list")
        print("LEN:", len(data))
        if data:
            first = data[0]
            print("FIRST ITEM TYPE:", type(first).__name__)
            print("FIRST ITEM:", first if isinstance(first, (str, int, float)) else str(first)[:800])
    else:
        print("TYPE:", type(data).__name__)
        print(str(data)[:800])
PY

# --------------------------------------------------
# 9) import graph + likely dead TS/TSX files
# --------------------------------------------------
python3 - <<'PY' > "$OUT/10_unreferenced_ts_files.txt"
from pathlib import Path
import re

root = Path(".").resolve()
src_root = (root / "src").resolve()

ts_files = [p.resolve() for p in src_root.rglob("*") if p.suffix in {".ts", ".tsx"}]
ts_files_set = set(ts_files)

import_re = re.compile(r'''from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)''')

refs = {p: set() for p in ts_files}
reverse = {p: set() for p in ts_files}

def resolve_import(base, spec):
    if not spec or not spec.startswith("."):
        return None
    raw = (base.parent / spec)
    candidates = [
        raw.with_suffix(".ts"),
        raw.with_suffix(".tsx"),
        raw / "index.ts",
        raw / "index.tsx",
    ]
    for c in candidates:
        c = c.resolve()
        if c in ts_files_set:
            return c
    return None

for f in ts_files:
    try:
        txt = f.read_text()
    except:
        continue
    found = []
    for m in import_re.finditer(txt):
        spec = m.group(1) or m.group(2)
        found.append(spec)
    for spec in found:
        r = resolve_import(f, spec)
        if r:
            refs[f].add(r)
            reverse[r].add(f)

entry_like = []
for p in ts_files:
    s = str(p)
    name = p.name.lower()
    if any(part in s for part in [
        "/main.", "/index.", "/server.", "/vite.config", "/vitest.config",
        "/setup.", "/createMatchFromDecks.", "/commanders.", "/cards."
    ]):
        entry_like.append(p)
    if "/src/dev/" in s:
        entry_like.append(p)

entry_like = set(entry_like)

print("=== likely unreferenced ts/tsx files (heuristic only) ===")
for p in sorted(ts_files):
    if reverse[p]:
        continue
    if p in entry_like:
        continue
    print(p.relative_to(root))

print("\n=== reverse import counts ===")
for p in sorted(ts_files):
    print(f"{len(reverse[p]):>3}  {p.relative_to(root)}")
PY

# --------------------------------------------------
# 10) exported symbols that look unused by grep
# crude but useful
# --------------------------------------------------
python3 - <<'PY' > "$OUT/11_unused_export_candidates.txt"
from pathlib import Path
import re

files = [p for p in Path("src").rglob("*") if p.suffix in {".ts", ".tsx"}]
all_text = {}
for f in files:
    try:
        all_text[f] = f.read_text()
    except:
        all_text[f] = ""

export_re = re.compile(r'export\s+(?:function|const|class|type|interface|enum)\s+([A-Za-z0-9_]+)')
for f, txt in all_text.items():
    names = export_re.findall(txt)
    if not names:
        continue
    for name in names:
        hits = 0
        for of, otxt in all_text.items():
            hits += otxt.count(name)
        if hits <= 1:
            print(f"{f}: {name}")
PY

# --------------------------------------------------
# 11) key file snapshots
# --------------------------------------------------
for f in \
  src/engine/cards.ts \
  src/engine/commanders.ts \
  src/engine/createMatchFromDecks.ts \
  src/engine/setup.ts \
  src/engine/effectSystem.ts \
  src/engine/applyCommanderCardModifiers.ts \
  src/lib/getCommanderBonuses.ts \
  src/lib/getCommanderCardSynergy.ts \
  src/types/faction.ts \
  src/data/loadAllUnits.ts
do
  if [ -f "$f" ]; then
    {
      echo "===== $f ====="
      sed -n '1,260p' "$f"
    } > "$OUT/$(echo "$f" | tr '/' '_').snapshot.txt"
  fi
done

# --------------------------------------------------
# 12) produce a short summary
# --------------------------------------------------
python3 - <<'PY' > "$OUT/99_summary.txt"
from pathlib import Path

root = Path(".")
out = next(sorted([p for p in root.iterdir() if p.is_dir() and p.name.startswith("audit_")], reverse=True), None)

print("Audit complete.")
print("Main files to inspect:")
for name in [
    "03_tsc_stderr.txt",
    "04_legacy_commander_checks.txt",
    "05_data_source_checks.txt",
    "10_unreferenced_ts_files.txt",
    "11_unused_export_candidates.txt",
]:
    print("-", name)
PY

echo
echo "AUDIT COMPLETE -> $OUT"
echo
echo "Open these first:"
echo "  $OUT/03_tsc_stderr.txt"
echo "  $OUT/04_legacy_commander_checks.txt"
echo "  $OUT/05_data_source_checks.txt"
echo "  $OUT/10_unreferenced_ts_files.txt"
echo "  $OUT/11_unused_export_candidates.txt"
