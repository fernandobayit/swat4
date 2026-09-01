#!/bin/bash
set -e

BASE="http://localhost:8000/api"
PASS=0
FAIL=0

check() {
    local test_name="$1"
    local expected_code="$2"
    local actual_code="$3"
    local body="$4"
    if [ "$actual_code" = "$expected_code" ]; then
        echo "  ✅ $test_name (HTTP $actual_code)"
        PASS=$((PASS+1))
    else
        echo "  ❌ $test_name (expected $expected_code, got $actual_code)"
        echo "     Body: $body"
        FAIL=$((FAIL+1))
    fi
}

echo "🔑 LOGIN"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"administrator\",\"password\":\"${SAMBA_ADMIN_PASSWORD:?Set SAMBA_ADMIN_PASSWORD env var}\"}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Login as administrator" "200" "$CODE" "$BODY"
TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
    echo "❌ FATAL: Could not get token. Aborting."
    exit 1
fi

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "════════════════════════════════════════"
echo "👤 USERS"
echo "════════════════════════════════════════"

echo "  📋 List users"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE/users" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
check "List users" "200" "$CODE"

echo "  ➕ Create user"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X POST "$BASE/users" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"username":"test.crud","password":"Test@12345","given_name":"Test","surname":"CRUD","email":"test@swat.local"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Create user test.crud" "200" "$CODE" "$BODY"

echo "  🔍 Get user"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE/users/test.crud" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
check "Get user test.crud" "200" "$CODE"

echo "  🚫 Disable user"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X PUT "$BASE/users/test.crud" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"enabled":false}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Disable user test.crud" "200" "$CODE" "$BODY"

echo "  ✅ Enable user"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X PUT "$BASE/users/test.crud" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"enabled":true}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Enable user test.crud" "200" "$CODE" "$BODY"

echo "  🗑️  Delete user"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X DELETE "$BASE/users/test.crud" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Delete user test.crud" "200" "$CODE" "$BODY"

echo ""
echo "════════════════════════════════════════"
echo "👥 GROUPS"
echo "════════════════════════════════════════"

echo "  📋 List groups"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE/groups" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
check "List groups" "200" "$CODE"

echo "  ➕ Create group"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X POST "$BASE/groups" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"TestCrudGroup","description":"Testing CRUD","group_type":"Security"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Create group TestCrudGroup" "200" "$CODE" "$BODY"

echo "  🗑️  Delete group"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X DELETE "$BASE/groups/TestCrudGroup" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Delete group TestCrudGroup" "200" "$CODE" "$BODY"

echo ""
echo "════════════════════════════════════════"
echo "📋 GPOs"
echo "════════════════════════════════════════"

echo "  📋 List GPOs"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE/gpos" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "List GPOs" "200" "$CODE" "$BODY"

echo "  ➕ Create GPO"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X POST "$BASE/gpos" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"display_name":"Test CRUD Policy"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Create GPO" "200" "$CODE" "$BODY"
GPO_GUID=$(echo "$BODY" | python3 -c "import sys,json,re; m=re.search(r'\{[A-F0-9-]+\}', json.load(sys.stdin).get('detail','')); print(m.group() if m else '')" 2>/dev/null || echo "")
echo "     GPO GUID: $GPO_GUID"

if [ -n "$GPO_GUID" ]; then
    echo "  🗑️  Delete GPO"
    RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X DELETE "$BASE/gpos/$GPO_GUID" -H "$AUTH")
    CODE=$(echo "$RESP" | tail -1)
    BODY=$(echo "$RESP" | head -1)
    check "Delete GPO $GPO_GUID" "200" "$CODE" "$BODY"
fi

echo ""
echo "════════════════════════════════════════"
echo "📁 SHARES"
echo "════════════════════════════════════════"

echo "  📋 List shares"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE/shares" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
check "List shares" "200" "$CODE"

echo "  ➕ Create share"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X POST "$BASE/shares" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"testshare","path":"/srv/test","comment":"Test Share","read_only":false,"browseable":true,"guest_ok":false}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Create share testshare" "200" "$CODE" "$BODY"

echo "  ✏️  Update share"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X PUT "$BASE/shares/testshare" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"comment":"Updated Test Share","read_only":true}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Update share testshare" "200" "$CODE" "$BODY"

echo "  🗑️  Delete share"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X DELETE "$BASE/shares/testshare" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "Delete share testshare" "200" "$CODE" "$BODY"

echo ""
echo "════════════════════════════════════════"
echo "📜 LOGS"
echo "════════════════════════════════════════"

echo "  📋 List log files"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE/logs/files" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
check "List log files" "200" "$CODE" "$BODY"

LOGFILE=$(echo "$BODY" | python3 -c "import sys,json; f=json.load(sys.stdin); print(f[0] if f else '')" 2>/dev/null || echo "")
if [ -n "$LOGFILE" ]; then
    echo "  📖 Read log: $LOGFILE"
    RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE/logs/$LOGFILE?lines=50" -H "$AUTH")
    CODE=$(echo "$RESP" | tail -1)
    check "Read log $LOGFILE" "200" "$CODE"
fi

echo ""
echo "════════════════════════════════════════"
echo "🌳 OUs"
echo "════════════════════════════════════════"

echo "  📋 List OUs"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE/ous" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
check "List OUs" "200" "$CODE"

echo ""
echo "════════════════════════════════════════"
echo "📊 RESULTS"
echo "════════════════════════════════════════"
TOTAL=$((PASS+FAIL))
echo "  Total: $TOTAL tests"
echo "  ✅ Passed: $PASS"
echo "  ❌ Failed: $FAIL"
if [ "$FAIL" -eq 0 ]; then
    echo "  🎉 ALL TESTS PASSED!"
else
    echo "  ⚠️  Some tests failed. Check output above."
fi
