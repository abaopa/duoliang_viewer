# YouTube Duoliang Station Live Stream Viewer

A responsive, bilingual web dashboard for live monitoring of the Duoliang Station (多良車站) YouTube stream, integrated with real-time Taiwan Railway Administration (TRA) timetable schedules and automatic delay estimations.

Unlike heavy AI detectors, this viewer is a lightweight service focused purely on stream reliability, visitor connection monitoring, and live railway schedule tracking **without** running heavy YOLO object detection.

---

## Features
- **Live Timetable Schedule**: Queries the real-time TRA railway schedule for Duoliang Station, automatically calculating train arrival delays and highlighting currently passing trains.
- **Bilingual Interface**: Full English and Traditional Chinese (`繁體中文`) translations.
- **Resilient YouTube HLS Streaming**: Preemptive stream URL refreshing and native m3u8 format parsing with `yt-dlp`.

---

## Installation & Setup

1. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/abaopa/duoliang_viewer.git
   cd duoliang_viewer
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure Stream (Optional)**:
   Default configuration lives in `config.json`. To customize the YouTube URL:
   ```json
   {
     "youtube_url": "https://www.youtube.com/watch?v=UCG1aXVO8H8"
   }
   ```

3. **Run the Server**:
   ```bash
   python duoliang_viewer.py
   ```
   Open your browser to: **http://localhost:8081**
