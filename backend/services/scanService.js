
const dns = require("dns").promises;
const tls = require("tls");

const TIMEOUT = 15000;
const LINK_TIMEOUT = 8000;
const REQUEST_HEADERS = {
    "User-Agent": "DeadLinkDetective/1.0"
};

// --------------------------------------------------
// TEST CONFIGURATION
// --------------------------------------------------

const LIGHT_TESTS = [
    "Website Reachability",
    "HTTP Response Status",
    "HTTPS Encryption",
    "Page Response Time",
    "HTML Content Type",
    "Page Title",
    "Meta Description",
    "Mobile Viewport",
    "Main Heading (H1)",
    "Canonical URL",
    "Robots Meta Tag",
    "Favicon Reference"
];

const DEEP_TESTS = [
    "SSL Certificate",
    "TLS Protocol",
    "HSTS Header",
    "Content Security Policy",
    "Content Type Protection",
    "Clickjacking Protection",
    "Referrer Policy",
    "Permissions Policy",
    "DNS Resolution",
    "Mixed Content",
    "Form Submission Security",
    "Image Accessibility",
    "HTML Language Attribute",
    "Character Encoding"
];

const CLI_TESTS = [
    "XML Sitemap",
    "Robots.txt",
    "Response Compression",
    "Cache Control",
    "Server Information Exposure",
    "Technology Header Exposure",
    "Cross-Origin Opener Policy",
    "Cross-Origin Resource Policy",
    "Cross-Origin Embedder Policy",
    "External Link Protection",
    "HTML Page Size",
    "Redirect Detection",
    "Canonical HTTPS",
    "External Script Transport",
    "Iframe Sandbox Attribute"
];

function getTestNames(mode) {
    if (mode === "light") return [...LIGHT_TESTS];

    if (mode === "full") {
        return [...LIGHT_TESTS, ...DEEP_TESTS];
    }

    return [...LIGHT_TESTS, ...DEEP_TESTS, ...CLI_TESTS];
}

// --------------------------------------------------
// CATEGORIES
// --------------------------------------------------

function getCategory(name) {
    if (
        name.includes("SSL") ||
        name.includes("TLS") ||
        name.includes("HTTPS") ||
        name.includes("HSTS") ||
        name.includes("Security") ||
        name.includes("Protection") ||
        name.includes("Policy") ||
        name.includes("Mixed Content") ||
        name.includes("Exposure")
    ) {
        return "Security";
    }

    if (
        name.includes("DNS") ||
        name.includes("Reachability") ||
        name.includes("HTTP") ||
        name.includes("Response") ||
        name.includes("Redirect") ||
        name.includes("Sitemap") ||
        name.includes("Robots")
    ) {
        return "Network";
    }

    if (
        name.includes("Title") ||
        name.includes("Description") ||
        name.includes("Heading") ||
        name.includes("Canonical") ||
        name.includes("Language") ||
        name.includes("Character") ||
        name.includes("Favicon")
    ) {
        return "SEO";
    }

    if (
        name.includes("Image") ||
        name.includes("Viewport") ||
        name.includes("Iframe")
    ) {
        return "Accessibility";
    }

    if (
        name.includes("Compression") ||
        name.includes("Cache") ||
        name.includes("Page Size") ||
        name.includes("Response Time")
    ) {
        return "Performance";
    }

    if (name.includes("Form")) return "Security";

    return "General";
}

function makeTest(name, status, details) {
    return {
        name,
        category: getCategory(name),
        status,
        details
    };
}

// --------------------------------------------------
// HTML HELPERS
// --------------------------------------------------

function extractAttribute(tag, attribute) {
    const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const match = tag.match(
        new RegExp(
            `${escaped}\\s*=\\s*["']([^"']*)["']`,
            "i"
        )
    );

    return match ? match[1].trim() : "";
}

function extractLinks(html, baseURL) {
    const matches = [...html.matchAll(/<a\b[^>]*>/gi)];
    const links = [];

    for (const match of matches) {
        const href = extractAttribute(match[0], "href");

        if (!href) continue;

        try {
            const parsed = new URL(href, baseURL);

            if (!["http:", "https:"].includes(parsed.protocol)) {
                continue;
            }

            parsed.hash = "";

            links.push(parsed.href);
        } catch {
            // Ignore invalid links.
        }
    }

    return [...new Set(links)];
}

