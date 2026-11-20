// --- STATE MANAGEMENT ---
const state = {
    youtube_url: null,
    youtube_id: null,
    stream_connected: false,
    fps: 0.0,
    stream_width: 1280,
    stream_height: 720,
    active_viewers: 0,
    is_local: true,
    is_muted: true,
    active_tab: "tab-config",
    timetable_cache: [],
    timetable_expanded: localStorage.getItem("timetable_expanded") === "true",
    language: localStorage.getItem("lang") || "en",
    video_initialized: false
};

// --- LOCALIZATION / TRANSLATION DICTIONARY ---
const locales = {
    en: {
        header_title: "Duoliang Station",
        header_subtitle: "Live Viewer",
        btn_stop_server_title: "Stop Server Process",
        btn_stop_server: "Stop Server",
        label_stream: "Stream:",
        label_fps: "FPS:",
        label_resolution: "Resolution:",
        label_viewers: "Viewers:",
        detector_status_viewing: "STREAMING",
        btn_unmute: "Unmute",
        btn_mute: "Mute",
        btn_refresh_feed_title: "Refresh Live Stream",
        btn_toggle_timetable_title: "Toggle Expand/Collapse Timetable (Entire Day vs 3 Hours)",
        btn_toggle_timetable_sidebar: "Timetable",
        btn_toggle_config: "Config",
        btn_toggle_video: "Show/Hide Video Player",
        tab_config: "Settings",
        tab_logs: "Activity Logs",
        group_stream_settings: "Live Stream Settings",
        label_youtube_url: "YouTube Live Stream URL",
        desc_youtube_url: "The live stream URL of Duoliang Station. Updating this will restart the server connection.",
        btn_apply_config: "Apply Config Updates",
        btn_clear_view: "Clear View",
        btn_force_refresh: "Force Refresh",
        console_reading: "Reading activity logs...",
        sidebar_timetable: "Live Railway Timetable",
        timetable_updating: "Updating schedule...",
        station_info: "Duoliang (多良) Station Info",
        
        // JS dynamic labels/messages
        no_scheduled_trains: "No scheduled trains today.",
        status_passed: "Passed",
        status_passing: "Passing!",
        status_coming: "Approaching",
        status_ontime: "On Time",
        status_delay: "+{delay}m Delay",
        est_prefix: "Est:",
        connected: "CONNECTED",
        offline: "OFFLINE",
        shut_down: "SHUT DOWN",
        view_train_info: "View detailed train route and live status on TaiwanHelper",
        
        // JS dialogs
        confirm_shutdown: "Are you sure you want to shut down the server process? This will terminate all background train monitoring.",
        alert_shutdown_success: "Server is shutting down. You can now close this dashboard tab.",
        alert_shutdown_error: "Error sending shutdown command: ",
        alert_config_success: "Settings applied successfully.",
        alert_config_fail: "Failed to save settings."
    },
    zh: {
        header_title: "多良車站",
        header_subtitle: "即時監視器",
        btn_stop_server_title: "關閉伺服器主程式",
        btn_stop_server: "關閉伺服器",
        label_stream: "即時串流：",
        label_fps: "幀率：",
        label_resolution: "解析度：",
        label_viewers: "觀看人數：",
        detector_status_viewing: "串流中",
        btn_unmute: "播放音效",
        btn_mute: "靜音",
        btn_refresh_feed_title: "重新整理即時串流",
        btn_toggle_timetable_title: "切換收合時刻表 (整天 vs 3小時內)",
        btn_toggle_timetable_sidebar: "時刻表",
        btn_toggle_config: "設定",
        btn_toggle_video: "顯示/隱藏即時畫面",
        tab_config: "設定首頁",
        tab_logs: "系統日誌",
        group_stream_settings: "即時串流設定",
        label_youtube_url: "YouTube 直播串流網址",
        desc_youtube_url: "多良車站的直播網址。更新後系統將會重新載入串流。",
        btn_apply_config: "儲存設定變更",
        btn_clear_view: "清除日誌",
        btn_force_refresh: "強制載入",
        console_reading: "正在讀取日誌...",
        sidebar_timetable: "台鐵即時時刻表",
        timetable_updating: "更新時刻表中...",
        station_info: "多良車站即時資訊",
        
        // JS dynamic labels/messages
        no_scheduled_trains: "本日已無排定列車運作。",
        status_passed: "已通過",
        status_passing: "通過中！",
        status_coming: "即將通過",
        status_ontime: "準點",
        status_delay: "晚 {delay} 分",
        est_prefix: "預估：",
        connected: "連線成功",
        offline: "中斷連線",
        shut_down: "伺服器已關閉",
        view_train_info: "在 TaiwanHelper 查看該車次詳細停靠站及即時狀態",
        
        // JS dialogs
        confirm_shutdown: "您確定要關閉伺服器主程式嗎？這將會終止背景的列車監測串流運作。",
        alert_shutdown_success: "伺服器正在關閉。您現在可以關閉此瀏覽器分頁。",
        alert_shutdown_error: "傳送關閉指令失敗：",
        alert_config_success: "設定更新成功並已套用。",
        alert_config_fail: "儲存設定失敗。"
    }
};

