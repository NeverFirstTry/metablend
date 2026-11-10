#!/usr/bin/env bash
# The morning store capture on a Mac, unattended: bash scripts/store-run.sh   (or: bash scripts/store-run.sh now)
#  - keeps the Mac awake (caffeinate; plugged in, lid open) and waits until 08:17 Vienna time,
#    unless it is already between 08:17 and 11:00 there, or "now" is given
#  - builds, starts next on :3123 and captures with the forecast data from production, gently: the pages'
#    own requests go to production (DATA=https://metablend.app), each answer asked for once per run and
#    reused by every language and device, one request at a time; the server's render reads production's
#    cached API too (SELF_BASE=https://metablend.app), so this Mac never calls the forecast providers.
#    Every check of scripts/store-shots.mjs: captions, 18+ sources,
#    no "No favourable …", caption lines, image sizes
#  - screens 1 to 3 and the Play feature graphic first, then screens 4 and 5: the peaks right above
#    Lienz, lowest first (Hochstein, Spitzkofel, Schleinitz, Hoher Prijakt, Petzeck), then Großglockner,
#    Großvenediger, Zugspitze; while none has an open summit window and a favourable start, 4 and 5 are
#    tried again every 30 minutes until 11:00. The iPhone set renders in SF Pro, the Android set in an
#    Android phone's fonts (Hanken Grotesk, Noto Sans CJK, Roboto behind them)
#  - a thin blend (Vienna with fewer than 18 sources) is waited out, up to about 25 minutes, see store-shots.mjs
#  - stops the server and writes store/run/summary.txt (the full log next to it). Commits nothing.
# Again for some languages only, screens 1 to 3 and the feature graphic, without screens 4 and 5:
#   LANGS="nl pl cs sl pt ja zh ko" ONLY13=1 bash scripts/store-run.sh now
# Screens 1 and 2 show Vienna's sky: run them between 08:00 and 15:20 Vienna time, as the morning run does.
set -u
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$SELF")/.."

# stay awake for the whole run: re-run under caffeinate (-i idle sleep, -s system sleep on power)
if [ -z "${STORE_RUN_AWAKE:-}" ] && command -v caffeinate >/dev/null 2>&1; then
  STORE_RUN_AWAKE=1 exec caffeinate -is bash "$SELF" "$@"
fi

RUN=store/run
mkdir -p "$RUN"
LOG="$RUN/$(date +%Y-%m-%d-%H%M).log"
SUMMARY="$RUN/summary.txt"
: > "$LOG"
log() { echo "$(vienna) $*" | tee -a "$LOG"; }
# Vienna wall-clock time, and minutes since midnight there
vienna() { node -e 'console.log(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Vienna", hour12: false }))'; }
vienna_min() { node -e 'const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vienna", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map(x => [x.type, x.value])); console.log(+p.hour * 60 + +p.minute)'; }
START=$((8 * 60 + 17)); STOP=$((11 * 60))

fail() { log "STOPPED: $*"; printf 'MetaBlend store run, %s\nSTOPPED before capturing: %s\nLog: %s\n' "$(date +%Y-%m-%d)" "$*" "$LOG" > "$SUMMARY"; exit 1; }

# ── checks before waiting, so a missing piece shows tonight, not at 08:17 ──
node -e 'process.exit(typeof WebSocket === "function" ? 0 : 1)' || fail "Node 22 or newer is needed (node -v: $(node -v))"
[ -f .env.local ] || fail ".env.local is missing in $(pwd) (copy it over from the PC, never commit it)"
[ -d node_modules/next ] || fail "node_modules is missing: run npm ci first"
if [ -z "${EDGE:-}" ]; then
  # Playwright's Chromium (npx playwright install chromium), else an installed Chrome or Edge
  for b in "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/MacOS/* \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
    if [ -x "$b" ]; then EDGE="$b"; break; fi
  done
