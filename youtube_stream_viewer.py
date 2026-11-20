"""YouTube Stream Viewer for Duoliang Station.

This script extracts a YouTube live stream and reads it in a separate thread.
It also updates the live railway timetable in the background.
All recording and YOLO/motion detection code has been removed.
"""

import os
import sys
import time
import queue
import json
import threading
from pathlib import Path
from datetime import datetime, timedelta

import cv2
import numpy as np
import yt_dlp

# Ensure Homebrew tools (deno, ffmpeg) are available in PATH
if "/opt/homebrew/bin" not in os.environ.get("PATH", ""):
    os.environ["PATH"] = f"/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:{os.environ.get('PATH', '')}"

# Add project root to sys.path to allow imports from shared module
project_root = str(Path(__file__).resolve().parents[1])
if project_root not in sys.path:
    sys.path.append(project_root)

from streamviewers_shared import setup_logging

# --- Default Configurations ---
DEFAULT_YT_URL = "https://www.youtube.com/watch?v=UCG1aXVO8H8"  # Duoliang Station Live Stream URL
FPS = 25.0                  # Fallback FPS if it cannot be read from the stream
FETCH_TIMETABLE_INTERVAL = 60   # Seconds between live timetable updates


class TimetableUpdater:
    """Background thread to query the live railway timetable for Duoliang Station."""
    def __init__(self, schedule_path="schedule.json", viewer=None):
        self.schedule_path = schedule_path
        self.viewer = viewer
        self.upcoming_trains = []
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)
        
    def start(self):
        self.thread.start()
        return self
        
    def stop(self):
        self.stop_event.set()
        if self.thread.is_alive():
            self.thread.join(timeout=3.0)
            
    def _run(self):
        import httpx
        from html.parser import HTMLParser
        
        class NextDataExtractor(HTMLParser):
            def __init__(self):
                super().__init__()
                self.in_next_data = False
                self.content = []
            def handle_starttag(self, tag, attrs):
                if tag == 'script' and dict(attrs).get('id') == '__NEXT_DATA__':
                    self.in_next_data = True
            def handle_endtag(self, tag):
                if tag == 'script':
                    self.in_next_data = False
            def handle_data(self, data):
                if self.in_next_data:
                    self.content.append(data)

        script_dir = Path(__file__).resolve().parent
        schedule_file = script_dir / self.schedule_path
        if not schedule_file.exists():
            schedule_file = script_dir / "assets" / self.schedule_path
            
        if not schedule_file.exists():
            print(f"{datetime.now().strftime("%Y%m%d %H:%M:%S")}: Error: {self.schedule_path} not found at {schedule_file}.")
            return
            
        try:
            with open(schedule_file, "r", encoding="utf-8") as f:
                schedule = json.load(f)
        except Exception as e:
            print(f"{datetime.now().strftime("%Y%m%d %H:%M:%S")}: Error loading schedule.json: {e}")
            return

        # Local import to prevent circular import issues
        from train_logic import runs_today, calculate_duoliang_status, translate_train_type
        
        while not self.stop_event.is_set():
            now_dt = datetime.now()
            schedule_items = []
            for item in schedule:
                if runs_today(item["Note"]):
                    parts = item["ScheduledTime"].split(':')
                    if len(parts) >= 2:
                        hour = int(parts[0])
                        minute = int(parts[1])
                        sched_time = datetime(now_dt.year, now_dt.month, now_dt.day, hour, minute)
                        schedule_items.append((sched_time, item))
            
            schedule_items.sort(key=lambda x: x[0])
            
            headers = {"User-Agent": "Mozilla/5.0"}
            updated_trains = []
            
            for sched_time, item in schedule_items:
                train_no = item["Train"]
                
                # Check if train scheduled time falls within the live check window:
                # [now_dt - 60 minutes, now_dt + 120 minutes]
                in_live_window = (sched_time >= now_dt - timedelta(minutes=60)) and (sched_time <= now_dt + timedelta(minutes=120))
                
                best_delay = 0
                is_passed = False
                is_passing = False
                train_type = translate_train_type(item["Note"].split()[0] if item["Note"] else "Unknown")
                
                if in_live_window:
                    # Query live status from API
                    url = f"https://taiwanhelper.com/railway/train/{train_no}"
                    try:
                        res = httpx.get(url, headers=headers, timeout=5.0)
                        if res.status_code == 200:
                            extractor = NextDataExtractor()
                            extractor.feed(res.text)
                            json_str = "".join(extractor.content).strip()
                            data = json.loads(json_str)
                            train_data = data.get("props", {}).get("pageProps", {}).get("train", {})
                            note = train_data.get('note', '')
                            train_type = translate_train_type(train_data.get('trainTypeName', 'Unknown Type'))
                            
                            api_url = "https://taiwanhelper.com/api/get-train-live"
                            api_res = httpx.get(api_url, params={"no": train_no}, headers=headers, timeout=5.0)
                            
                            train_live_map = {}
                            station_live_map = {}
                            if api_res.status_code == 200:
                                api_data = api_res.json()
                                train_live_map = api_data.get("trainLiveMap", {})
                                station_live_map = api_data.get("stationLiveMap", {})
                                
                            best_delay, is_passed, is_passing = calculate_duoliang_status(
                                train_no, note, train_live_map, station_live_map
                            )
                    except Exception as e:
                        print(f"{datetime.now().strftime("%Y%m%d %H:%M:%S")}: Error fetching live data for train {train_no}: {e}")
                else:
                    if sched_time < now_dt - timedelta(minutes=5):
                        is_passed = True
                    else:
                        is_passed = False
                
                est_dt = sched_time
                if in_live_window and best_delay is not None:
                    est_dt = sched_time + timedelta(minutes=best_delay)
                
                est_time_str = f"{est_dt.hour:02d}:{est_dt.minute:02d}"
                
                # Determine passage_status: scheduled, coming, passing, passed
                passage_status = "scheduled"
                
                window_coming_start = est_dt - timedelta(minutes=4)
                window_passing_start = est_dt - timedelta(minutes=2)
                window_end = est_dt + timedelta(minutes=2)
                
                # Check if recording is active for this train
                is_active_recording = False
                if self.viewer and getattr(self.viewer, "is_recording", False):
                    if abs((est_dt - now_dt).total_seconds()) < 300:
                        is_active_recording = True

                if is_passed or (now_dt > window_end):
                    passage_status = "passed"
                    is_passed = True
                    is_passing = False
                elif is_active_recording or (window_passing_start <= now_dt <= window_end):
                    passage_status = "passing"
                    is_passing = True
                elif is_passing or (window_coming_start <= now_dt < window_passing_start):
                    passage_status = "coming"
                    is_passing = True
                
                updated_trains.append({
                    "train_no": train_no,
                    "train_type": train_type,
                    "scheduled_time": item["ScheduledTime"],
                    "estimated_time": est_time_str,
                    "delay": best_delay if best_delay is not None else 0,
                    "is_passed": is_passed,
                    "is_passing": is_passing,
                    "passage_status": passage_status,
                    "note": item["Note"],
                    "direction": "southbound" if "南下" in item["Note"] else "northbound",
                    "in_live_window": in_live_window
                })
            
            with self.lock:
                self.upcoming_trains = updated_trains
                
            for _ in range(FETCH_TIMETABLE_INTERVAL):
                if self.stop_event.is_set():
                    break
                time.sleep(1)
                
    def get_upcoming_trains(self):
        with self.lock:
            return list(self.upcoming_trains)


