// cross browser compatibility
const api = window.browser ?? window.chrome;

const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultLabelEl = document.getElementById("result-label");
const scanBtn = document.getElementById("scanBtn");

const historySectionEl = document.getElementById("history-section");
const historyEmptyEl = document.getElementById("history-empty");
const historyListEl = document.getElementById("history-list");

// in-memory history for this popup instance only
const scanHistory = [];

const STORAGE_KEY = "quick_qr_history_v1";
console.log("Quick QR Scan popup loaded");

// --- Event listeners ---

scanBtn.addEventListener("click", () => {
    scanVisibleAreaForQr().catch((err) => {
        console.error("Unexpected error in scan:", err);
        statusEl.textContent = "Unexpected error during scan.";
        scanBtn.disabled = false;
    });
});

// Delegate delete click events from history list
historyListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!target.classList.contains("history-delete-btn")) return;

    const id = target.getAttribute("data-id");
    if (!id) return;

    const index = scanHistory.findIndex((item) => item.id === id);
    if (index !== -1) {
        scanHistory.splice(index, 1);
        renderHistory();
        saveHistoryToStorage();
    }
});

// --- Storage helpers (cross-browser callback+promise support) ---

function storageGet(key, defaultValue = null) {
    // Prefer Promise-style browser API when available
    if (window.browser && browser.storage && browser.storage.local && typeof browser.storage.local.get === "function") {
        return browser.storage.local.get(key).then((res) => {
            return (res && Object.prototype.hasOwnProperty.call(res, key)) ? res[key] : defaultValue;
        }).catch(() => defaultValue);
    }

    // Fallback to chrome callback-style
    return new Promise((resolve) => {
        try {
            api.storage.local.get(key, (res) => {
                const lastErr = api.runtime && api.runtime.lastError;
                if (lastErr) {
                    console.warn("storage.get error:", lastErr);
                    resolve(defaultValue);
                    return;
                }
                resolve((res && Object.prototype.hasOwnProperty.call(res, key)) ? res[key] : defaultValue);
            });
        } catch (e) {
            console.warn("storage.get threw:", e);
            resolve(defaultValue);
        }
    });
}

function storageSet(obj) {
    if (window.browser && browser.storage && browser.storage.local && typeof browser.storage.local.set === "function") {
        return browser.storage.local.set(obj).catch((e) => {
            console.warn("storage.set failed:", e);
        });
    }

    return new Promise((resolve) => {
        try {
            api.storage.local.set(obj, () => {
                const lastErr = api.runtime && api.runtime.lastError;
                if (lastErr) {
                    console.warn("storage.set error:", lastErr);
                }
                resolve();
            });
        } catch (e) {
            console.warn("storage.set threw:", e);
            resolve();
        }
    });
}

// --- Helper functions ---

async function loadHistoryFromStorage() {
    try {
        const val = await storageGet(STORAGE_KEY, []);
        if (Array.isArray(val)) {
            // Convert stored timestamps back to Date objects if necessary
            scanHistory.length = 0;
            for (const item of val) {
                // item.timestamp may be ISO string or a Date; normalize to Date
                let ts = item.timestamp;
                if (typeof ts === "string") {
                    try {
                        ts = new Date(ts);
                    } catch {
                        ts = new Date();
                    }
                } else if (!(ts instanceof Date)) {
                    ts = new Date();
                }
                scanHistory.push({
                    id: item.id,
                    text: item.text,
                    tabTitle: item.tabTitle,
                    tabUrl: item.tabUrl,
                    timestamp: ts
                });
            }
        }
    } catch (err) {
        console.warn("Failed to load history from storage:", err);
    }
    renderHistory();
}

async function saveHistoryToStorage() {
    try {
        // Prepare a serializable copy (convert Date -> ISO string)
        const serial = scanHistory.map((it) => ({
            id: it.id,
            text: it.text,
            tabTitle: it.tabTitle,
            tabUrl: it.tabUrl,
            timestamp: (it.timestamp instanceof Date) ? it.timestamp.toISOString() : new Date().toISOString()
        }));
        await storageSet({ [STORAGE_KEY]: serial });
    } catch (err) {
        console.warn("Failed to save history to storage:", err);
    }
}

function addToHistory({ text, tabTitle, tabUrl }) {
    const id = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    const timestamp = new Date();

    scanHistory.unshift({
        id,
        text,
        tabTitle,
        tabUrl,
        timestamp
    });

    // limit history size to something reasonable
    if (scanHistory.length > 50) { // TODO: make this configurable?
        scanHistory.length = 50;
    }

    renderHistory();
    saveHistoryToStorage();
}

