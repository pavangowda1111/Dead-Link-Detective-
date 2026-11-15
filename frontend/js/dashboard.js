
const API = "http://localhost:5000/api";

let currentScanId = null;

// Check backend connection
async function checkConnection() {
    const status = document.getElementById("connectionStatus");

    try {
        const response = await fetch(`${API}/health`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Backend unavailable");
        }

        status.textContent = "Connected";
        status.style.color = "#52d99b";

    } catch (error) {
        status.textContent = "Disconnected";
        status.style.color = "#ff747e";
    }
}

// Start website scan
async function startScan() {
    const input = document.getElementById("urlInput");
    const button = document.getElementById("scanButton");
    const message = document.getElementById("scanMessage");

    const urls = input.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(Boolean);

    if (urls.length === 0) {
        message.textContent = "Please enter at least one URL.";
        return;
    }

    if (urls.length > 50) {
        message.textContent = "Maximum 50 URLs allowed.";
        return;
    }

    button.disabled = true;
    button.textContent = "SCANNING...";
    message.textContent = "Analyzing websites. Please wait...";

    try {
        const response = await fetch(`${API}/scan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ urls })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Scan failed.");
        }

        currentScanId = result.scanId;

        displayResults(result.data);
        updateStatistics(result.data);

        document.getElementById("downloadArea").hidden = false;

        document.getElementById("jsonDownload").onclick = () => {
            downloadReport(currentScanId, "json");
        };

        document.getElementById("txtDownload").onclick = () => {
            downloadReport(currentScanId, "txt");
        };

        message.textContent =
            "Scan completed successfully! Reports generated: " +
            (result.reportsGenerated ? "Yes" : "No");

        await loadHistory();

    } catch (error) {
        message.textContent = error.message;
    } finally {
        button.disabled = false;
        button.textContent = "START WEBSITE SCAN →";
    }
}

// Update dashboard statistics
function updateStatistics(data) {
    document.getElementById("totalURLs").textContent = data.totalURLs;
    document.getElementById("workingURLs").textContent = data.working;
    document.getElementById("brokenURLs").textContent = data.broken;

    document.getElementById("slowURLs").textContent =
        data.slow + data.verySlow;
}

// Display scan results
function displayResults(data) {
    const body = document.getElementById("resultsBody");

    document.getElementById("resultCount").textContent =
        `${data.results.length} RESULTS`;

    body.replaceChildren();

    data.results.forEach(result => {
        const row = document.createElement("tr");

        const values = [
            result.url,
            result.status,
            result.statusCode ?? "N/A",
            `${result.responseTime} ms`,
            result.speedStatus || "Unknown",
            result.redirected ? "Yes" : "No"
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;

            if (index === 1) {
                cell.className = result.status === "Working"
                    ? "status-working"
                    : result.status === "Broken"
                        ? "status-broken"
                        : "status-unreachable";
            }

            if (index === 4) {
                cell.className =
                    result.speedStatus === "Very Slow" ||
                    result.speedStatus === "Slow"
                        ? "status-slow"
                        : "status-normal";
            }

            row.appendChild(cell);
        });

        body.appendChild(row);
    });
}

// Download JSON or TXT report
function downloadReport(scanId, format) {
    const url = `${API}/reports/${encodeURIComponent(scanId)}/${format}`;

    const link = document.createElement("a");
    link.href = url;
    link.download = `scan-${scanId}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

// Load previous scans
async function loadHistory() {
    const historyList = document.getElementById("historyList");

    historyList.textContent = "Loading scan history...";

    try {
        const response = await fetch(`${API}/history`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load history.");
        }

        historyList.replaceChildren();

        if (result.data.length === 0) {
            historyList.textContent = "No previous scans found.";
            return;
        }

        result.data.forEach(scan => {
            const item = document.createElement("div");
            item.className = "history-item";

            const details = document.createElement("div");

            const title = document.createElement("h3");
            title.textContent = `Scan ID: ${scan._id}`;

            const date = document.createElement("p");
            date.textContent =
                `Date: ${new Date(scan.createdAt).toLocaleString()}`;

            const summary = document.createElement("p");
            summary.textContent =
                `Total: ${scan.totalURLs} | Working: ${scan.working} | Broken: ${scan.broken} | Slow: ${(scan.slow || 0) + (scan.verySlow || 0)}`;

            details.append(title, date, summary);

            const actions = document.createElement("div");
            actions.className = "history-actions";

            ["json", "txt"].forEach(format => {
                const link = document.createElement("a");
                link.href = `${API}/reports/${encodeURIComponent(scan._id)}/${format}`;
                link.download = `scan-${scan._id}.${format}`;
                link.textContent = `Download ${format.toUpperCase()}`;
                actions.appendChild(link);
            });

            item.append(details, actions);
            historyList.appendChild(item);
        });

    } catch (error) {
        historyList.textContent = error.message;
    }
}

// Initialize dashboard
checkConnection();
loadHistory();

setInterval(checkConnection, 30000);