fi
[ -n "${EDGE:-}" ] && [ -x "$EDGE" ] || fail "no browser found: run npx playwright@1.50.1 install chromium, or set EDGE=/path/to/chrome"
export EDGE DATA=https://metablend.app
lsof -i :3123 -sTCP:LISTEN >/dev/null 2>&1 && fail "port 3123 is already in use"
log "branch $(git branch --show-current) at $(git rev-parse --short HEAD); browser: $EDGE"

# ── wait for 08:17 Vienna time ──
now=$(vienna_min)
if [ "${1:-}" != "now" ] && { [ "$now" -lt "$START" ] || [ "$now" -ge "$STOP" ]; }; then
  wait=$(( (START - now + 1440) % 1440 ))
  log "waiting $((wait / 60)) h $((wait % 60)) min until 08:17 Vienna time"
  sleep $((wait * 60))
  while [ "$(vienna_min)" -lt "$START" ]; do sleep 20; done
fi
STARTED=$(vienna)

# ── build and start the server ──
log "building"
npx next build >> "$LOG" 2>&1 || fail "next build failed (see $LOG)"
SELF_BASE=https://metablend.app node node_modules/next/dist/bin/next start -p 3123 >> "$LOG" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3123/more && break; sleep 1; done
curl -s -o /dev/null http://localhost:3123/more || fail "the server on :3123 did not start (see $LOG)"
log "server up on :3123"

# ── screens 1 to 3 and the feature graphic ──
log "screens 1-3 (${LANGS:-every language}) and the feature graphic"
# LANGS unquoted on purpose: one argument per language
if SHOTS=1,2,3 node scripts/store-shots.mjs ${LANGS:-} >> "$LOG" 2>&1 && SHOTS=feature node scripts/store-shots.mjs en >> "$LOG" 2>&1; then A="ok"; else A="FAILED (exit $?), see the log"; fi
log "screens 1-3 + feature graphic: $A"

# ── screens 4 and 5, again every 30 minutes until 11:00 while no window is open ──
tries=0; B=""
[ -n "${ONLY13:-}" ] && B="not run (ONLY13)"
while [ -z "${ONLY13:-}" ]; do
  tries=$((tries + 1))
  log "screens 4 and 5, try $tries"
  SHOTS=4,5 node scripts/store-shots.mjs >> "$LOG" 2>&1; code=$?
  if [ $code -eq 0 ]; then
    B="ok at $(vienna) (try $tries): $(grep -o 'screens 4 and 5: .*' "$LOG" | tail -1 | sed 's/^screens 4 and 5: //')"
    break
  fi
  why=$([ $code -eq 3 ] && echo "no peak with an open summit window and a favourable start" || echo "failed (exit $code)")
  log "screens 4 and 5: $why"
  if [ $(( $(vienna_min) + 30 )) -ge "$STOP" ]; then B="NOT captured by 11:00 ($tries tries; last: $why)"; break; fi
  sleep 1800
done

# ── stop and sum up ──
kill $SERVER 2>/dev/null; wait $SERVER 2>/dev/null; trap - EXIT
changed=$(git status --porcelain -- fastlane | grep -c '\.png')
{
  echo "MetaBlend store run, $(date +%Y-%m-%d)"
  echo "branch $(git branch --show-current) at $(git rev-parse --short HEAD); started $STARTED, finished $(vienna) (Vienna)"
  echo "screens 1-3 (${LANGS:-every language}) + feature graphic: $A"
  echo "screens 4 and 5: $B"
  echo "images changed under fastlane/: $changed (nothing committed)"
  echo "requests to production per capture:"
  grep 'production API:' "$LOG" | sed 's/^/  /'
  echo "errors in the log:"
  grep -E 'not ready|Error|shows "' "$LOG" | tail -8 | sed 's/^/  /'
  echo "log: $LOG"
} > "$SUMMARY"
log "done: $SUMMARY"
cat "$SUMMARY"
