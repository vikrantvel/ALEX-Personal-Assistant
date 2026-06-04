#!/bin/bash
# Stark Industries ALEX Core Launcher
# Boots the backend uvicorn server and opens ALEX HUD in Chrome app-mode for full voice support.

# Change directory to the workspace folder automatically
cd "$(dirname "$0")"

clear
echo -e "\033[0;36m=========================================================\033[0m"
echo -e "\033[1;36m       STARK INDUSTRIES // ALEX CORE LAUNCHER            \033[0m"
echo -e "\033[0;36m=========================================================\033[0m"
echo ""

# Check if server is already running on port 8000
if lsof -i :8000 >/dev/null 2>&1; then
    echo -e "\033[0;32m[SYSTEM]: ALEX backend core is already active on port 8000.\033[0m"
else
    echo -e "\033[0;33m[SYSTEM]: Booting background uvicorn server, Sir...\033[0m"
    python3 server.py > /dev/null 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > .server.pid
    sleep 2
fi

# Launch in Chrome app-mode (full Web Speech API support) or fallback to default browser
CHROME_APP="/Applications/Google Chrome.app"
if [ -d "$CHROME_APP" ]; then
    echo -e "\033[0;36m[SYSTEM]: Launching ALEX HUD in Chrome app-mode window (full voice support)...\033[0m"
    open -na "$CHROME_APP" --args --app=http://127.0.0.1:8000 --window-size=1280,820 --disable-extensions --autoplay-policy=no-user-gesture-required
else
    echo -e "\033[0;36m[SYSTEM]: Launching ALEX HUD in default browser...\033[0m"
    open http://localhost:8000
fi

echo ""
echo -e "\033[1;32mALEX is fully online and at your service.\033[0m"
echo -e "\033[0;90m(Keep this terminal window open in the background to sustain the core session.)\033[0m"
echo ""
echo -e "\033[0;31mPress Ctrl+C at any time to cleanly shut down and exit ALEX.\033[0m"
echo ""

# Catch close triggers to cleanly kill uvicorn
cleanup() {
    echo ""
    echo -e "\033[0;33m[SYSTEM]: Deactivating background cores, Sir...\033[0m"
    if [ -f .server.pid ]; then
        PID=$(cat .server.pid)
        kill $PID >/dev/null 2>&1
        rm .server.pid
    fi
    pkill -f "python3 server.py" >/dev/null 2>&1
    echo -e "\033[0;32m[SYSTEM]: ALEX offline. Farewell, Sir.\033[0m"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Idle holding loop
while true; do
    sleep 1
done