class YouTubeStreamReader:
    """Resilient Long-Running HLS Live Stream Reader.
    
    Features:
    - Preemptive background stream URL caching & auto-refresh before token expiration.
    - Decoupled frame capture thread with fast (3.5s) watchdog failover.
    - Thread-safe discard-oldest queue buffering to ensure zero latency and smooth viewing.
    """
    def __init__(self, youtube_url: str):
        self.youtube_url = youtube_url
        self.frame_queue = queue.Queue(maxsize=100)
        self._lock = threading.Lock()
        self._last_frame_time = 0.0
        self._connected = False
        self._stop = threading.Event()
        self.width = 1280
        self.height = 720
        self.fps = FPS
        
        # URL Cache
        self._cached_stream_url = None
        self._cached_url_time = 0.0
        self._url_refresh_interval = 7200.0  # 2 hours
        
        # Thread handles
        self._supervisor_thread = threading.Thread(target=self._supervisor_loop, daemon=True)
        self._refresh_thread = threading.Thread(target=self._url_refresher_loop, daemon=True)

    def start(self):
        self._supervisor_thread.start()
        self._refresh_thread.start()
        return self

    def _extract_stream_url(self) -> str:
        """Use yt-dlp to extract the direct m3u8 stream URL with EJS challenge solver."""
        ydl_opts_list = [
            # Primary: Edge browser cookies + remote EJS solver for YouTube challenges
            {
                'format': 'bestvideo[protocol=m3u8_native]/bestvideo/best',
                'quiet': True,
                'no_warnings': True,
                'remote_components': ['ejs:github'],
                'cookiesfrombrowser': ('edge', None, None, None),
            },
            # Secondary: Standard with remote EJS solver
            {
                'format': 'bestvideo[protocol=m3u8_native]/bestvideo/best',
                'quiet': True,
                'no_warnings': True,
                'remote_components': ['ejs:github'],
            },
            # Fallback standard
            {
                'format': 'bestvideo[protocol=m3u8_native]/bestvideo/best',
                'quiet': True,
                'no_warnings': True,
            }
        ]
        
        last_err = None
        for opts in ydl_opts_list:
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(self.youtube_url, download=False)
                    stream_url = info.get('url')
                    if stream_url:
                        self.width = int(info.get('width', 1920) or 1920)
                        self.height = int(info.get('height', 1080) or 1080)
                        src_fps = info.get('fps')
                        if src_fps and src_fps > 0:
                            self.fps = float(src_fps)
                        return stream_url
            except Exception as e:
                last_err = e
                continue

        raise ValueError(f"Could not extract stream URL: {last_err}")

    def _url_refresher_loop(self):
        """Preemptively fetches and updates the stream URL in the background."""
        while not self._stop.is_set():
            now = time.monotonic()
            if self._cached_stream_url is None or (now - self._cached_url_time > self._url_refresh_interval):
                try:
                    url = self._extract_stream_url()
                    with self._lock:
                        self._cached_stream_url = url
                        self._cached_url_time = time.monotonic()
                except Exception:
                    pass
            time.sleep(30.0)

    def _get_stream_url(self, force_refresh: bool = False) -> str:
        with self._lock:
            if not force_refresh and self._cached_stream_url and (time.monotonic() - self._cached_url_time < self._url_refresh_interval):
                return self._cached_stream_url

        print(f"{datetime.now().strftime('%Y%m%d %H:%M:%S')}: Resolving YouTube Live URL: {self.youtube_url}")
        url = self._extract_stream_url()
        with self._lock:
            self._cached_stream_url = url
            self._cached_url_time = time.monotonic()
        return url

    def _supervisor_loop(self):
        # Configure OpenCV FFmpeg backend options for resilient HTTP/HLS streaming
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "allowed_extensions;ALL|protocol_whitelist;file,http,https,tcp,tls,crypto|reconnect;1|reconnect_streamed;1|reconnect_delay_max;2|rw_timeout;4000000"
        
        cap = None
        while not self._stop.is_set():
            if cap is None or not cap.isOpened():
                try:
                    stream_url = self._get_stream_url()
                    cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
                    if hasattr(cv2, 'CAP_PROP_READ_TIMEOUT_MSEC'):
                        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 4000)
                    if hasattr(cv2, 'CAP_PROP_OPEN_TIMEOUT_MSEC'):
                        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 4000)
                    if cap.isOpened():
                        self.width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or self.width
                        self.height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or self.height
                        src_fps = cap.get(cv2.CAP_PROP_FPS)
                        if src_fps > 0:
                            self.fps = src_fps
                        self._last_frame_time = time.monotonic()
                        self._connected = True
                        print(f"{datetime.now().strftime('%Y%m%d %H:%M:%S')}: Successfully connected to YouTube stream ({self.width}x{self.height} @ {self.fps} FPS)")
                except Exception as e:
                    print(f"{datetime.now().strftime('%Y%m%d %H:%M:%S')}: Error connecting to stream: {e}. Retrying in 3 seconds...")
                    self._connected = False
                    time.sleep(3.0)
                    continue

            ok, frame = cap.read()
            if ok and frame is not None:
                try:
                    self.frame_queue.put_nowait(frame.copy())
                except queue.Full:
                    try:
                        self.frame_queue.get_nowait()
                    except queue.Empty:
                        pass
                    try:
                        self.frame_queue.put_nowait(frame.copy())
                    except queue.Full:
                        pass
                
                with self._lock:
                    self._last_frame_time = time.monotonic()
                    self._connected = True
            else:
                self._connected = False
                # Reconnect if stream is broken for more than 3.5s
                if time.monotonic() - self._last_frame_time > 3.5:
                    print(f"{datetime.now().strftime('%Y%m%d %H:%M:%S')}: Stream connection timed out. Refreshing YouTube URL...")
                    cap.release()
                    cap = None
                    try:
                        self._get_stream_url(force_refresh=True)
                    except Exception:
                        pass
                    while not self.frame_queue.empty():
                        try:
                            self.frame_queue.get_nowait()
                        except queue.Empty:
                            break
                else:
                    time.sleep(0.01)

        if cap:
            cap.release()

    def read_frame(self, timeout=0.01):
        try:
            return self._connected, self.frame_queue.get(timeout=timeout)
        except queue.Empty:
            return self._connected, None

    def stop(self):
        self._stop.set()
        if self._supervisor_thread.is_alive():
            self._supervisor_thread.join(timeout=2.0)
        if self._refresh_thread.is_alive():
            self._refresh_thread.join(timeout=1.0)


