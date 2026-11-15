
const fs = require("fs").promises;
const path = require("path");

const reportsFolder = path.join(__dirname, "../reports");

// Convert website URL into a safe folder/file name.
function getWebsiteName(url) {
    try {
        const hostname = new URL(
            url.startsWith("http") ? url : `https://${url}`
        ).hostname;

        return hostname
            .replace(/^www\./, "")
            .replace(/[^a-zA-Z0-9.-]/g, "_")
            .replace(/\./g, "_");
    } catch {
        return "website_report";
    }
}

// Generate a readable Indian date and time.
function getIndianTimestamp() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());

    const values = {};
    parts.forEach(part => {
        values[part.type] = part.value;
    });

    return `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}-${values.second}`;
}

async function generateReports(scanData) {
    await fs.mkdir(reportsFolder, { recursive: true });

    const results = scanData.results || [];
    const firstURL = results[0]?.url || "website";
    const websiteName = getWebsiteName(firstURL);

    const timestamp = getIndianTimestamp();

    // Example: example_com_2026-11-13_09-30-15
    const folderName = `${websiteName}_${timestamp}`;
    const folderPath = path.join(reportsFolder, folderName);

    await fs.mkdir(folderPath, { recursive: true });

    const jsonFileName = `${websiteName}_Report.json`;
    const txtFileName = `${websiteName}_Report.txt`;

    const jsonPath = path.join(folderPath, jsonFileName);
    const txtPath = path.join(folderPath, txtFileName);

    const report = {
        project: "Dead Link Detective",
        website: firstURL,
        generatedAt: new Date().toISOString(),
        generatedAtIST: timestamp,
        scanMode: scanData.scanMode || "light",

        summary: {
            totalURLs: scanData.totalURLs || 0,
            working: scanData.working || 0,
            broken: scanData.broken || 0,
            unreachable: scanData.unreachable || 0,
            slow: scanData.slow || 0,
            verySlow: scanData.verySlow || 0,
            totalChecks: scanData.totalChecks || 0,
            passed: scanData.passed || 0,
            failed: scanData.failed || 0,
            warnings: scanData.warnings || 0,
            websiteScore: scanData.websiteScore || 0,
            scoreLabel: scanData.scoreLabel || "Not calculated"
        },

        results,
        linkCrawlSummary: scanData.linkCrawlSummary || {},
        analysis: scanData.analysis || [],
        findings: scanData.findings || [],
        recommendations: scanData.recommendations || []
    };

    // Write complete JSON report.
    await fs.writeFile(
        jsonPath,
        JSON.stringify(report, null, 4),
        "utf8"
    );

    // Build readable TXT report.
    let txt = "";

    txt += "==================================================\n";
    txt += "               DEAD LINK DETECTIVE\n";
    txt += "                  SCAN REPORT\n";
    txt += "==================================================\n\n";

    txt += `Website: ${firstURL}\n`;
    txt += `Generated: ${timestamp} IST\n`;
    txt += `Scan Mode: ${report.scanMode.toUpperCase()}\n\n`;

    txt += "------------------ SUMMARY ------------------\n";

    Object.entries(report.summary).forEach(([key, value]) => {
        txt += `${key}: ${value}\n`;
    });

    txt += "\n---------------- URL RESULTS ----------------\n\n";

    results.forEach((result, index) => {
        txt += `Website ${index + 1}\n`;
        txt += `URL: ${result.url || "N/A"}\n`;
        txt += `Final URL: ${result.finalURL || "N/A"}\n`;
        txt += `HTTP Status: ${result.statusCode ?? "N/A"}\n`;
        txt += `Response Time: ${result.responseTime ?? "N/A"} ms\n`;
        txt += `Status: ${result.status || "N/A"}\n`;
        txt += `Speed: ${result.speedStatus || "N/A"}\n`;
        txt += `Redirected: ${result.redirected ? "Yes" : "No"}\n`;

        if (result.error) {
            txt += `Error: ${result.error}\n`;
        }

        txt += "\n----------------------------------------------\n\n";
    });

    txt += "---------------- LINK CRAWLER ----------------\n\n";

    const crawl = report.linkCrawlSummary;

    Object.entries(crawl).forEach(([key, value]) => {
        if (key !== "links") {
            txt += `${key}: ${value}\n`;
        }
    });

    if (Array.isArray(crawl.links)) {
        txt += "\nINDIVIDUAL LINKS\n\n";

        crawl.links.forEach((link, index) => {
            txt += `Link ${index + 1}\n`;
            txt += `Website: ${link.website || "N/A"}\n`;
            txt += `URL: ${link.url || "N/A"}\n`;
            txt += `Status: ${link.status || "N/A"}\n`;
            txt += `HTTP Status: ${link.statusCode ?? "N/A"}\n`;
            txt += `Final URL: ${link.finalURL || "N/A"}\n`;
            txt += `Details: ${link.details || "N/A"}\n\n`;
        });
    }

    txt += "\n---------------- ANALYSIS ----------------\n\n";

    report.analysis.forEach((item, index) => {
        txt += `Analysis ${index + 1}: ${item.url || "N/A"}\n`;

        if (Array.isArray(item.tests)) {
            item.tests.forEach(test => {
                txt += `- ${test.name}: ${test.status} - ${test.details || ""}\n`;
            });
        }

        if (item.errors?.length) {
            txt += `Errors: ${item.errors.join("; ")}\n`;
        }

        txt += "\n";
    });

    txt += "==================================================\n";
    txt += "                 END OF REPORT\n";
    txt += "==================================================\n";

    await fs.writeFile(txtPath, txt, "utf8");

    console.log("Reports saved successfully:", folderPath);

    return {
        folderName,
        folderPath: `reports/${folderName}`,
        jsonReport: jsonFileName,
        txtReport: txtFileName
    };
}

module.exports = { generateReports };
