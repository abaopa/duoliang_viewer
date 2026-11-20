#!/bin/bash
# ==============================================================================
# Duoliang Station Live Stream Viewer Daemon Manager (macOS Launchd)
# ==============================================================================

SERVICE_NAME="com.streamviewers.duoliang_viewer"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8081

# Check local venv first, then parent venv, then system python
if [ -f "$SCRIPT_DIR/.venv/bin/python3" ]; then
    PYTHON_EXEC="$SCRIPT_DIR/.venv/bin/python3"
elif [ -f "$SCRIPT_DIR/../.venv/bin/python3" ]; then
    PYTHON_EXEC="$(cd "$SCRIPT_DIR/.." && pwd)/.venv/bin/python3"
else
    PYTHON_EXEC="$(which python3)"
fi

generate_plist() {
    mkdir -p "$HOME/Library/LaunchAgents"
    mkdir -p "$SCRIPT_DIR/logs" 2>/dev/null || true
    
    cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${PYTHON_EXEC}</string>
        <string>${SCRIPT_DIR}/duoliang_viewer.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${SCRIPT_DIR}/duoliang_viewer_stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${SCRIPT_DIR}/duoliang_viewer_stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF
    echo "✅ Generated plist file at $PLIST_PATH"
}

start_daemon() {
    echo "🚀 Starting Duoliang Station Live Stream Viewer daemon (Port $PORT)..."
    generate_plist
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load -w "$PLIST_PATH"
    echo "✅ Daemon started. Access the UI at: http://localhost:$PORT"
}

stop_daemon() {
    echo "🛑 Stopping Duoliang Station Live Stream Viewer daemon..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    echo "✅ Daemon stopped."
}

status_daemon() {
    echo "📊 Status of Duoliang Station Live Stream Viewer:"
    if launchctl list | grep -q "$SERVICE_NAME"; then
        echo "🟢 Daemon is RUNNING via launchd."
    else
        echo "🔴 Daemon is NOT running."
    fi
    echo ""
    echo "Port $PORT binding check:"
    lsof -i ":$PORT" || echo "No process currently bound to port $PORT."
}

case "$1" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    restart)
        stop_daemon
        sleep 1
        start_daemon
        ;;
    status)
        status_daemon
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