function isPrivateHostname(hostname) {
    const host = hostname.toLowerCase();

    return (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
}

// --------------------------------------------------
// WEBSITE REQUEST
// --------------------------------------------------

async function requestPage(url) {
    const startTime = Date.now();

    const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT),
        headers: REQUEST_HEADERS
    });

    const html = await response.text();

    return {
        response,
        html,
        finalURL: response.url,
        statusCode: response.status,
        headers: response.headers,
        contentType: response.headers.get("content-type") || "",
        htmlBytes: Buffer.byteLength(html, "utf8"),
        responseTime: Date.now() - startTime
    };
}

// --------------------------------------------------
// RESOURCE PROBE
// --------------------------------------------------

async function probeURL(url) {
    try {
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(LINK_TIMEOUT),
            headers: REQUEST_HEADERS
        });

        const result = {
            available: response.status >= 200 && response.status < 400,
            statusCode: response.status,
            finalURL: response.url
        };

        await response.body?.cancel();

        return result;
    } catch (error) {
        return {
            available: false,
            error: error.message
        };
    }
}

// --------------------------------------------------
// TLS CERTIFICATE CHECK
// --------------------------------------------------

async function checkTLS(hostname) {
    return new Promise(resolve => {
        let finished = false;

        const finish = result => {
            if (finished) return;

            finished = true;
            resolve(result);
        };

        const socket = tls.connect({
            host: hostname,
            port: 443,
            servername: hostname,
            rejectUnauthorized: false,
            timeout: 7000
        });

        socket.once("secureConnect", () => {
            const cert = socket.getPeerCertificate();

            finish({
                valid: socket.authorized,
                protocol: socket.getProtocol(),
                issuer: cert?.issuer?.O || cert?.issuer?.CN || "Unknown",
                expires: cert?.valid_to || null
            });

            socket.end();
        });

        socket.once("error", error => {
            finish({
                valid: false,
                error: error.message
            });
        });

        socket.once("timeout", () => {
            socket.destroy();

            finish({
                valid: false,
                error: "TLS connection timed out"
            });
        });
    });
}

function getHeader(headers, name) {
    return headers.get(name);
}

// --------------------------------------------------
// LINK CRAWLER
// --------------------------------------------------

async function runLinkCrawler(html, baseURL, mode) {
    const allLinks = extractLinks(html, baseURL);
    const base = new URL(baseURL);

    const maximumLinks = mode === "cli" ? 30 : 15;

    const selectedLinks = allLinks.slice(0, maximumLinks);

    const linkResults = await runWithLimit(
        selectedLinks,
        5,
        async link => {
            let parsed;

            try {
                parsed = new URL(link);
            } catch {
                return null;
            }

            if (isPrivateHostname(parsed.hostname)) {
                return {
                    url: link,
                    type: parsed.hostname === base.hostname ? "Internal" : "External",
                    status: "Skipped",
                    statusCode: null,
                    finalURL: null,
                    details: "Private or local hostname was not requested"
                };
            }

            const result = await probeURL(link);

            const redirected =
                result.available &&
                result.finalURL &&
                result.finalURL !== link;

            return {
                url: link,
                type: parsed.hostname === base.hostname ? "Internal" : "External",
                status: result.available
                    ? redirected
                        ? "Redirected"
                        : "Working"
                    : result.statusCode
                        ? "Broken"
                        : "Unreachable",
                statusCode: result.statusCode || null,
                finalURL: result.finalURL || null,
                details: result.available
                    ? `HTTP ${result.statusCode}${redirected ? " - Redirected" : ""}`
                    : result.error || `HTTP ${result.statusCode || "Unavailable"}`
            };
        }
    );

    const validResults = linkResults.filter(Boolean);

    return {
        websitesCrawled: 1,
        totalLinksFound: allLinks.length,
        totalLinksChecked: validResults.length,
        internalLinks: validResults.filter(
            item => item.type === "Internal"
        ).length,
        externalLinks: validResults.filter(
            item => item.type === "External"
        ).length,
        working: validResults.filter(
            item => item.status === "Working"
        ).length,
        broken: validResults.filter(
            item => item.status === "Broken"
        ).length,
        unreachable: validResults.filter(
            item => item.status === "Unreachable"
        ).length,
        redirected: validResults.filter(
            item => item.status === "Redirected"
        ).length,
        skipped: validResults.filter(
            item => item.status === "Skipped"
        ).length,
        links: validResults
    };
}

// --------------------------------------------------
// WEBSITE ANALYSIS
// --------------------------------------------------

