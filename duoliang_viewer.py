import os
import re
import time
import json
import threading
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, HTTPException, status, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
from typing import Optional
import cv2
import numpy as np

import sys

# Add project root to sys.path to allow imports from shared module
project_root = str(Path(__file__).resolve().parents[1])
if project_root not in sys.path:
    sys.path.append(project_root)

script_dir = Path(__file__).resolve().parent

# Import logger and redirect stdout/stderr to youtube_viewer.log
from streamviewers_shared import setup_logging
setup_logging(str(script_dir / "youtube_viewer.log"))


# Import viewer class from youtube_stream_viewer
from youtube_stream_viewer import YouTubeStreamViewer, DEFAULT_YT_URL

@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector_thread
    detector_thread = threading.Thread(target=run_detector_bg, daemon=True)
    detector_thread.start()
    yield
    # Shutdown
    global detector
    if detector:
        print("[Server] Stopping YouTube Stream Viewer background tasks...")
        detector.stop()

app = FastAPI(title="Duoliang Stream Viewer GUI Server", lifespan=lifespan)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Global detector instance
detector = None
detector_thread = None

class ConfigModel(BaseModel):
    youtube_url: str

def run_detector_bg():
    global detector
    # Read initial URL from config.json if it exists
    config_file = script_dir / "config.json"
    url = DEFAULT_YT_URL
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                config_data = json.load(f)
                url = config_data.get("youtube_url", DEFAULT_YT_URL)
        except Exception as e:
            print(f"Error reading initial config: {e}")
            
    print(f"[Server] Initializing YouTube Stream Viewer with URL: {url}...")
    detector = YouTubeStreamViewer(youtube_url=url)
    print("[Server] Running YouTube Stream Viewer loop...")
    detector.run()

active_clients = {}  # {client_key: last_active_timestamp}
active_clients_lock = threading.Lock()

def register_client_activity(client_key: str) -> int:
    global active_clients
    current_time = time.time()
    with active_clients_lock:
        active_clients[client_key] = current_time
        # Clean up clients inactive for more than 5.0 seconds
        active_clients = {k: t for k, t in active_clients.items() if current_time - t < 5.0}
        return len(active_clients)

# --- MJPEG Video Feed Stream ---
def generate_mjpeg_stream(client_host: str):
    global detector
    client_key = f"{client_host}:mjpeg"
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{current_time}] [Server] Visitor connected to video feed from {client_host}")
    
    # Frame rate throttling for the MJPEG stream
    fps_limit = 20
    delay = 1.0 / fps_limit
    
    # Pre-render a blank image for initial loading state
    blank_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    cv2.putText(blank_frame, "Initializing Live Stream...", (380, 360),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
    
    try:
        while True:
            loop_start = time.time()
            
            # Register client activity
            register_client_activity(client_key)
            
            # Check if detector is running and has a frame
            if detector and detector.latest_annotated_frame is not None:
                frame = detector.latest_annotated_frame
            else:
                frame = blank_frame
                
            # Encode frame as JPEG
            ret, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if ret:
                frame_bytes = jpeg.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            # Sleep to regulate FPS
            elapsed = time.time() - loop_start
            if elapsed < delay:
                time.sleep(delay - elapsed)
    finally:
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{current_time}] [Server] Visitor disconnected from video feed ({client_host})")
        with active_clients_lock:
            active_clients.pop(client_key, None)

@app.get("/api/video_feed")
def get_video_feed(request: Request):
    client_host = request.client.host if request.client else "unknown"
    return StreamingResponse(
        generate_mjpeg_stream(client_host),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# --- IP LOCAL/PUBLIC CONNECTIONS CHECK ---
def is_local_ip(ip: str) -> bool:
    import ipaddress
    if not ip:
        return False
    # Normalize
    ip_orig = ip
    ip = ip.strip().lower()
    if ip == "localhost":
        return True
    # Strip zone index for IPv6 (e.g., fe80::1%lo0)
    if "%" in ip:
        ip = ip.split("%")[0]
    # Strip IPv4-mapped IPv6 prefix (e.g., ::ffff:192.168.1.1)
    if ip.startswith("::ffff:"):
        ip = ip[7:]
        
    res = False
    try:
        addr = ipaddress.ip_address(ip)
        is_cgnat = False
        if addr.version == 4:
            octets = list(addr.packed)
            if octets[0] == 100 and (64 <= octets[1] <= 127):
                is_cgnat = True
        res = addr.is_loopback or addr.is_private or addr.is_link_local or is_cgnat
    except ValueError:
        # Fallback to manual prefixes if ipaddress parsing fails
        if ip in ("127.0.0.1", "::1"):
            res = True
        elif ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("169.254."):
            res = True
        elif ip.startswith("172."):
            parts = ip.split('.')
            if len(parts) >= 2:
                try:
                    second_octet = int(parts[1])
                    if 16 <= second_octet <= 31:
                        res = True
                except ValueError:
                    pass
    print(f"[DEBUG] is_local_ip evaluation: {ip_orig} (parsed: {ip}) -> {res}")
    return res

def get_client_ip(request: Request) -> str:
    # Check X-Forwarded-For first for reverse-proxies (like ngrok)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_local_access(request: Request):
    ip = get_client_ip(request)
    if not is_local_ip(ip):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrative actions are disabled for remote internet connections."
        )

