import os
import sys
import threading
import time
import subprocess
import uvicorn
from server import app

import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_fastapi():
    """Starts uvicorn FastAPI server on local loopback interface."""
    config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="info")
    server = uvicorn.Server(config)
    server.run()

def open_browser_window():
    """
    Opens ALEX HUD in Google Chrome app mode (dedicated window, no tabs/URL bar)
    for full Web Speech Recognition API support.
    Falls back to default browser if Chrome is not installed.
    """
    url = "http://127.0.0.1:8000"
    
    chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    
    for chrome_path in chrome_paths:
        if os.path.exists(chrome_path):
            print(f"[SYSTEM]: Launching ALEX in Chromium app-mode window: {os.path.basename(chrome_path)}")
            subprocess.Popen([
                chrome_path,
                f"--app={url}",
                "--window-size=1280,820",
                "--disable-extensions",
                "--disable-infobars",
                "--autoplay-policy=no-user-gesture-required",
            ])
            return True
    
    # Fallback: open in default browser
    print("[SYSTEM]: No Chromium browser found. Opening ALEX in default browser...")
    subprocess.Popen(["open", url])
    return False

if __name__ == "__main__":
    # Start the backend server if not already active on port 8000
    if not is_port_in_use(8000):
        server_thread = threading.Thread(target=start_fastapi, daemon=True)
        server_thread.start()
        # Wait for server to bind
        print("[SYSTEM]: Booting ALEX backend core...")
        time.sleep(1.5)
    else:
        print("[SYSTEM]: ALEX backend core already active on port 8000.")
    
    # Launch dedicated Chrome app-mode window
    open_browser_window()
    
    print("[SYSTEM]: ALEX is fully online and at your service, Sir.")
    print("[SYSTEM]: Press Ctrl+C to shut down ALEX cores.")
    
    # Keep process alive until interrupted
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[SYSTEM]: Deactivating ALEX cores. Farewell, Sir.")
        os._exit(0)
