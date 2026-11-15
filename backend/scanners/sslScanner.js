
const tls = require("tls");

function scanSSL(input) {
    return new Promise(resolve => {
        let url;

        try {
            url = new URL(input);
        } catch {
            return resolve({
                supported: false,
                secure: false,
                message: "Invalid website URL."
            });
        }

        if (url.protocol !== "https:") {
            return resolve({
                supported: false,
                secure: false,
                message: "Website does not use HTTPS."
            });
        }

        const socket = tls.connect({
            host: url.hostname,
            port: Number(url.port) || 443,
            servername: url.hostname,
            rejectUnauthorized: false,
            timeout: 8000
        });

        socket.once("secureConnect", () => {
            const certificate = socket.getPeerCertificate();
            const authorized = socket.authorized;
            const protocol = socket.getProtocol();

            const validTo = certificate.valid_to
                ? new Date(certificate.valid_to)
                : null;

            const validFrom = certificate.valid_from
                ? new Date(certificate.valid_from)
                : null;

            const daysRemaining = validTo
                ? Math.ceil((validTo.getTime() - Date.now()) / 86400000)
                : null;

            resolve({
                supported: true,
                secure: authorized,
                authorized,
                protocol,
                issuer: certificate.issuer?.O || certificate.issuer?.CN || "Unknown",
                subject: certificate.subject?.CN || url.hostname,
                validFrom,
                validTo,
                daysRemaining,
                expired: daysRemaining !== null && daysRemaining < 0,
                message: authorized
                    ? "Certificate validation successful."
                    : "Certificate could not be verified."
            });

            socket.end();
        });

        socket.once("error", error => {
            resolve({
                supported: true,
                secure: false,
                authorized: false,
                message: error.message
            });
        });

        socket.once("timeout", () => {
            socket.destroy();

            resolve({
                supported: true,
                secure: false,
                authorized: false,
                message: "SSL connection timed out."
            });
        });
    });
}

module.exports = { scanSSL };
