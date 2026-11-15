
function scanSecurity(page) {
    const headers = page.headers || {};

    const checks = [
        {
            name: "Strict-Transport-Security",
            key: "strict-transport-security",
            purpose: "Helps enforce HTTPS connections."
        },
        {
            name: "Content-Security-Policy",
            key: "content-security-policy",
            purpose: "Helps restrict unsafe content sources."
        },
        {
            name: "X-Content-Type-Options",
            key: "x-content-type-options",
            purpose: "Helps prevent MIME-type sniffing."
        },
        {
            name: "X-Frame-Options",
            key: "x-frame-options",
            purpose: "Helps control iframe embedding."
        },
        {
            name: "Referrer-Policy",
            key: "referrer-policy",
            purpose: "Controls referrer information."
        },
        {
            name: "Permissions-Policy",
            key: "permissions-policy",
            purpose: "Controls browser feature permissions."
        }
    ];

    const results = checks.map(check => ({
        name: check.name,
        present: Boolean(headers[check.key]),
        value: headers[check.key] || null,
        purpose: check.purpose
    }));

    const present = results.filter(item => item.present).length;
    const missing = results.filter(item => !item.present).length;

    return {
        headersChecked: results.length,
        headersPresent: present,
        headersMissing: missing,
        coveragePercentage: Math.round(
            (present / results.length) * 100
        ),
        results
    };
}

module.exports = { scanSecurity };
