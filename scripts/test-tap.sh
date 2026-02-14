#!/usr/bin/env bash
# ============================================================
#  BOTCHA TAP End-to-End Test
#  Runs the full TAP flow: app -> agent -> list -> session
# ============================================================
set -euo pipefail

URL="https://botcha.ai"
BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
CYAN="\033[36m"
RESET="\033[0m"

step() { echo -e "\n${BOLD}${CYAN}[$1/5]${RESET} ${BOLD}$2${RESET}"; }

# ── 1. Create an app (only step that needs curl) ─────────────
step 1 "Creating app..."
APP_JSON=$(curl -sf -X POST "$URL/v1/apps" \
  -H "Content-Type: application/json" \
  -d '{"email":"tap-test@botcha.ai"}')

APP_ID=$(echo "$APP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['app_id'])")
echo -e "   ${DIM}app_id:${RESET} $APP_ID"

# ── 2. Register a TAP agent ──────────────────────────────────
step 2 "Registering TAP agent..."
botcha tap register \
  --url "$URL" \
  --app-id "$APP_ID" \
  --name "tap-test-$(date +%s)" \
  --operator "test-script" \
  --trust-level basic \
  --json > /tmp/botcha-agent.json

AGENT_ID=$(python3 -c "import json; print(json.load(open('/tmp/botcha-agent.json'))['agent_id'])")
echo -e "   ${DIM}agent_id:${RESET} $AGENT_ID"

# ── 3. Get agent details ─────────────────────────────────────
step 3 "Getting agent details..."
botcha tap get --url "$URL" --agent-id "$AGENT_ID"

# ── 4. List agents ───────────────────────────────────────────
step 4 "Listing agents for app..."
botcha tap list --url "$URL" --app-id "$APP_ID"

# ── 5. Create a TAP session ─────────────────────────────────
# Need capabilities — register a capable agent via curl, then session via CLI
CAPABLE_JSON=$(curl -sf -X POST "$URL/v1/agents/register/tap?app_id=$APP_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"capable-agent-$(date +%s)\",
    \"operator\": \"test-script\",
    \"capabilities\": [{\"action\": \"browse\", \"scope\": [\"*\"]}],
    \"trust_level\": \"basic\"
  }")
CAPABLE_ID=$(echo "$CAPABLE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['agent_id'])")

step 5 "Creating TAP session..."
botcha tap session \
  --url "$URL" \
  --agent-id "$CAPABLE_ID" \
  --intent '{"action":"browse","resource":"products","duration":3600}' \
  --user-context "test-user-hash"

echo -e "\n${GREEN}${BOLD}All 5 steps passed.${RESET}\n"
