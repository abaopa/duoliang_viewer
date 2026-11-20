import httpx
import json
from datetime import datetime, timedelta
from train_logic import runs_today, calculate_duoliang_status, get_station_name, translate_station_name, translate_train_type

# Load the schedule
import os
schedule_path = "schedule.json" if os.path.exists("schedule.json") else "assets/schedule.json"
with open(schedule_path, "r", encoding="utf-8") as f:
    schedule = json.load(f)


def fetch_live_timetable(train_no):
    # Fetch static page details to get stopTimes list (Next.js __NEXT_DATA__)
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

    url = f"https://taiwanhelper.com/railway/train/{train_no}"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    try:
        res = httpx.get(url, headers=headers)
        if res.status_code != 200:
            print(f"Error fetching train {train_no} timetable: {res.status_code}")
            return
        
        extractor = NextDataExtractor()
        extractor.feed(res.text)
        json_str = "".join(extractor.content).strip()
        data = json.loads(json_str)
        train = data.get("props", {}).get("pageProps", {}).get("train", {})
        stop_times = train.get("stopTimes", [])
        
        # Now fetch live updates from API
        api_url = "https://taiwanhelper.com/api/get-train-live"
        api_res = httpx.get(api_url, params={"no": train_no}, headers=headers)
        
        train_live_map = {}
        station_live_map = {}
        if api_res.status_code == 200:
            api_data = api_res.json()
            train_live_map = api_data.get("trainLiveMap", {})
            station_live_map = api_data.get("stationLiveMap", {})
        
        note = train.get('note', '')
        best_delay, is_passed, is_passing = calculate_duoliang_status(train_no, note, train_live_map, station_live_map)

        # Find scheduled time at Duoliang
        duoliang_scheduled = None
        for item in schedule:
            if item.get("Train") == train_no:
                duoliang_scheduled = item.get("ScheduledTime")
                break
        
        # Calculate predicted passing status
        prediction_text = "No live info"
        if is_passed:
            prediction_text = "Passed Duoliang Station (reached next station)"
        elif is_passing:
            prediction_text = "Train is passing Duoliang Station! (between prev & next station)"
        elif best_delay is not None:
            if duoliang_scheduled:
                try:
                    h, m = map(int, duoliang_scheduled.split(':'))
                    new_m = m + best_delay
                    new_h = (h + new_m // 60) % 24
                    new_m = new_m % 60
                    new_time_str = f"{new_h:02d}:{new_m:02d}"
                    status_lbl = "On Time" if best_delay == 0 else f"Delay {best_delay} min(s)"
                    prediction_text = f"Est. pass at {new_time_str} ({status_lbl})"
                except Exception:
                    prediction_text = "Est. pass On Time" if best_delay == 0 else f"Est. pass Delay {best_delay} min(s)"
            else:
                prediction_text = "Est. pass On Time" if best_delay == 0 else f"Est. pass Delay {best_delay} min(s)"

        train_type = translate_train_type(train.get('trainTypeName', 'Unknown Type'))
        start_station = translate_station_name(train.get('startingStationName', 'Unknown'))
        end_station = translate_station_name(train.get('endingStationName', 'Unknown'))

        print(f"\n==========================================")
        print(f"Train No: {train_no} ({train_type})")
        print(f"Route: {start_station} -> {end_station}")
        print(f"Duoliang Prediction: {prediction_text}")
        print(f"------------------------------------------")
        print(f"{'Seq':<6}{'Station':<15}{'Arrival':<10}{'Departure':<10}{'Status':<12}")
        print(f"------------------------------------------")
        
        for st in stop_times:
            seq = st.get('seq')
            sid = st.get('stationId')
            sname = get_station_name(sid)
            arr = st.get('arrivalTime')
            dep = st.get('departureTime')
            
            # Lookup delay
            key = f"{train_no}_{sid}"
            delay = None
            if key in train_live_map:
                delay = train_live_map[key]
            elif key in station_live_map:
                delay = station_live_map[key]
                
            if delay is None:
                status = "Not Started"
            elif delay == 0:
                status = "On Time"
            else:
                status = f"Delay {delay}m"
                
            print(f"{seq:<6}{sname:<15}{arr:<10}{dep:<10}{status:<12}")
        print(f"==========================================")
        
    except Exception as e:
        print(f"Failed to query train {train_no}: {e}")

# runs_today is imported from train_logic

# Auto-detect current local time and target the next 3 trains scheduled today
def get_scheduled_datetime(scheduled_time_str):
    now = datetime.now()
    parts = scheduled_time_str.split(':')
    if len(parts) < 2:
        return now
    hour = int(parts[0])
    minute = int(parts[1])
    return datetime(now.year, now.month, now.day, hour, minute)

now = datetime.now()
schedule_items = []
for item in schedule:
    if runs_today(item["Note"]):
        sched_time = get_scheduled_datetime(item["ScheduledTime"])
        schedule_items.append((sched_time, item))

# Sort chronologically by scheduled time
schedule_items.sort(key=lambda x: x[0])

# Find the next 3 trains scheduled after now (including those that are currently passing within a 2-minute margin)
upcoming_trains = []
for sched_time, item in schedule_items:
    if sched_time >= now - timedelta(minutes=2):
        upcoming_trains.append(item)
        if len(upcoming_trains) >= 3:
            break

if not upcoming_trains:
    # If we are at the end of the day, fallback to checking first 3 trains of the day for preview
    print("Today's schedule has ended. Showing a preview of today's first 3 trains:")
    for item in schedule_items[:3]:
        fetch_live_timetable(item[1]["Train"])
else:
    print(f"Current local time: {now.strftime('%H:%M:%S')}. Fetching details for the next {len(upcoming_trains)} scheduled trains:")
    for item in upcoming_trains:
        fetch_live_timetable(item["Train"])
