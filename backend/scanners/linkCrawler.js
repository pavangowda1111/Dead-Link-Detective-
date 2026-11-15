
const { checkLink } = require("./linkScanner");

const MAX_LINKS = 100;
const CONCURRENCY = 5;

function extractLinks(html, baseURL) {
    const links = [];
    const seen = new Set();

    const anchorRegex = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;

    let match;

    while ((match = anchorRegex.exec(html)) !== null) {
        let href = match[1] || match[2] || match[3] || "";

        href = href.trim().replace(/&amp;/gi, "&");

        if (
            !href ||
            href.startsWith("#") ||
            /^(mailto:|tel:|javascript:|data:|sms:)/i.test(href)
        ) {
            continue;
        }

        try {
            const parsedURL = new URL(href, baseURL);

            if (!["http:", "https:"].includes(parsedURL.protocol)) {
                continue;
            }

            parsedURL.hash = "";

            const normalizedURL = parsedURL.href;

            if (!seen.has(normalizedURL)) {
                seen.add(normalizedURL);
                links.push(normalizedURL);
            }
        } catch {
            // Ignore malformed links.
        }
    }

    return links;
}

async function runWithLimit(items, limit, task) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index = nextIndex++;

            if (index >= items.length) {
                return;
            }

            results[index] = await task(items[index], index);
        }
    }

    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        () => worker()
    );

    await Promise.all(workers);

    return results;
}

async function crawlWebsiteLinks(baseURL, html) {
    if (!baseURL || typeof html !== "string") {
        throw new Error("A valid website URL and HTML content are required.");
    }

    const discoveredLinks = extractLinks(html, baseURL);

    const limitedLinks = discoveredLinks.slice(0, MAX_LINKS);

    const baseHostname = new URL(baseURL).hostname.toLowerCase();

    const results = await runWithLimit(
        limitedLinks,
        CONCURRENCY,
        async (url) => {
            let category = "external";

            try {
                const hostname = new URL(url).hostname.toLowerCase();

                if (hostname === baseHostname) {
                    category = "internal";
                }
            } catch {
                // Keep the default category.
            }

            try {
                const result = await checkLink(url);

                return {
                    ...result,
                    category
                };
            } catch (error) {
                return {
                    url,
                    finalURL: null,
                    statusCode: null,
                    responseTime: 0,
                    redirected: false,
                    status: "Unreachable",
                    speedStatus: "Unknown",
                    isSlow: false,
                    error: error.message,
                    category
                };
            }
        }
    );

    const internalLinks = results.filter(
        item => item.category === "internal"
    );

    const externalLinks = results.filter(
        item => item.category === "external"
    );

    const working = results.filter(
        item => item.status === "Working"
    ).length;

    const broken = results.filter(
        item => item.status === "Broken"
    ).length;

    const unreachable = results.filter(
        item => item.status === "Unreachable"
    ).length;

    const redirected = results.filter(
        item => item.redirected
    ).length;

    return {
        baseURL,
        totalFound: discoveredLinks.length,
        totalChecked: results.length,
        skippedByLimit: Math.max(
            discoveredLinks.length - results.length,
            0
        ),

        internalCount: internalLinks.length,
        externalCount: externalLinks.length,

        working,
        broken,
        unreachable,
        redirected,

        internalLinks,
        externalLinks,
        results
    };
}

module.exports = { crawlWebsiteLinks };
