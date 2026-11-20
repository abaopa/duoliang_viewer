# YouTube Duoliang Station Live Stream Viewer

A responsive, bilingual web dashboard for live monitoring of the Duoliang Station (多良車站) YouTube stream, integrated with real-time Taiwan Railway Administration (TRA) timetable schedules and automatic delay estimations.

Unlike its predecessor `train_detector`, this viewer is a lightweight service focused purely on stream streaming, visitor connection logging, and live railway schedule tracking, **without** running any resource-heavy YOLOv8 object detection or local video recordings.

---

## 1. Key Features
* **Live Timetable Schedule**: Queries the live TRA railway schedule for Duoliang Station, automatically estimates train arrival delays, and highlights currently passing trains.
* **Bilingual Localization (i18n)**: Fully supports English and Traditional Chinese (`繁體中文`) translations toggleable via the header interface.
* **Metadata & Connectivity Check**: In the background, resolves direct streaming links to track stream resolution, connection latency, and true FPS, exposing stats in the dashboard.
* **Lightweight Profile**: Omitted all local MP4 recording, video writer threads, YOLOv8 model loading, and background idle processing for maximum CPU efficiency.

---

## 2. Running the Viewer Server

### Setup Dependencies
Install server dependencies (from root directory):
```bash
pip install -r requirements.txt
```

### Manually in Foreground
Start the FastAPI server:
```bash
cd duoliang_viewer
python duoliang_viewer.py
```
Open your browser and navigate to **`http://localhost:8081`**.

### Background Daemon (macOS Launchd)
To run the server in the background and ensure it automatically starts up when your Mac restarts:
* **Start and setup the background service** (using the management tool at the root):
  ```bash
  ./manage_duoliang_viewer.sh start
  ```
* **Check service status and logs**:
  ```bash
  ./manage_duoliang_viewer.sh status
  ```
* **Stop the background service**:
  ```bash
  ./manage_duoliang_viewer.sh stop
  ```
* **Restart the background service**:
  ```bash
  ./manage_duoliang_viewer.sh restart
  ```
The daemon runs wrapper [run_duoliang_viewer.sh](run_duoliang_viewer.sh) using the plist configuration [com.streamviewers.duoliang_viewer.plist](com.streamviewers.duoliang_viewer.plist).

---

## 3. Configuration
The viewer configuration is saved inside [config.json](config.json):
```json
{
    "youtube_url": "https://www.youtube.com/watch?v=UCG1aXVO8H8"
}
```
You can update the YouTube Live stream URL directly from the **Settings** tab in the dashboard. Doing so will save it to `config.json` and automatically restart the background stream reader on the new URL.

---

## 4. Permissions & Access Control Rules
The dashboard enforces administrative rules depending on the visitor's IP address:
* **Local Visitors (LAN/Home)**:
  * Full access to configuration tuning (YouTube URL change).
  * Access to system Activity Logs.
  * Can remotely shut down the server process using the **Stop Server** header button.
* **Internet Visitors (WAN/Remote)**:
  * The **Settings** tab is completely hidden.
  * The **Stop Server** button is hidden from the header.
  * System logs are kept private.