// --- TRANSLATION HELPER ---
function t(key, vars = {}) {
    const lang = state.language;
    let translation = locales[lang]?.[key] || locales["en"]?.[key] || key;
    
    // Replace variables in translation string (e.g. {delay})
    for (const [k, v] of Object.entries(vars)) {
        translation = translation.replace(`{${k}}`, v);
    }
    return translation;
}

function getLocalizedTrainType(type) {
    if (state.language === "zh") {
        return type;
    }
    // Simple translation mapping for English view
    const mappings = {
        "自強": "Tze-Chiang Limited Express",
        "自強(3000)": "Tze-Chiang (EMU3000)",
        "莒光": "Chu-Kuang Express",
        "區間": "Local Train",
        "區間快": "Local Express",
        "普悠瑪": "Puyuma Express",
        "太魯閣": "Taroko Express"
    };
    
    for (const [zhVal, enVal] of Object.entries(mappings)) {
        if (type.includes(zhVal)) {
            return type.replace(zhVal, enVal);
        }
    }
    return type;
}

function getLocalizedDirection(dir) {
    const d = dir.toLowerCase();
    if (state.language === "zh") {
        if (d === "southbound") return "南下";
        if (d === "northbound") return "北上";
        return dir;
    }
    return dir.charAt(0).toUpperCase() + dir.slice(1);
}

function applyLanguage() {
    // 1. Translate elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");
        const translation = t(key);
        if (translation) {
            if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        }
    });

    // 2. Translate elements with data-i18n-title
    document.querySelectorAll("[data-i18n-title]").forEach(element => {
        const key = element.getAttribute("data-i18n-title");
        const translation = t(key);
        if (translation) {
            element.setAttribute("title", translation);
        }
    });
    
    // 3. Update mute button text
    if (el.btnToggleMute && el.btnMuteText) {
        el.btnMuteText.textContent = state.is_muted ? t("btn_unmute") : t("btn_mute");
    }

    if (el.btnToggleTimetable) {
        const icon = el.btnToggleTimetable.querySelector(".material-symbols-outlined");
        if (icon) {
            icon.textContent = state.timetable_expanded ? "unfold_less" : "unfold_more";
        }
    }

    if (state.timetable_cache && state.timetable_cache.length > 0) {
        renderTimetableList();
    }
}

