
const dns = require("dns").promises;

async function scanDNS(input) {
    try {
        const hostname = new URL(input).hostname;

        const getRecords = async (method, host) => {
            try {
                return await dns[method](host);
            } catch {
                return [];
            }
        };

        const [ipv4, ipv6, nameservers, mailServers, textRecords] =
            await Promise.all([
                getRecords("resolve4", hostname),
                getRecords("resolve6", hostname),
                getRecords("resolveNs", hostname),
                getRecords("resolveMx", hostname),
                getRecords("resolveTxt", hostname)
            ]);

        return {
            hostname,
            ipv4,
            ipv6,
            nameservers,
            mailServers,
            textRecords,
            resolved: ipv4.length > 0 || ipv6.length > 0
        };

    } catch (error) {
        return {
            hostname: null,
            resolved: false,
            error: error.message
        };
    }
}

module.exports = { scanDNS };
