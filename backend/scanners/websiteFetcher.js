
const axios = require("axios");
const { validateURL } = require("./linkScanner");

async function fetchWebsite(input) {
    const safeURL = await validateURL(input);

    const startTime = Date.now();

    const response = await axios.get(safeURL, {
        timeout: 15000,
        maxRedirects: 5,
        maxContentLength: 2 * 1024 * 1024,
        responseType: "text",
        validateStatus: () => true,
        headers: {
            "User-Agent": "DeadLinkDetective/2.0",
            "Accept": "text/html,application/xhtml+xml"
        }
    });

    const html = typeof response.data === "string"
        ? response.data
        : "";

    const finalURL = response.request?.res?.responseUrl || safeURL;

    return {
        requestedURL: safeURL,
        finalURL,
        statusCode: response.status,
        responseTime: Date.now() - startTime,
        headers: response.headers,
        html,
        htmlBytes: Buffer.byteLength(html, "utf8"),
        contentType: response.headers["content-type"] || "Unknown"
    };
}

module.exports = { fetchWebsite };