// --- DOM ELEMENTS ---
const el = {
    btnToggleLang: document.getElementById("btn-toggle-lang"),
    btnToggleTimetable: document.getElementById("btn-toggle-timetable"),
    btnToggleConfig: document.getElementById("btn-toggle-config"),
    btnToggleTimetableSidebar: document.getElementById("btn-toggle-timetable-sidebar"),
    btnToggleVideo: document.getElementById("btn-toggle-video"),
    videoSection: document.querySelector(".video-section"),
    appContainer: document.querySelector(".app-container"),
    panelSection: document.querySelector(".panel-section"),
    timetableSidebar: document.querySelector(".timetable-sidebar"),
    streamStatusBadge: document.getElementById("stream-status-badge"),
    streamFps: document.getElementById("stream-fps"),
    streamRes: document.getElementById("stream-res"),
    visitorCount: document.getElementById("visitor-count"),
    mjpegStream: document.getElementById("mjpeg-stream"),
    youtubePlayer: document.getElementById("youtube-player"),
    detectorStatusDot: document.getElementById("detector-status-dot"),
    detectorStatusText: document.getElementById("detector-status-text"),
    btnRefreshFeed: document.getElementById("btn-refresh-feed"),
    configForm: document.getElementById("config-form"),
    configYoutubeUrl: document.getElementById("config-youtube-url"),
    timetableList: document.getElementById("timetable-list"),
    timetableBackdrop: document.getElementById("timetable-backdrop"),
    timetableDragHandle: document.getElementById("timetable-drag-handle"),
    logsConsole: document.getElementById("logs-console"),
    btnClearLogs: document.getElementById("btn-clear-logs"),
    btnRefreshLogs: document.getElementById("btn-refresh-logs"),
    btnToggleMute: document.getElementById("btn-toggle-mute"),
    btnMuteText: document.getElementById("btn-mute-text")
};

// --- CORE FETCH FUNCTIONS ---

// Fetch state status
async function fetchStatus(hydrateForm = false) {
    try {
        const response = await fetch("/api/status");
        if (!response.ok) throw new Error("Connection failed");
        
        const data = await response.json();
        
        // Update connection badges
        el.streamStatusBadge.className = "badge badge-connected";
        el.streamStatusBadge.textContent = t("connected");
        el.streamFps.textContent = data.fps || "0.0";
        el.streamRes.textContent = (data.stream_width && data.stream_height) ? `${data.stream_width}x${data.stream_height}` : "1280x720";
        el.visitorCount.textContent = data.active_viewers !== undefined ? data.active_viewers : "0";
        
        // Update local state cache
        state.is_local = data.is_local !== undefined ? data.is_local : true;
        state.youtube_url = data.youtube_url;
        
        // Handle initial video player visibility based on internet/local rules
        if (!state.video_initialized) {
            state.video_initialized = true;
            
            const savedPref = localStorage.getItem("video_collapsed");
            let shouldCollapse = false;
            
            if (savedPref !== null) {
                shouldCollapse = (savedPref === "true");
            } else {
                const isRemote = !state.is_local;
                if (isRemote) {
                    shouldCollapse = (data.internet_video_default === false);
                }
            }
            
            if (el.videoSection && el.appContainer && el.btnToggleVideo) {
                if (shouldCollapse) {
                    el.videoSection.classList.add("collapsed");
                    el.appContainer.classList.add("video-collapsed");
                    el.btnToggleVideo.classList.remove("active");
                } else {
                    el.videoSection.classList.remove("collapsed");
                    el.appContainer.classList.remove("video-collapsed");
                    el.btnToggleVideo.classList.add("active");
                }
            }
        }
        
        // Parse and update YouTube player if URL changed
        const videoId = getYoutubeVideoId(data.youtube_url);
        if (videoId && state.youtube_id !== videoId) {
            state.youtube_id = videoId;
            const initialSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&rel=0&showinfo=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
            if (el.youtubePlayer && el.youtubePlayer.src !== initialSrc) {
                el.youtubePlayer.src = initialSrc;
            }
        }
        
        // Apply internet (public client) restrictions
        const configTabBtn = document.querySelector('[data-tab="tab-config"]');
        const logsTabBtn = document.querySelector('[data-tab="tab-logs"]');
        const btnStopServer = document.getElementById("btn-stop-server");
        
        const shouldRestrict = !state.is_local;
        
        if (shouldRestrict) {
            if (configTabBtn) configTabBtn.style.display = "none";
            if (logsTabBtn) logsTabBtn.style.display = "none";
            if (btnStopServer) btnStopServer.style.display = "none";
            if (el.btnToggleConfig) el.btnToggleConfig.style.display = "none";
            
            // Force collapse the panel section as all tabs inside are administrative/restricted
            if (el.panelSection) {
                el.panelSection.classList.add("collapsed");
            }
        } else {
            if (configTabBtn) configTabBtn.style.display = "";
            if (logsTabBtn) logsTabBtn.style.display = "";
            if (btnStopServer) btnStopServer.style.display = "";
            if (el.btnToggleConfig) el.btnToggleConfig.style.display = "";
            
            // Restore collapse state based on localStorage if local/intranet
            if (el.panelSection) {
                const wasCollapsed = localStorage.getItem("config_panel_collapsed") === "true";
                if (wasCollapsed) {
                    el.panelSection.classList.add("collapsed");
                    if (el.btnToggleConfig) el.btnToggleConfig.classList.remove("active");
                } else {
                    el.panelSection.classList.remove("collapsed");
                    if (el.btnToggleConfig) el.btnToggleConfig.classList.add("active");
                }
            }
        }
        
        // Hydrate config values on load
        if (hydrateForm && el.configYoutubeUrl) {
            el.configYoutubeUrl.value = data.youtube_url || "";
        }
        
    } catch (err) {
        console.error("Status fetch error:", err);
        el.streamStatusBadge.className = "badge badge-disconnected";
        el.streamStatusBadge.textContent = t("offline");
        el.streamFps.textContent = "0.0";
    }
}