class YouTubeStreamViewer:
    """YouTube Stream Viewer for Duoliang Station.

    Manages the Stream Reader and the Timetable Updater without any YOLO,
    recording or motion detection functionalities.
    """
    def __init__(self, youtube_url: str):
        self.youtube_url = youtube_url
        script_dir = Path(__file__).resolve().parent
        self.config_file = script_dir / "config.json"
        self.load_config()
        
        # Initialize background services
        self.reader = YouTubeStreamReader(self.youtube_url).start()
        
        print(f"{datetime.now().strftime("%Y%m%d %H:%M:%S")}: Starting live railway schedule tracker...")
        self.timetable_updater = TimetableUpdater(viewer=self).start()
        
        # State properties
        self.frame_count = 0
        self.processing_fps = 0.0
        self._fps_frame_counter = 0
        self._fps_last_time = 0.0
        self.latest_annotated_frame = None
        self._stop_running = threading.Event()
        
        self.results_lock = threading.Lock()
        self.shared_detected_boxes = []

        # Stubs for compatibility with status API
        self.mode = "viewer"
        self.is_recording = False
        self.manual_recording = False
        self.learn_roi = False
        self.learn_heatmap = False
        self.show_detection_marks = False
        self.roi = None
        self.exclusion_zones = []
        self.show_roi_zones = False
        self.yolo_conf_threshold = 0.0
        self.min_area = 0
        self.buffer_seconds = 0
        self.post_roll_seconds = 0
        self.sb_buffer_seconds = 0
        self.sb_post_roll_seconds = 0
        self.nb_buffer_seconds = 0
        self.nb_post_roll_seconds = 0

    def load_config(self):
        """Loads configuration from config.json, fallback to defaults."""
        self.internet_video_default = True
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    config_data = json.load(f)
                self.youtube_url = config_data.get("youtube_url", self.youtube_url)
                self.internet_video_default = config_data.get("internet_video_default", True)
                print(f"📂 Loaded configuration from config.json: youtube_url={self.youtube_url}, internet_video_default={self.internet_video_default}")
            except Exception as e:
                print(f"Error loading config.json: {e}")
        else:
            self.save_config()

    def save_config(self):
        """Saves current configuration to config.json."""
        config_data = {
            "youtube_url": self.youtube_url,
            "internet_video_default": self.internet_video_default
        }
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(config_data, f, indent=4)
            print(f"💾 Saved configuration to config.json")
        except Exception as e:
            print(f"Error saving config.json: {e}")

    def stop(self):
        print(f"{datetime.now().strftime("%Y%m%d %H:%M:%S")}: ⬜ Stopping YouTube Stream Viewer...")
        self._stop_running.set()
        self.timetable_updater.stop()
        self.reader.stop()

    def _get_current_active_train(self):
        """Checks if there is a train currently scheduled to pass Duoliang Station."""
        upcoming = self.timetable_updater.get_upcoming_trains()
        now_dt = datetime.now()
        for train in upcoming:
            if train["is_passing"]:
                return train
            try:
                h, m = map(int, train["estimated_time"].split(':'))
                est_dt = datetime(now_dt.year, now_dt.month, now_dt.day, h, m)
                diff_mins = (now_dt - est_dt).total_seconds() / 60.0
                if -3.0 <= diff_mins <= 3.0:
                    return train
            except Exception:
                continue
        return None

    def run(self):
        print(f"\n{datetime.now().strftime("%Y%m%d %H:%M:%S")}: YouTube Stream Viewer starting (YouTube Live URL: {self.youtube_url})")
        print(f"Waiting for stream to initialize...")

        # Wait for the first frame to establish connection and resolution
        while not self._stop_running.is_set():
            connected, frame = self.reader.read_frame()
            if connected and frame is not None:
                break
            time.sleep(0.1)

        if self._stop_running.is_set():
            return

        print(f"{datetime.now().strftime("%Y%m%d %H:%M:%S")}: Stream initialized successfully. FPS: {self.reader.fps:.1f}")

        try:
            while not self._stop_running.is_set():
                connected, frame = self.reader.read_frame()
                if not connected or frame is None:
                    time.sleep(0.01)
                    continue

                self.frame_count += 1
                
                # Measure processing FPS (rolling 2-second window)
                self._fps_frame_counter += 1
                now = time.time()
                if self._fps_last_time == 0.0:
                    self._fps_last_time = now
                elapsed = now - self._fps_last_time
                if elapsed >= 2.0:
                    self.processing_fps = round(self._fps_frame_counter / elapsed, 1)
                    self._fps_frame_counter = 0
                    self._fps_last_time = now
                
                # Keep latest frame reference for MJPEG feed
                self.latest_annotated_frame = frame
                
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()
