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
        
        // JS dynamic labels/messages
        connected: "CONNECTED",
        offline: "OFFLINE",
        shut_down: "SHUT DOWN",
        
        // JS dialogs
        confirm_shutdown: "Are you sure you want to shut down the server process? This will terminate all background streaming.",
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
        
        // JS dynamic labels/messages
        connected: "連線成功",
        offline: "中斷連線",
        shut_down: "伺服器已關閉",
        
        // JS dialogs
        confirm_shutdown: "您確定要關閉伺服器主程式嗎？這將會終止背景的串流運作。",
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
}

// --- DOM ELEMENTS ---
const el = {
    btnToggleLang: document.getElementById("btn-toggle-lang"),
    btnToggleConfig: document.getElementById("btn-toggle-config"),
    btnToggleVideo: document.getElementById("btn-toggle-video"),
    videoSection: document.querySelector(".video-section"),
    appContainer: document.querySelector(".app-container"),
    panelSection: document.querySelector(".panel-section"),
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
