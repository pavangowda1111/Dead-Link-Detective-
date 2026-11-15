
const axios = require("axios");
const dns = require("dns").promises;
const net = require("net");

async function validateURL(input) {
    try {
        const url = new URL(input);

        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Only HTTP and HTTPS URLs are allowed.");
        }

        const hostname = url.hostname.toLowerCase();

        if (
            hostname === "localhost" ||
            hostname.endsWith(".localhost") ||
            hostname.endsWith(".local")
        ) {
            throw new Error("Local addresses are not allowed.");
        }

        const addresses = net.isIP(hostname)
            ? [{ address: hostname }]
            : await dns.lookup(hostname, { all: true });

        if (!addresses.length) {
            throw new Error("Hostname could not be resolved.");
        }

        for (const item of addresses) {
            const ip = item.address;

            if (net.isIP(ip) === 4) {
                const parts = ip.split(".").map(Number);

                const blocked =
                    parts[0] === 0 ||
                    parts[0] === 10 ||
                    parts[0] === 127 ||
                    parts[0] >= 224 ||
                    (parts[0] === 169 && parts[1] === 254) ||
                    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
                    (parts[0] === 192 && parts[1] === 168);

                if (blocked) {
                    throw new Error("Private or reserved IP addresses are not allowed.");
                }
            } else {
                const normalized = ip.toLowerCase();

                const blocked =
                    normalized === "::1" ||
                    normalized === "::" ||
                    normalized.startsWith("fc") ||
                    normalized.startsWith("fd") ||
                    normalized.startsWith("fe80:") ||
                    normalized.startsWith("::ffff:127.") ||
                    normalized.startsWith("::ffff:10.") ||
                    normalized.startsWith("::ffff:192.168.");

                if (blocked) {
                    throw new Error("Private or reserved IP addresses are not allowed.");
                }
            }
        }

        return url.toString();

    } catch (error) {
        throw new Error(error.message || "Invalid URL.");
    }
}

function getSpeedStatus(responseTime) {
    if (responseTime > 5000) return "Very Slow";
    if (responseTime >= 2000) return "Slow";
    return "Normal";
}

async function checkLink(input) {
    const startTime = Date.now();

    try {
        const url = await validateURL(input);

        const response = await axios.get(url, {
            timeout: 12000,
            maxRedirects: 5,
            maxContentLength: 2 * 1024 * 1024,
            validateStatus: () => true,
            headers: {
                "User-Agent": "DeadLinkDetective/2.0"
            }
        });

        const responseTime = Date.now() - startTime;
        const finalURL = response.request?.res?.responseUrl || url;
        const speedStatus = getSpeedStatus(responseTime);

        return {
            url: input,
            finalURL,
            statusCode: response.status,
            responseTime,
            redirected: finalURL !== url,
            status:
                response.status >= 200 && response.status < 400
                    ? "Working"
                    : "Broken",
            speedStatus,
            isSlow: responseTime >= 2000
        };

    } catch (error) {
        return {
            url: input,
            finalURL: null,
            statusCode: null,
            responseTime: Date.now() - startTime,
            redirected: false,
            status: "Unreachable",
            speedStatus: "Unreachable",
            isSlow: false,
            error: error.message
        };
    }
}

async function scanLinks(urls) {
    if (!Array.isArray(urls) || urls.length === 0) {
        throw new Error("Please provide at least one URL.");
    }

    if (urls.length > 50) {
        throw new Error("Maximum 50 URLs allowed per scan.");
    }

    const results = await Promise.all(
        urls.map(url => checkLink(url))
    );

    return {
        totalURLs: results.length,
        working: results.filter(r => r.status === "Working").length,
        broken: results.filter(r => r.status === "Broken").length,
        unreachable: results.filter(r => r.status === "Unreachable").length,
        slow: results.filter(r => r.speedStatus === "Slow").length,
        verySlow: results.filter(r => r.speedStatus === "Very Slow").length,
        results
    };
}

module.exports = {
    scanLinks,
    checkLink,
    validateURL,
    getSpeedStatus
};
