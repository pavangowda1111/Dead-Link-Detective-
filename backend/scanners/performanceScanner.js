
function scanPerformance(page) {
    const headers = page.headers || {};

    const responseTime = page.responseTime || 0;
    const htmlBytes = page.htmlBytes || 0;

    let speedStatus = "Normal";

    if (responseTime >= 5000) {
        speedStatus = "Very Slow";
    } else if (responseTime >= 2000) {
        speedStatus = "Slow";
    }

    const contentEncoding = headers["content-encoding"] || "None";
    const cacheControl = headers["cache-control"] || null;

    const compressionEnabled =
        contentEncoding !== "None";

    const issues = [];

    if (responseTime >= 2000) {
        issues.push("The initial page response took more than 2 seconds.");
    }

    if (!compressionEnabled) {
        issues.push("No response compression was detected.");
    }

    if (!cacheControl) {
        issues.push("No Cache-Control response header was detected.");
    }

    return {
        responseTime,
        speedStatus,
        htmlSizeBytes: htmlBytes,
        htmlSizeKB: Number((htmlBytes / 1024).toFixed(2)),
        contentEncoding,
        compressionEnabled,
        cacheControl,
        issuesCount: issues.length,
        issues,
        measurementNote: "Basic HTTP response measurements only. Not a Lighthouse score or Core Web Vitals measurement."
    };
}

module.exports = { scanPerformance };