async function runWebsiteChecks(url, mode, page) {
    const parsed = new URL(page.finalURL || url);
    const html = page.html || "";
    const headers = page.headers;
    const isHttps = parsed.protocol === "https:";

    const tests = [];

    const add = (name, status, details) => {
        tests.push(makeTest(name, status, details));
    };

    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    const description =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);

    const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const h1 = /<h1(?:\s|>)/i.test(html);
    const canonical = /<link[^>]+rel=["'][^"']*canonical[^"']*["']/i.test(html);
    const robotsMeta = /<meta[^>]+name=["']robots["']/i.test(html);
    const favicon = /<link[^>]+(?:rel=["'][^"']*icon|href=["'][^"']*favicon)/i.test(html);
    const lang = /<html[^>]+lang=["'][^"']+["']/i.test(html);
    const charset = /<meta[^>]+charset=["'][^"']+["']/i.test(html);

    const mixedContent =
        isHttps && /(?:src|href)=["']http:\/\//i.test(html);

    // --------------------------------------------------
    // LIGHT SCAN
    // --------------------------------------------------

    add(
        "Website Reachability",
        page.statusCode > 0 ? "Passed" : "Failed",
        `Received HTTP ${page.statusCode}`
    );

    add(
        "HTTP Response Status",
        page.statusCode >= 200 && page.statusCode < 400
            ? "Passed"
            : "Failed",
        `HTTP status: ${page.statusCode}`
    );

    add(
        "HTTPS Encryption",
        isHttps ? "Passed" : "Warning",
        isHttps ? "Website uses HTTPS" : "Website uses HTTP"
    );

    add(
        "Page Response Time",
        page.responseTime <= 3000 ? "Passed" : "Warning",
        `Response time: ${page.responseTime} ms`
    );

    add(
        "HTML Content Type",
        /text\/html/i.test(page.contentType) ? "Passed" : "Warning",
        `Content type: ${page.contentType || "Not provided"}`
    );

    add(
        "Page Title",
        title && title[1].trim() ? "Passed" : "Warning",
        title ? title[1].trim().slice(0, 150) : "Page title not found"
    );

    add(
        "Meta Description",
        description && description[1].trim() ? "Passed" : "Warning",
        description
            ? "Meta description found"
            : "Meta description not found"
    );

    add(
        "Mobile Viewport",
        viewport ? "Passed" : "Warning",
        viewport ? "Viewport meta tag found" : "Viewport meta tag missing"
    );

    add(
        "Main Heading (H1)",
        h1 ? "Passed" : "Warning",
        h1 ? "H1 heading found" : "No H1 heading found"
    );

    add(
        "Canonical URL",
        canonical ? "Passed" : "Warning",
        canonical ? "Canonical link found" : "Canonical link not found"
    );

    add(
        "Robots Meta Tag",
        robotsMeta ? "Passed" : "Warning",
        robotsMeta ? "Robots meta tag found" : "Robots meta tag not found"
    );

    add(
        "Favicon Reference",
        favicon ? "Passed" : "Warning",
        favicon ? "Favicon reference found" : "Favicon reference not found"
    );

    if (mode === "light") return tests;

    // --------------------------------------------------
    // DEEP SCAN
    // --------------------------------------------------

    let tlsResult = null;

    if (isHttps) {
        tlsResult = await checkTLS(parsed.hostname);
    }

    add(
        "SSL Certificate",
        !isHttps
            ? "Skipped"
            : tlsResult?.valid
                ? "Passed"
                : "Failed",
        !isHttps
            ? "HTTPS is not enabled"
            : tlsResult?.valid
                ? `Trusted certificate issued by ${tlsResult.issuer}; expires ${tlsResult.expires}`
                : tlsResult?.error || "Certificate validation failed"
    );

    add(
        "TLS Protocol",
        !isHttps
            ? "Skipped"
            : ["TLSv1.2", "TLSv1.3"].includes(tlsResult?.protocol)
                ? "Passed"
                : "Warning",
        tlsResult?.protocol || "TLS protocol unavailable"
    );

    const securityHeaders = [
        ["Strict-Transport-Security", "HSTS Header"],
        ["Content-Security-Policy", "Content Security Policy"],
        ["X-Content-Type-Options", "Content Type Protection"],
        ["X-Frame-Options", "Clickjacking Protection"],
        ["Referrer-Policy", "Referrer Policy"],
        ["Permissions-Policy", "Permissions Policy"]
    ];

    for (const [header, name] of securityHeaders) {
        const value = getHeader(headers, header);

        add(
            name,
            value ? "Passed" : "Warning",
            value ? `${header}: ${value}` : `${header} header not found`
        );
    }

    let dnsResult = null;
    let dnsTimer;

    try {
        dnsResult = await Promise.race([
            dns.lookup(parsed.hostname),
            new Promise((_, reject) => {
                dnsTimer = setTimeout(
                    () => reject(new Error("DNS lookup timed out")),
                    5000
                );
            })
        ]);
    } catch {
        dnsResult = null;
    } finally {
        clearTimeout(dnsTimer);
    }

    add(
        "DNS Resolution",
        dnsResult ? "Passed" : "Failed",
        dnsResult
            ? `${parsed.hostname} resolved to ${dnsResult.address}`
            : "DNS lookup failed or timed out"
    );

    add(
        "Mixed Content",
        mixedContent ? "Warning" : "Passed",
        mixedContent
            ? "HTTP resources detected on an HTTPS page"
            : "No HTTP mixed-content references detected"
    );

    const forms = [...html.matchAll(/<form\b[\s\S]*?>/gi)]
        .map(match => match[0]);

    const insecureForms = forms.filter(form => {
        const action = extractAttribute(form, "action");
        return action && /^http:\/\//i.test(action);
    });

    add(
        "Form Submission Security",
        insecureForms.length ? "Warning" : "Passed",
        insecureForms.length
            ? `${insecureForms.length} form(s) use HTTP action URLs`
            : "No HTTP form action URLs detected"
    );

    const images = [...html.matchAll(/<img\b[^>]*>/gi)]
        .map(match => match[0]);

    const imagesWithoutAlt = images.filter(img =>
        !/\balt\s*=/i.test(img)
    );

    add(
        "Image Accessibility",
        images.length === 0
            ? "Skipped"
            : imagesWithoutAlt.length === 0
                ? "Passed"
                : "Warning",
        images.length === 0
            ? "No images found"
            : `${imagesWithoutAlt.length} of ${images.length} images lack alt attributes`
    );

    add(
        "HTML Language Attribute",
        lang ? "Passed" : "Warning",
        lang
            ? "HTML language attribute found"
            : "HTML language attribute missing"
    );

    add(
        "Character Encoding",
        charset ? "Passed" : "Warning",
        charset
            ? "Character encoding declared"
            : "Charset declaration not found"
    );

    if (mode === "full") return tests;

    // --------------------------------------------------
    // CLI SCAN
    // --------------------------------------------------

    const sitemapURL = `${parsed.origin}/sitemap.xml`;
    const robotsURL = `${parsed.origin}/robots.txt`;

    const [sitemapResult, robotsResult] = await Promise.all([
        probeURL(sitemapURL),
        probeURL(robotsURL)
    ]);

    add(
        "XML Sitemap",
        sitemapResult.available ? "Passed" : "Warning",
        sitemapResult.available
            ? `Sitemap responded with HTTP ${sitemapResult.statusCode}`
            : "Sitemap not available at /sitemap.xml"
    );

    add(
        "Robots.txt",
        robotsResult.available ? "Passed" : "Warning",
        robotsResult.available
            ? `Robots.txt responded with HTTP ${robotsResult.statusCode}`
            : "Robots.txt not available at /robots.txt"
    );

    const encoding = getHeader(headers, "content-encoding");

    add(
        "Response Compression",
        encoding ? "Passed" : "Warning",
        encoding
            ? `Compression: ${encoding}`
            : "No content-encoding header found"
    );

    const cache = getHeader(headers, "cache-control");

    add(
        "Cache Control",
        cache ? "Passed" : "Warning",
        cache || "Cache-Control header not found"
    );

    const server = getHeader(headers, "server");

    add(
        "Server Information Exposure",
        server ? "Warning" : "Passed",
        server
            ? `Server header exposed: ${server}`
            : "No server header exposed"
    );

    const poweredBy = getHeader(headers, "x-powered-by");

    add(
        "Technology Header Exposure",
        poweredBy ? "Warning" : "Passed",
        poweredBy
            ? `Technology disclosed: ${poweredBy}`
            : "No X-Powered-By header"
    );

    const coop = getHeader(headers, "cross-origin-opener-policy");

    add(
        "Cross-Origin Opener Policy",
        coop ? "Passed" : "Warning",
        coop || "COOP header not found"
    );

    const corp = getHeader(headers, "cross-origin-resource-policy");

    add(
        "Cross-Origin Resource Policy",
        corp ? "Passed" : "Warning",
        corp || "CORP header not found"
    );

    const coep = getHeader(headers, "cross-origin-embedder-policy");

    add(
        "Cross-Origin Embedder Policy",
        coep ? "Passed" : "Warning",
        coep || "COEP header not found"
    );

    const links = [...html.matchAll(/<a\b[^>]*>/gi)]
        .map(match => match[0]);

    const externalLinks = links.filter(link => {
        const href = extractAttribute(link, "href");

        if (!href || !/^https?:\/\//i.test(href)) return false;

        try {
            return new URL(href).hostname !== parsed.hostname;
        } catch {
            return false;
        }
    });

    const unsafeExternalLinks = externalLinks.filter(link =>
        /\btarget=["']_blank["']/i.test(link) &&
        !/\brel=["'][^"']*noopener/i.test(link)
    );

    add(
        "External Link Protection",
        unsafeExternalLinks.length ? "Warning" : "Passed",
        `${unsafeExternalLinks.length} external links with _blank lack noopener`
    );

    add(
        "HTML Page Size",
        page.htmlBytes <= 2000000 ? "Passed" : "Warning",
        `HTML size: ${(page.htmlBytes / 1024).toFixed(2)} KB`
    );

    let originalURL;
    let finalURL;

    try {
        originalURL = new URL(url).href;
        finalURL = new URL(page.finalURL).href;
    } catch {
        originalURL = url;
        finalURL = page.finalURL;
    }

    add(
        "Redirect Detection",
        finalURL !== originalURL ? "Warning" : "Passed",
        finalURL !== originalURL
            ? `Redirected to ${finalURL}`
            : "No final URL change detected"
    );

    const canonicalTag = html.match(
        /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i
    );

    const canonicalHref = canonicalTag
        ? extractAttribute(canonicalTag[0], "href")
        : "";

    let canonicalIsHttps = false;

    if (canonicalHref) {
        try {
            canonicalIsHttps =
                new URL(canonicalHref, page.finalURL).protocol === "https:";
        } catch {
            canonicalIsHttps = false;
        }
    }

    add(
        "Canonical HTTPS",
        !canonical
            ? "Skipped"
            : canonicalIsHttps
                ? "Passed"
                : "Warning",
        !canonical
            ? "Canonical reference not available"
            : canonicalIsHttps
                ? "Canonical URL uses HTTPS"
                : "Canonical URL does not use HTTPS"
    );

    const scripts = [...html.matchAll(
        /<script\b[^>]*src=["']([^"']+)["']/gi
    )].map(match => match[1]);

    const insecureScripts = scripts.filter(src =>
        /^http:\/\//i.test(src)
    );

    add(
        "External Script Transport",
        insecureScripts.length ? "Warning" : "Passed",
        `${insecureScripts.length} external scripts use HTTP`
    );

    const iframes = [...html.matchAll(/<iframe\b[^>]*>/gi)]
        .map(match => match[0]);

    const unsafeIframes = iframes.filter(frame =>
        !/\bsandbox\b/i.test(frame)
    );

    add(
        "Iframe Sandbox Attribute",
        iframes.length === 0
            ? "Skipped"
            : unsafeIframes.length === 0
                ? "Passed"
                : "Warning",
        iframes.length === 0
            ? "No iframes found"
            : `${unsafeIframes.length} iframe(s) without sandbox attribute`
    );

    return tests;
}

// --------------------------------------------------
// WEBSITE HEALTH SCORE
// --------------------------------------------------

function calculateWebsiteScore(tests) {
    const completed = tests.filter(test =>
        ["Passed", "Failed", "Warning"].includes(test.status)
    );

    if (!completed.length) {
        return {
            score: 0,
            label: "Not calculated"
        };
    }

    const passed = completed.filter(
        test => test.status === "Passed"
    ).length;

    const failed = completed.filter(
        test => test.status === "Failed"
    ).length;

    const warnings = completed.filter(
        test => test.status === "Warning"
    ).length;

    // Failed checks carry a larger penalty than warnings.
    const score = Math.round(
        Math.max(
            0,
            (passed / completed.length) * 100 -
            (failed / completed.length) * 20 -
            (warnings / completed.length) * 10
        )
    );

    let label = "Poor";

    if (score >= 90) label = "Excellent";
    else if (score >= 75) label = "Good";
    else if (score >= 50) label = "Needs Improvement";

    return { score, label };
}

// --------------------------------------------------
// PROS, CONS AND RECOMMENDATIONS
// --------------------------------------------------

function generateInsights(tests) {
    const pros = [];
    const cons = [];
    const recommendations = [];

    const recommendationMap = {
        "HTTPS Encryption": {
            priority: "High",
            message: "Enable HTTPS and redirect HTTP traffic to HTTPS."
        },
        "SSL Certificate": {
            priority: "High",
            message: "Install or renew a trusted SSL certificate."
        },
        "TLS Protocol": {
            priority: "High",
            message: "Configure the server to support modern TLS protocols."
        },
        "HSTS Header": {
            priority: "Medium",
            message: "Configure the Strict-Transport-Security response header."
        },
        "Content Security Policy": {
            priority: "High",
            message: "Configure a Content-Security-Policy header appropriate for your website."
        },
        "Content Type Protection": {
            priority: "Medium",
            message: "Add X-Content-Type-Options: nosniff."
        },
        "Clickjacking Protection": {
            priority: "Medium",
            message: "Configure X-Frame-Options or a suitable frame-ancestors CSP directive."
        },
        "Referrer Policy": {
            priority: "Low",
            message: "Configure an appropriate Referrer-Policy header."
        },
        "Permissions Policy": {
            priority: "Low",
            message: "Review and configure the Permissions-Policy header."
        },
        "Page Response Time": {
            priority: "Medium",
            message: "Improve response time through server optimization, caching and reduced page weight."
        },
        "Meta Description": {
            priority: "Low",
            message: "Add a meaningful meta description to the page."
        },
        "Page Title": {
            priority: "Medium",
            message: "Add a descriptive and relevant HTML title."
        },
        "Mobile Viewport": {
            priority: "Medium",
            message: "Add a responsive viewport meta tag."
        },
        "Main Heading (H1)": {
            priority: "Low",
            message: "Add a clear main H1 heading to the page."
        },
        "Canonical URL": {
            priority: "Low",
            message: "Add a canonical URL to help search engines identify the preferred page."
        },
        "Image Accessibility": {
            priority: "Medium",
            message: "Add appropriate alt attributes to meaningful images."
        },
        "HTML Language Attribute": {
            priority: "Low",
            message: "Add the correct language attribute to the HTML element."
        },
        "Character Encoding": {
            priority: "Low",
            message: "Declare the document character encoding using a charset meta tag."
        },
        "XML Sitemap": {
            priority: "Low",
            message: "Publish an XML sitemap and keep it updated."
        },
        "Robots.txt": {
            priority: "Low",
            message: "Review and publish a robots.txt file if your site needs crawler instructions."
        },
        "Response Compression": {
            priority: "Medium",
            message: "Enable suitable HTTP response compression such as Brotli or gzip."
        },
        "Cache Control": {
            priority: "Medium",
            message: "Configure cache-control policies for suitable static and dynamic resources."
        },
        "Server Information Exposure": {
            priority: "Low",
            message: "Consider reducing unnecessary server version information in response headers."
        },
        "Technology Header Exposure": {
            priority: "Low",
            message: "Remove unnecessary X-Powered-By technology disclosure."
        },
        "Mixed Content": {
            priority: "High",
            message: "Replace HTTP resource references with HTTPS URLs."
        },
        "Form Submission Security": {
            priority: "High",
            message: "Ensure form submissions use HTTPS."
        },
        "External Link Protection": {
            priority: "Medium",
            message: "Add rel=\"noopener\" to external links that open in a new tab."
        },
        "HTML Page Size": {
            priority: "Medium",
            message: "Reduce excessive HTML size where possible."
        },
        "Cross-Origin Opener Policy": {
            priority: "Low",
            message: "Review whether a Cross-Origin-Opener-Policy header is suitable for your application."
        },
        "Cross-Origin Resource Policy": {
            priority: "Low",
            message: "Review whether a Cross-Origin-Resource-Policy header is suitable for your resources."
        },
        "Cross-Origin Embedder Policy": {
            priority: "Low",
            message: "Review whether a Cross-Origin-Embedder-Policy header is required by your application."
        },
        "External Script Transport": {
            priority: "High",
            message: "Load external scripts over HTTPS."
        },
        "Iframe Sandbox Attribute": {
            priority: "Medium",
            message: "Review iframe permissions and use sandbox attributes where appropriate."
        },
        "Redirect Detection": {
            priority: "Low",
            message: "Review redirects to ensure they are intentional and do not create unnecessary redirect chains."
        }
    };

    for (const test of tests) {
        if (test.status === "Passed") {
            pros.push(`${test.name}: ${test.details}`);
        }

        if (test.status === "Failed" || test.status === "Warning") {
            cons.push(`${test.name}: ${test.details}`);

            const suggestion = recommendationMap[test.name];

            if (suggestion) {
                recommendations.push({
                    test: test.name,
                    priority: suggestion.priority,
                    message: suggestion.message
                });
            }
        }
    }

    const priorityOrder = {
        High: 1,
        Medium: 2,
        Low: 3
    };

    recommendations.sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    return {
        pros: pros.slice(0, 15),
        cons: cons.slice(0, 15),
        recommendations
    };
}

// --------------------------------------------------
// SINGLE WEBSITE SCAN
// --------------------------------------------------

async function scanOneWebsite(url, mode) {
    const result = {
        url,
        mode,
        completed: false,
        status: "Unreachable",
        tests: [],
        findings: [],
        totalChecks: 0,
        errors: [],
        linkCrawlSummary: {
            websitesCrawled: 0,
            totalLinksFound: 0,
            totalLinksChecked: 0,
            internalLinks: 0,
            externalLinks: 0,
            working: 0,
            broken: 0,
            unreachable: 0,
            redirected: 0,
            skipped: 0,
            links: []
        }
    };

    try {
        const page = await requestPage(url);

        result.status = page.statusCode >= 200 && page.statusCode < 400
            ? "Working"
            : "Broken";

        result.finalURL = page.finalURL;
        result.statusCode = page.statusCode;
        result.responseTime = page.responseTime;
        result.contentType = page.contentType;
        result.htmlBytes = page.htmlBytes;

        result.tests = await runWebsiteChecks(url, mode, page);

        // Crawl links in Deep and CLI modes.
        if (mode === "full" || mode === "cli") {
            result.linkCrawlSummary = await runLinkCrawler(
                page.html,
                page.finalURL,
                mode
            );
        }

        result.completed = true;

    } catch (error) {
        result.errors.push(error.message);

        const testNames = getTestNames(mode);

        result.tests = testNames.map(name =>
            makeTest(
                name,
                name === "Website Reachability" ? "Failed" : "Skipped",
                name === "Website Reachability"
                    ? error.message
                    : "Website could not be fetched; check was not performed"
            )
        );
    }

    result.totalChecks = result.tests.length;

    result.findings = result.tests.filter(test =>
        test.status === "Failed" || test.status === "Warning"
    );

    result.passed = result.tests.filter(
        test => test.status === "Passed"
    ).length;

    result.failed = result.tests.filter(
        test => test.status === "Failed"
    ).length;

    result.warnings = result.tests.filter(
        test => test.status === "Warning"
    ).length;

    result.skipped = result.tests.filter(
        test => test.status === "Skipped"
    ).length;

    result.health = calculateWebsiteScore(result.tests);

    const insights = generateInsights(result.tests);

    result.pros = insights.pros;
    result.cons = insights.cons;
    result.recommendations = insights.recommendations;

    return result;
}

// --------------------------------------------------
// CONCURRENT SCANNING
// --------------------------------------------------

async function runWithLimit(items, limit, task) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index = nextIndex++;

            if (index >= items.length) return;

            try {
                results[index] = await task(items[index], index);
            } catch (error) {
                results[index] = {
                    url: items[index],
                    status: "Unreachable",
                    completed: false,
                    tests: [],
                    findings: [],
                    errors: [error.message]
                };
            }
        }
    }

    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        () => worker()
    );

    await Promise.all(workers);

    return results;
}

// --------------------------------------------------
// MAIN SCAN FUNCTION
// --------------------------------------------------

async function scanWebsite(urls, mode = "light") {
    if (!Array.isArray(urls) || urls.length === 0) {
        throw new Error("Please provide at least one website URL.");
    }

    if (!["light", "full", "cli"].includes(mode)) {
        throw new Error("Invalid scan mode.");
    }

    if (mode === "full" && urls.length > 10) {
        throw new Error("Deep Scan supports a maximum of 10 URLs.");
    }

    if (mode === "cli" && urls.length > 20) {
        throw new Error("CLI Scan supports a maximum of 20 URLs.");
    }

    const normalizedURLs = urls.map(value => {
        let parsed;

        try {
            parsed = new URL(value);
        } catch {
            throw new Error(`Invalid URL: ${value}`);
        }

        if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("Only HTTP and HTTPS URLs are supported.");
        }

        if (isPrivateHostname(parsed.hostname)) {
            throw new Error("Local and private network URLs are not supported.");
        }

        return parsed.href;
    });

    // Scan submitted websites concurrently.
    const analysis = await runWithLimit(
        normalizedURLs,
        mode === "cli" ? 3 : 5,
        url => scanOneWebsite(url, mode)
    );

    const allTests = analysis.flatMap(item =>
        item.tests.map(test => ({
            url: item.url,
            ...test
        }))
    );

    const allFindings = analysis.flatMap(item =>
        item.findings.map(finding => ({
            url: item.url,
            ...finding
        }))
    );

    const working = analysis.filter(
        item => item.status === "Working"
    ).length;

    const broken = analysis.filter(
        item => item.status === "Broken"
    ).length;

    const unreachable = analysis.filter(
        item => item.status === "Unreachable"
    ).length;

    const slow = analysis.filter(
        item => item.responseTime > 3000 && item.responseTime <= 6000
    ).length;

    const verySlow = analysis.filter(
        item => item.responseTime > 6000
    ).length;

    // Aggregate link crawling information.
    const linkCrawlSummary = {
        websitesCrawled: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.websitesCrawled || 0),
            0
        ),
        totalLinksFound: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.totalLinksFound || 0),
            0
        ),
        totalLinksChecked: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.totalLinksChecked || 0),
            0
        ),
        internalLinks: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.internalLinks || 0),
            0
        ),
        externalLinks: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.externalLinks || 0),
            0
        ),
        working: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.working || 0),
            0
        ),
        broken: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.broken || 0),
            0
        ),
        unreachable: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.unreachable || 0),
            0
        ),
        redirected: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.redirected || 0),
            0
        ),
        skipped: analysis.reduce(
            (sum, item) => sum + (item.linkCrawlSummary?.skipped || 0),
            0
        ),
        links: analysis.flatMap(item =>
            (item.linkCrawlSummary?.links || []).map(link => ({
                website: item.url,
                ...link
            }))
        )
    };

    // Overall score is the average of the individual website scores.
    const scoredWebsites = analysis.filter(
        item => item.health && item.health.label !== "Not calculated"
    );

    const websiteScore = scoredWebsites.length
        ? Math.round(
            scoredWebsites.reduce(
                (sum, item) => sum + item.health.score,
                0
            ) / scoredWebsites.length
        )
        : 0;

    let scoreLabel = "Not calculated";

    if (scoredWebsites.length) {
        if (websiteScore >= 90) scoreLabel = "Excellent";
        else if (websiteScore >= 75) scoreLabel = "Good";
        else if (websiteScore >= 50) scoreLabel = "Needs Improvement";
        else scoreLabel = "Poor";
    }

    const combinedInsights = generateInsights(allTests);

    return {
        scanMode: mode,

        totalURLs: normalizedURLs.length,
        working,
        broken,
        unreachable,
        slow,
        verySlow,

        totalChecks: allTests.length,
        totalFindings: allFindings.length,

        passed: allTests.filter(
            test => test.status === "Passed"
        ).length,

        failed: allTests.filter(
            test => test.status === "Failed"
        ).length,

        warnings: allTests.filter(
            test => test.status === "Warning"
        ).length,

        skipped: allTests.filter(
            test => test.status === "Skipped"
        ).length,

        websiteScore,
        scoreLabel,

        pros: combinedInsights.pros,
        cons: combinedInsights.cons,
        recommendations: combinedInsights.recommendations,

        findings: allFindings,
        tests: allTests,
        analysis,

        linkCrawlSummary,

        results: analysis.map(item => ({
            url: item.url,
            finalURL: item.finalURL || item.url,
            status: item.status,
            statusCode: item.statusCode || null,
            responseTime: item.responseTime || null,
            contentType: item.contentType || "",
            redirected: item.finalURL
                ? item.finalURL !== item.url
                : false,
            speedStatus: !item.responseTime
                ? "Unknown"
                : item.responseTime > 6000
                    ? "Very Slow"
                    : item.responseTime > 3000
                        ? "Slow"
                        : "Normal",
            isSlow: item.responseTime > 3000,
            error: item.errors.length
                ? item.errors.join("; ")
                : null
        }))
    };
}

module.exports = { scanWebsite };