// Fetch live railway schedule
async function fetchTimetable() {
    try {
        const response = await fetch("/api/timetable");
        if (!response.ok) throw new Error("HTTP error " + response.status);
        const data = await response.json();
        
        state.timetable_cache = data;
        renderTimetableList();
    } catch (err) {
        console.error("Timetable fetch error:", err);
    }
}

// Render railway schedule items into list
function renderTimetableList() {
    const data = state.timetable_cache;
    if (data.length === 0) {
        el.timetableList.innerHTML = `
            <div class="loading-placeholder">
                <span class="material-symbols-outlined">calendar_today</span>
                <p>${t("no_scheduled_trains")}</p>
            </div>
        `;
        return;
    }
    
    // Filter by live window if collapsed (3 hours window around current time)
    let displayData = data;
    if (!state.timetable_expanded) {
        displayData = data.filter(t => t.in_live_window);
        // Fallback: if no trains in active window, show next 3
        if (displayData.length === 0) {
            displayData = data.filter(t => !t.is_passed).slice(0, 3);
            if (displayData.length === 0) {
                displayData = data.slice(-3);
            }
        }
    }
    
    let html = "";
    let activeTrainFound = false;
    
    displayData.forEach(train => {
        const isPassing = train.is_passing;
        const isPassed = train.is_passed;
        const delay = train.delay;
        const status = train.passage_status || (isPassed ? "passed" : (isPassing ? "passing" : "scheduled"));
        
        let cardClass = "timetable-card";
        if (status === "passing") cardClass += " is-passing";
        if (status === "coming") cardClass += " is-coming";
        if (status === "passed") cardClass += " is-passed";
        
        const directionClass = train.direction.toLowerCase() === "southbound" ? "direction-south" : "direction-north";
        const dirIcon = train.direction.toLowerCase() === "southbound" ? "arrow_downward" : "arrow_upward";
        
        // Delay labeling
        let delayHtml = "";
        if (status === "passed") {
            delayHtml = `<span class="train-status status-passed">${t("status_passed")}</span>`;
        } else if (status === "passing") {
            delayHtml = `<span class="train-status status-passing">${t("status_passing")}</span>`;
        } else if (status === "coming") {
            delayHtml = `<span class="train-status status-coming">${t("status_coming")}</span>`;
        } else if (delay === 0) {
            delayHtml = `<span class="train-status status-ontime">${t("status_ontime")}</span>`;
        } else {
            delayHtml = `<span class="train-status status-delay">${t("status_delay").replace("{delay}", delay)}</span>`;
        }
        
        // Identify the first active/upcoming train
        let idAttr = "";
        let dataTrainNoAttr = `data-train-no="${train.train_no}"`;
        if (!activeTrainFound && status !== "passed") {
            idAttr = 'id="active-timetable-train"';
            activeTrainFound = true;
        }
        
        html += `
            <div class="${cardClass}" ${idAttr} ${dataTrainNoAttr}>
                <div class="train-direction-icon ${directionClass}" title="${getLocalizedDirection(train.direction).toUpperCase()}">
                    <span class="material-symbols-outlined">${dirIcon}</span>
                </div>
                <div class="train-details">
                    <div class="train-main-row">
                        <a href="https://taiwanhelper.com/railway/train/${train.train_no}" target="_blank" class="train-no-link" title="${t("view_train_info")}">
                            <span class="train-no">#${train.train_no}</span>
                        </a>
                        <span class="train-time">${train.scheduled_time}</span>
                    </div>
                    <div class="train-type">${getLocalizedTrainType(train.train_type)}</div>
                    <div class="train-status-row">
                        <span class="text-muted">${t("est_prefix")} ${train.estimated_time}</span>
                        ${delayHtml}
                    </div>
                </div>
            </div>
        `;
    });
    
    el.timetableList.innerHTML = html;
    
    // Smooth-scroll active train card into focus
    const activeCard = document.getElementById("active-timetable-train");
    if (activeCard) {
        const currentActiveNo = activeCard.getAttribute("data-train-no");
        if (state.active_train_no !== currentActiveNo) {
            state.active_train_no = currentActiveNo;
            setTimeout(() => {
                activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }
}

// Fetch activity logs
async function fetchLogs() {
    try {
        const response = await fetch("/api/logs");
        if (!response.ok) throw new Error("HTTP error " + response.status);
        const data = await response.json();
        
        if (data.logs) {
            // Keep logs clean by escaping HTML
            const lines = data.logs.split("\n");
            let logsHtml = lines.map(line => {
                if (!line.trim()) return "";
                let cls = "log-line";
                if (line.includes("[ERROR]") || line.includes("Error")) cls += " text-danger";
                else if (line.includes("WARNING")) cls += " text-warning";
                else if (line.includes("Successfully connected") || line.includes("✅")) cls += " text-success";
                else if (line.includes("Resolving YouTube") || line.includes("📂")) cls += " text-info";
                return `<div class="${cls}">${escapeHtml(line)}</div>`;
            }).join("");
            
            el.logsConsole.innerHTML = logsHtml || `<div class="log-line text-muted">No activity logs recorded yet.</div>`;
            // Auto scroll console to bottom
            el.logsConsole.scrollTop = el.logsConsole.scrollHeight;
        }
    } catch (err) {
        console.error("Logs fetch error:", err);
        el.logsConsole.innerHTML = `<div class="log-line text-danger">Failed to fetch server logs.</div>`;
    }
}

// Submit configuration form
async function handleConfigSubmit(e) {
    e.preventDefault();
    
    const payload = {
        youtube_url: el.configYoutubeUrl.value.trim()
    };
    
    if (!payload.youtube_url) {
        alert("YouTube Live Stream URL cannot be empty.");
        return;
    }
    
    try {
        const response = await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert(t("alert_config_success"));
            fetchStatus(true);
        } else {
            alert(t("alert_config_fail"));
        }
    } catch (err) {
        console.error("Submit error:", err);
    }
}

// --- INITIALIZATION & BINDERS ---
document.addEventListener("DOMContentLoaded", () => {
    // Initialize localization
    applyLanguage();
    fetchStatus(true);
    fetchTimetable();
    
    // Language Toggle Click Listener
    if (el.btnToggleLang) {
        el.btnToggleLang.addEventListener("click", () => {
            state.language = state.language === "en" ? "zh" : "en";
            localStorage.setItem("lang", state.language);
            applyLanguage();
        });
    }

    // Config Panel Collapse/Expand Toggle
    if (el.btnToggleConfig && el.panelSection) {
        el.btnToggleConfig.addEventListener("click", () => {
            el.panelSection.classList.toggle("collapsed");
            const isCollapsed = el.panelSection.classList.contains("collapsed");
            localStorage.setItem("config_panel_collapsed", isCollapsed ? "true" : "false");
            el.btnToggleConfig.classList.toggle("active", !isCollapsed);
        });
        
        const wasCollapsed = localStorage.getItem("config_panel_collapsed") === "true";
        if (wasCollapsed) {
            el.panelSection.classList.add("collapsed");
        } else {
            el.btnToggleConfig.classList.add("active");
        }
    }

    // Timetable Panel — Mobile Bottom-Sheet / Desktop Collapse Toggle
    if (el.btnToggleTimetableSidebar && el.timetableSidebar) {
        // Utility: detect if we're in mobile layout
        function isMobileLayout() {
            return window.matchMedia("(max-width: 1024px), (orientation: portrait)").matches;
        }

        // Mobile bottom-sheet states: "collapsed" | "peek" | "expanded"
        let mobileSheetState = "collapsed";

        function setMobileSheetState(newState) {
            mobileSheetState = newState;
            el.timetableSidebar.classList.remove("mobile-collapsed", "mobile-peek", "mobile-expanded");
            el.timetableSidebar.classList.add("mobile-" + newState);

            // Show/hide backdrop
            if (el.timetableBackdrop) {
                if (newState === "expanded") {
                    el.timetableBackdrop.classList.add("visible");
                } else {
                    el.timetableBackdrop.classList.remove("visible");
                }
            }

            // Sync header button active state
            el.btnToggleTimetableSidebar.classList.toggle("active", newState !== "collapsed");
        }

        // Header button click: cycle through states on mobile, toggle on desktop
        el.btnToggleTimetableSidebar.addEventListener("click", () => {
            if (isMobileLayout()) {
                // Cycle: collapsed → peek → expanded → collapsed
                if (mobileSheetState === "collapsed") {
                    setMobileSheetState("peek");
                } else if (mobileSheetState === "peek") {
                    setMobileSheetState("expanded");
                } else {
                    setMobileSheetState("collapsed");
                }
            } else {
                // Desktop: simple sidebar toggle
                el.timetableSidebar.classList.toggle("collapsed");
                const isCollapsed = el.timetableSidebar.classList.contains("collapsed");
                localStorage.setItem("timetable_sidebar_collapsed", isCollapsed ? "true" : "false");
                el.btnToggleTimetableSidebar.classList.toggle("active", !isCollapsed);
            }
        });

        // Backdrop tap: close to collapsed
        if (el.timetableBackdrop) {
            el.timetableBackdrop.addEventListener("click", () => {
                setMobileSheetState("collapsed");
            });
        }

        // Drag handle: tap to toggle, swipe to drag
        if (el.timetableDragHandle) {
            let dragStartY = 0;
            let dragStartTranslateY = 0;
            let isDragging = false;
            let dragStartTime = 0;

            function getSheetTranslateY() {
                const style = window.getComputedStyle(el.timetableSidebar);
                const matrix = new DOMMatrix(style.transform);
                return matrix.m42; // translateY value
            }

            function handleDragStart(clientY) {
                isDragging = true;
                dragStartY = clientY;
                dragStartTranslateY = getSheetTranslateY();
                dragStartTime = Date.now();
                el.timetableSidebar.classList.add("dragging");
            }

            function handleDragMove(clientY) {
                if (!isDragging) return;
                const dy = clientY - dragStartY;
                // Only allow dragging down when at top, or up when at bottom
                const newTranslateY = Math.max(0, dragStartTranslateY + dy);
                el.timetableSidebar.style.transform = `translateY(${newTranslateY}px)`;
            }

            function handleDragEnd(clientY) {
                if (!isDragging) return;
                isDragging = false;
                el.timetableSidebar.classList.remove("dragging");
                el.timetableSidebar.style.transform = ""; // Clear inline, let CSS class take over

                const dy = clientY - dragStartY;
                const dt = Date.now() - dragStartTime;
                const velocity = Math.abs(dy) / dt; // px/ms
                const sheetHeight = el.timetableSidebar.offsetHeight;

                // Fast swipe detection
                if (velocity > 0.5) {
                    if (dy > 0) {
                        // Swiped down
                        setMobileSheetState(mobileSheetState === "expanded" ? "peek" : "collapsed");
                    } else {
                        // Swiped up
                        setMobileSheetState(mobileSheetState === "collapsed" ? "peek" : "expanded");
                    }
                    return;
                }

                // Position-based snap
                const currentTranslateY = dragStartTranslateY + dy;
                const pctVisible = 1 - (currentTranslateY / sheetHeight);

                if (pctVisible > 0.65) {
                    setMobileSheetState("expanded");
                } else if (pctVisible > 0.25) {
                    setMobileSheetState("peek");
                } else {
                    setMobileSheetState("collapsed");
                }
            }

            // Touch events
            el.timetableDragHandle.addEventListener("touchstart", (e) => {
                if (!isMobileLayout()) return;
                handleDragStart(e.touches[0].clientY);
            }, { passive: true });

            document.addEventListener("touchmove", (e) => {
                if (!isDragging) return;
                handleDragMove(e.touches[0].clientY);
            }, { passive: true });

            document.addEventListener("touchend", (e) => {
                if (!isDragging) return;
                const lastTouch = e.changedTouches[0];
                handleDragEnd(lastTouch.clientY);
            });

            // Mouse events (for desktop testing)
            el.timetableDragHandle.addEventListener("mousedown", (e) => {
                if (!isMobileLayout()) return;
                e.preventDefault();
                handleDragStart(e.clientY);
            });

            document.addEventListener("mousemove", (e) => {
                if (!isDragging) return;
                e.preventDefault();
                handleDragMove(e.clientY);
            });

            document.addEventListener("mouseup", (e) => {
                if (!isDragging) return;
                handleDragEnd(e.clientY);
            });

            // Tap on drag handle: cycle states
            el.timetableDragHandle.addEventListener("click", () => {
                if (!isMobileLayout()) return;
                // Only respond to taps (not drag endings — drag end already handled)
                if (mobileSheetState === "collapsed") {
                    setMobileSheetState("peek");
                } else if (mobileSheetState === "peek") {
                    setMobileSheetState("expanded");
                } else {
                    setMobileSheetState("collapsed");
                }
            });

            // Also allow tapping the sidebar header to toggle
            el.timetableSidebar.querySelector(".sidebar-header")?.addEventListener("click", () => {
                if (!isMobileLayout()) return;
                if (mobileSheetState === "collapsed") {
                    setMobileSheetState("peek");
                } else if (mobileSheetState === "peek") {
                    setMobileSheetState("expanded");
                } else {
                    setMobileSheetState("collapsed");
                }
            });
        }

        // Desktop: restore collapse state from localStorage
        const wasCollapsed = localStorage.getItem("timetable_sidebar_collapsed") === "true";
        if (!isMobileLayout()) {
            if (wasCollapsed) {
                el.timetableSidebar.classList.add("collapsed");
            } else {
                el.btnToggleTimetableSidebar.classList.add("active");
            }
        }

        // On resize: clean up states when switching between desktop and mobile
        window.addEventListener("resize", () => {
            if (isMobileLayout()) {
                el.timetableSidebar.classList.remove("collapsed");
                // Default to collapsed bottom-sheet on mobile
                if (!el.timetableSidebar.classList.contains("mobile-peek") &&
                    !el.timetableSidebar.classList.contains("mobile-expanded")) {
                    setMobileSheetState("collapsed");
                }
            } else {
                // Clean up mobile classes on desktop
                el.timetableSidebar.classList.remove("mobile-collapsed", "mobile-peek", "mobile-expanded");
                if (el.timetableBackdrop) el.timetableBackdrop.classList.remove("visible");
            }
        });

        // Initialize mobile state
        if (isMobileLayout()) {
            setMobileSheetState("collapsed");
        }
    }

    // Video Player Collapse/Expand Toggle
    if (el.btnToggleVideo && el.videoSection && el.appContainer) {
        el.btnToggleVideo.addEventListener("click", () => {
            el.videoSection.classList.toggle("collapsed");
            const isCollapsed = el.videoSection.classList.contains("collapsed");
            localStorage.setItem("video_collapsed", isCollapsed ? "true" : "false");
            el.btnToggleVideo.classList.toggle("active", !isCollapsed);
            
            if (isCollapsed) {
                el.appContainer.classList.add("video-collapsed");
            } else {
                el.appContainer.classList.remove("video-collapsed");
            }
        });
        
        const wasCollapsed = localStorage.getItem("video_collapsed") === "true";
        if (wasCollapsed) {
            el.videoSection.classList.add("collapsed");
            el.appContainer.classList.add("video-collapsed");
        } else {
            el.btnToggleVideo.classList.add("active");
        }
    }

    // Timetable Expand/Collapse Toggle Click Listener
    if (el.btnToggleTimetable) {
        el.btnToggleTimetable.addEventListener("click", () => {
            state.timetable_expanded = !state.timetable_expanded;
            localStorage.setItem("timetable_expanded", state.timetable_expanded);
            
            const icon = el.btnToggleTimetable.querySelector(".material-symbols-outlined");
            if (icon) {
                icon.textContent = state.timetable_expanded ? "unfold_less" : "unfold_more";
            }
            renderTimetableList();
        });
    }
    
    // Mute controls
    el.btnToggleMute.addEventListener("click", handleToggleMute);
    
    // Periodically update logs if logs tab is active
    setInterval(() => {
        if (state.active_tab === "tab-logs") {
            fetchLogs();
        }
    }, 3000);
    
    // Polling schedules
    setInterval(fetchStatus, 2000);     // Keep status, & stream connection synced
    setInterval(fetchTimetable, 15000); // Live Railway schedule sync
    
    // Tab switching listener
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const tabId = btn.getAttribute("data-tab");
            document.getElementById(tabId).classList.add("active");
            state.active_tab = tabId;
            
            if (tabId === "tab-logs") {
                fetchLogs();
            }
        });
    });
    
    // Form submission
    el.configForm.addEventListener("submit", handleConfigSubmit);
    
    // Refresh Stream Controls
    el.btnRefreshFeed.addEventListener("click", () => {
        if (state.youtube_id) {
            const muteVal = state.is_muted ? 1 : 0;
            const targetSrc = `https://www.youtube.com/embed/${state.youtube_id}?autoplay=1&mute=${muteVal}&controls=1&rel=0&showinfo=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&t=${Date.now()}`;
            if (el.youtubePlayer) {
                el.youtubePlayer.src = targetSrc;
            }
        }
    });
    
    // Shutdown server
    document.getElementById("btn-stop-server").addEventListener("click", async () => {
        if (!confirm(t("confirm_shutdown"))) return;
        
        try {
            const response = await fetch("/api/shutdown", { method: "POST" });
            if (response.ok) {
                alert(t("alert_shutdown_success"));
                el.streamStatusBadge.className = "badge badge-disconnected";
                el.streamStatusBadge.textContent = t("shut_down");
                el.detectorStatusDot.style.background = "var(--color-text-muted)";
                el.detectorStatusDot.style.boxShadow = "none";
                el.detectorStatusText.textContent = t("shut_down");
                if (el.youtubePlayer) el.youtubePlayer.src = "";
            }
        } catch (err) {
            alert(t("alert_shutdown_error") + err);
        }
    });
    
    // Clear & Refresh Logs button listeners
    el.btnClearLogs.addEventListener("click", () => {
        el.logsConsole.innerHTML = "";
    });
    el.btnRefreshLogs.addEventListener("click", () => {
        fetchLogs();
    });
});