function renderHistory() {
    if (scanHistory.length === 0) {
        historyEmptyEl.style.display = "block";
        historyListEl.innerHTML = "";
        return;
    }

    historyEmptyEl.style.display = "none";
    historyListEl.innerHTML = "";

    for (const item of scanHistory) {
        const li = document.createElement("li");
        li.className = "history-item";

        const titleRow = document.createElement("div");
        titleRow.className = "history-title-row";

        const titleSpan = document.createElement("span");
        titleSpan.className = "history-tab-title";
        titleSpan.textContent = item.tabTitle || "(No title)";

        const timeSpan = document.createElement("span");
        timeSpan.className = "history-time";
        timeSpan.textContent = formatTime(item.timestamp);

        titleRow.appendChild(titleSpan);
        titleRow.appendChild(timeSpan);

        const textDiv = document.createElement("div");
        textDiv.className = "history-text";
        textDiv.textContent = item.text;

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "history-delete-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.setAttribute("data-id", item.id);
        deleteBtn.setAttribute("aria-label", "Delete history item");

        li.appendChild(titleRow);
        li.appendChild(textDiv);
        li.appendChild(deleteBtn);

        historyListEl.appendChild(li);
    }
}

function formatTime(date) {
    try {
        // Accept Date object or ISO string
        let d = date;
        if (!(d instanceof Date)) {
            d = new Date(d);
        }
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

// --- Main scan function ---

async function captureVisibleTabAsDataUrl() {
    return new Promise((resolve, reject) => {
        try {
            api.tabs.captureVisibleTab(
                null,
                { format: "png" },
                (dataUrl) => {
                    // chrome: lastError via runtime
                    const lastError =
                        (api.runtime && api.runtime.lastError) ||
                        (api.runtime && api.runtime.lasterror); // paranoia

                    if (lastError) {
                        return reject(new Error(lastError.message));
                    }
                    if (!dataUrl) {
                        return reject(new Error("Failed to capture visible tab."));
                    }
                    resolve(dataUrl);
                }
            );
        } catch (err) {
            reject(err);
        }
    });
}

async function getActiveTab() {
    return new Promise((resolve, reject) => {
        try {
            api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const lastError = api.runtime && api.runtime.lastError;
                if (lastError) {
                    return reject(new Error(lastError.message));
                }
                if (!tabs || tabs.length === 0) {
                    return resolve(null);
                }
                resolve(tabs[0]);
            });
        } catch (err) {
            reject(err);
        }
    });
}

async function scanVisibleAreaForQr() {
    scanBtn.disabled = true;
    statusEl.textContent = "Capturing visible area...";
    resultLabelEl.style.display = "none";
    resultEl.textContent = "";

    let dataUrl;
    try {
        dataUrl = await captureVisibleTabAsDataUrl();
    } catch (err) {
        statusEl.textContent = "Failed to capture visible area.";
        scanBtn.disabled = false;
        return;
    }

    statusEl.textContent = "Decoding QR code...";

    const img = new Image();
    img.onload = async () => {
        try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const qr = jsQR(imageData.data, canvas.width, canvas.height);

            if (qr) {
                statusEl.textContent = "QR code found!";
                resultLabelEl.style.display = "inline";
                resultEl.textContent = qr.data;

                // copy to clipboard
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(qr.data).catch(() => { });
                }

                // active tab info
                let tabTitle = "";
                let tabUrl = "";
                try {
                    const activeTab = await getActiveTab();
                    if (activeTab) {
                        tabTitle = activeTab.title || "";
                        tabUrl = activeTab.url || "";
                    }
                } catch (err) {
                    console.warn("Could not get active tab info:", err);
                }

                addToHistory({
                    text: qr.data,
                    tabTitle,
                    tabUrl
                });
            } else {
                statusEl.textContent = "No QR code found.";
                resultLabelEl.style.display = "none";
                resultEl.textContent = "";
            }
        } catch (err) {
            console.error("Error processing image for QR code:", err);
            statusEl.textContent = "Error decoding QR code.";
        } finally {
            scanBtn.disabled = false;
        }
    };

    img.onerror = (err) => {
        console.error("Error loading captured image:", err);
        statusEl.textContent = "Error loading captured image.";
        scanBtn.disabled = false;
    };

    img.src = dataUrl;
}

// --- Init: load stored history on popup open ---
(async function init() {
    await loadHistoryFromStorage();
})();
