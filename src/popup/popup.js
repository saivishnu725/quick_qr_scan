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
    }
});

// --- Helper functions ---

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
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

// --- Main scan function ---

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