// --- HELPERS ---
function sendPlayerCommand(func, args = []) {
    if (!el.youtubePlayer || !el.youtubePlayer.contentWindow) return false;
    try {
        el.youtubePlayer.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: func,
            args: args
        }), '*');
        return true;
    } catch (err) {
        console.warn("Failed to send player command:", err);
        return false;
    }
}

function handleToggleMute() {
    state.is_muted = !state.is_muted;
    updateMuteButtonState(state.is_muted);
    
    if (state.is_muted) {
        sendPlayerCommand('mute');
    } else {
        sendPlayerCommand('unMute');
        sendPlayerCommand('playVideo'); // Force play
    }
}

function updateMuteButtonState(isMuted) {
    if (!el.btnToggleMute || !el.btnMuteText) return;
    
    const icon = el.btnToggleMute.querySelector(".material-symbols-outlined");
    if (isMuted) {
        if (icon) icon.textContent = "volume_off";
        el.btnMuteText.textContent = t("btn_unmute");
        el.btnToggleMute.classList.remove("btn-primary");
        el.btnToggleMute.classList.add("btn-secondary");
    } else {
        if (icon) icon.textContent = "volume_up";
        el.btnMuteText.textContent = t("btn_mute");
        el.btnToggleMute.classList.remove("btn-secondary");
        el.btnToggleMute.classList.add("btn-primary");
    }
}

function getYoutubeVideoId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}
