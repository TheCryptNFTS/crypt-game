#!/usr/bin/env bash
# watchdog.sh — Crypt health gate. Detect-and-verify, NOT auto-fix.
# Runs the cheap truth-checks and prints a single PASS/FAIL summary so a human
# (or a scheduled check) can see at a glance whether the build is still sound.
# Catches the "node gate green but app broke" class only partially — it does NOT
# replace a live full-width browser play-test (flagged in the summary).
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

ts() { date "+%H:%M:%S"; }
fail=0
declare -a results

run() { # name, command...
  local name="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    results+=("PASS  $name")
  else
    results+=("FAIL  $name")
    fail=1
    # keep the last few lines of the failure for context
    echo "----- $name failure (tail) -----"
    echo "$out" | tail -8
  fi
}

echo "== CRYPT WATCHDOG $(ts) =="

# 1) Types compile.
run "tsc"            npx tsc --noEmit

# 2) Full engine regression (the 1700+ proof suite).
run "regression"    npm run --silent dev:regression

# 3) Production build succeeds (catches CSS syntax + dead refs node misses).
run "build"         npx vite build

# 4) Cheap crash/exploit greps — fast static smells, not a substitute for play.
#    Dangling refs, raw innerHTML/eval, and stray off-brand cyan.
smell=0
if grep -rEn "dangerouslySetInnerHTML|[^a-zA-Z]eval\(|innerHTML\s*=" src/ >/dev/null 2>&1; then
  echo "SMELL: raw innerHTML/eval present (xss surface — verify each)"; smell=1
fi
if grep -rEn "#5fd4f0|#5fdf" src/ --include=*.css | grep -v "cb-ally\|colorblind" >/dev/null 2>&1; then
  echo "SMELL: off-brand cyan in css"; smell=1
fi
[ "$smell" -eq 0 ] && results+=("PASS  static-smells") || results+=("WARN  static-smells")

echo
echo "== SUMMARY $(ts) =="
printf '%s\n' "${results[@]}"
echo "NOTE: green here does NOT prove the live UI works — full-width browser"
echo "play-test is still required for anything visual/interactive."
exit "$fail"
