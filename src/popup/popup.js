// cross browser compatibility
const api = window.browser ?? window.chrome;

const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultLabelEl = document.getElementById("result-label");
const scanEl = document.getElementById("scanBtn");

console.log("Popup script loaded");

scanBtn.addEventListener("click", async () => {
    scanVisibleAreaForQr().catch((err) => {
        console.error("Error scanning visible area for QR code:", err);
        statusEl.textContent = "Error scanning for QR code.";
    });
});

async function captureVisibleTabAsDataUrl() {
    return new Promise((resolve, reject) => {
        try {
            api.tabs.captureVisibleTab(
                null,
                { format: "png" },
                (dataUrl) => {
                    const lastError = api.runtime && api.runtime.lastError;
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

async function scanVisibleAreaForQr() {
    // UI: scanning state
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
    img.onload = () => {
        try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            console.log("Image data obtained from canvas:", imageData);
            const qr = jsQR(imageData.data, imageData.width, imageData.height);
            console.log("QR code scan result:", qr);
            if (qr) {
                statusEl.textContent = "QR code detected!";
                resultLabelEl.style.display = "block";
                resultEl.textContent = qr.data;

                // copy to clipboard
                navigator.clipboard.writeText(qr.data).catch((err) => {
                    console.error("Failed to copy QR code data to clipboard:", err);
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