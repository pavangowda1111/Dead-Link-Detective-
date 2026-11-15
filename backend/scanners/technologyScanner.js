
function scanTechnology(page) {
    const html = page.html || "";
    const headers = page.headers || {};

    const detected = [];

    const add = (name, evidence) => {
        if (!detected.some(item => item.name === name)) {
            detected.push({ name, evidence });
        }
    };

    const poweredBy = headers["x-powered-by"];

    if (poweredBy) {
        add("Server technology", `X-Powered-By: ${poweredBy}`);
    }

    const server = headers["server"];

    if (server) {
        add("Web server", server);
    }

    if (/wp-content|wp-includes/i.test(html)) {
        add("WordPress", "WordPress asset paths detected.");
    }

    if (/cdn\.shopify\.com|Shopify\.theme/i.test(html)) {
        add("Shopify", "Shopify-related assets detected.");
    }

    if (/__NEXT_DATA__|\/_next\//i.test(html)) {
        add("Next.js", "Next.js page markers detected.");
    }

    if (/data-reactroot|__react|react-dom/i.test(html)) {
        add("React", "React-related HTML or scripts detected.");
    }

    if (/__vue__|data-v-[a-f0-9]+/i.test(html)) {
        add("Vue.js", "Vue-related HTML markers detected.");
    }

    if (/ng-version|ng-app/i.test(html)) {
        add("Angular", "Angular-related HTML markers detected.");
    }

    if (/bootstrap(?:\.min)?\.css|bootstrap(?:\.min)?\.js/i.test(html)) {
        add("Bootstrap", "Bootstrap asset reference detected.");
    }

    if (/jquery(?:\.min)?\.js|jquery\.com/i.test(html)) {
        add("jQuery", "jQuery asset reference detected.");
    }

    return {
        count: detected.length,
        detected
    };
}

module.exports = { scanTechnology };