# --- REST APIs ---
@app.get("/api/status")
def get_status(request: Request):
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")
    client_key = f"{client_ip}:{user_agent}"
    
    active_viewers = register_client_activity(client_key)
    is_local = is_local_ip(client_ip)
    print(f"[DEBUG] client_ip={client_ip}, is_local={is_local}")
    
    global detector
    if not detector:
        return {
            "status": "initializing",
            "is_local": is_local,
            "active_viewers": active_viewers,
            "youtube_url": DEFAULT_YT_URL,
            "internet_video_default": True
        }
        
    return {
        "status": "ready",
        "mode": detector.mode,
        "is_recording": detector.is_recording,
        "manual_recording": detector.manual_recording,
        "learn_roi": detector.learn_roi,
        "learn_heatmap": detector.learn_heatmap,
        "show_detection_marks": detector.show_detection_marks,
        "roi": detector.roi,
        "exclusion_zones": detector.exclusion_zones,
        "show_roi_zones": detector.show_roi_zones,
        "yolo_conf_threshold": detector.yolo_conf_threshold,
        "min_area": detector.min_area,
        "buffer_seconds": detector.buffer_seconds,
        "post_roll_seconds": detector.post_roll_seconds,
        "sb_buffer_seconds": detector.sb_buffer_seconds,
        "sb_post_roll_seconds": detector.sb_post_roll_seconds,
        "nb_buffer_seconds": detector.nb_buffer_seconds,
        "nb_post_roll_seconds": detector.nb_post_roll_seconds,
        "youtube_url": detector.youtube_url,
        "stream_connected": detector.reader._connected,
        "fps": round(detector.reader.fps, 1),
        "processing_fps": detector.processing_fps,
        "frame_count": detector.frame_count,
        "active_train": detector._get_current_active_train(),
        "is_local": is_local,
        "active_viewers": active_viewers,
        "internet_video_default": getattr(detector, "internet_video_default", True),
        "detected_boxes": [],
        "stream_width": detector.reader.width,
        "stream_height": detector.reader.height,
        "auto_analyze": {"enabled": False, "status": "disabled", "queue_size": 0}
    }

@app.post("/api/config")
def update_config(config: ConfigModel, request: Request):
    check_local_access(request)
    global detector, detector_thread
    if not detector:
        raise HTTPException(status_code=503, detail="Viewer not ready")
        
    old_url = detector.youtube_url
    new_url = config.youtube_url.strip()
    
    if new_url != old_url:
        print(f"[Server] YouTube URL updating from {old_url} to {new_url}...")
        detector.youtube_url = new_url
        detector.save_config()
        
        # Restart the detector on the new URL
        print("[Server] Stopping current stream reader and timetable updater...")
        detector.stop()
        
        # Start a new thread to initialize the new stream to avoid locking FastAPI request
        def restart_viewer():
            global detector
            detector = YouTubeStreamViewer(youtube_url=new_url)
            detector.run()
            
        detector_thread = threading.Thread(target=restart_viewer, daemon=True)
        detector_thread.start()
        
    return {"message": "Configuration updated successfully"}

@app.get("/api/timetable")
def get_timetable():
    global detector
    if not detector:
        return []
    return detector.timetable_updater.get_upcoming_trains()

@app.get("/api/logs")
def get_logs(request: Request):
    check_local_access(request)
    log_path = script_dir / "youtube_viewer.log"
    if not log_path.exists():
        return {"logs": "Log file not found."}
        
    try:
        # Return last 100 lines of logs
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            last_lines = lines[-100:]
            return {"logs": "".join(last_lines)}
    except Exception as e:
        return {"logs": f"Error reading logs: {e}"}

@app.post("/api/shutdown")
def shutdown_server(request: Request):
    check_local_access(request)
    print("[Server] Shutdown requested by administrator.")
    
    def kill_process():
        time.sleep(1.0)
        print("[Server] Exiting process...")
        os._exit(0)
        
    threading.Thread(target=kill_process, daemon=True).start()
    return {"message": "Server shutting down..."}

# Mount static files (HTML/CSS/JS dashboard)
app.mount("/", NoCacheStaticFiles(directory=str(script_dir / "static"), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
