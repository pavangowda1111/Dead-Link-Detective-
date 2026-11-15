
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Scan = require("../models/Scan");

// GET /api/reports/:scanId/:format
router.get("/:scanId/:format", async (req, res) => {
    try {
        const { scanId, format } = req.params;

        if (!mongoose.Types.ObjectId.isValid(scanId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid scan ID."
            });
        }

        if (!["json", "txt"].includes(format)) {
            return res.status(400).json({
                success: false,
                message: "Choose JSON or TXT format."
            });
        }

        const scan = await Scan.findById(scanId).lean();

        if (!scan) {
            return res.status(404).json({
                success: false,
                message: "Scan record not found."
            });
        }

        const report = {
            application: "Dead Link Detective",
            reportTitle: "Website Intelligence Report",
            scanId: String(scan._id),
            scanMode: scan.scanMode,
            generatedAt: new Date().toISOString(),

            summary: {
                totalURLs: scan.totalURLs,
                working: scan.working,
                broken: scan.broken,
                unreachable: scan.unreachable,
                slow: scan.slow,
                verySlow: scan.verySlow,
                linkCrawlSummary: scan.linkCrawlSummary || {}
            },

            results: scan.results || [],
            analysis: scan.analysis || []
        };

        const filename = `DeadLinkDetective-${scanId}.${format}`;

        if (format === "json") {
            return res
                .status(200)
                .set({
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Cache-Control": "no-store"
                })
                .send(JSON.stringify(report, null, 4));
        }

        let txt = "";

        txt += "================================================\n";
        txt += "             DEAD LINK DETECTIVE\n";
        txt += "             WEBSITE SCAN REPORT\n";
        txt += "================================================\n\n";

        txt += `SCAN ID: ${report.scanId}\n`;
        txt += `SCAN MODE: ${String(report.scanMode).toUpperCase()}\n`;
        txt += `GENERATED: ${new Date().toLocaleString()}\n\n`;

        txt += "--------------- SCAN SUMMARY ----------------\n\n";

        Object.entries(report.summary).forEach(([key, value]) => {
            txt += `${key}: ${JSON.stringify(value)}\n`;
        });

        txt += "\n--------------- WEBSITE RESULTS ----------------\n\n";

        report.results.forEach((item, index) => {
            txt += `WEBSITE ${index + 1}\n`;
            txt += `URL: ${item.url || "N/A"}\n`;
            txt += `Final URL: ${item.finalURL || "N/A"}\n`;
            txt += `HTTP Status: ${item.statusCode ?? "N/A"}\n`;
            txt += `Response Time: ${item.responseTime ?? "N/A"} ms\n`;
            txt += `Status: ${item.status || "N/A"}\n`;
            txt += `Redirected: ${item.redirected ? "Yes" : "No"}\n`;
            txt += `Error: ${item.error || "None"}\n\n`;
        });

        txt += "\n--------------- ADVANCED ANALYSIS ----------------\n\n";

        report.analysis.forEach((item, index) => {
            txt += `ANALYSIS ${index + 1}\n`;
            txt += `Website: ${item.url || "N/A"}\n`;
            txt += `Completed: ${item.completed ? "Yes" : "No"}\n`;
            txt += `Checks: ${(item.checks || []).join(", ")}\n\n`;

            [
                "pageInformation",
                "ssl",
                "dns",
                "security",
                "seo",
                "technology",
                "performance",
                "linkCrawl"
            ].forEach(section => {
                if (item[section]) {
                    txt += `${section.toUpperCase()}:\n`;
                    txt += JSON.stringify(item[section], null, 2);
                    txt += "\n\n";
                }
            });

            if (item.errors?.length) {
                txt += `ERRORS: ${item.errors.join("; ")}\n\n`;
            }

            txt += "------------------------------------------------\n\n";
        });

        txt += "                 END OF REPORT\n";
        txt += "================================================\n";

        return res
            .status(200)
            .set({
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store"
            })
            .send(txt);

    } catch (error) {
        console.error("Report Download Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to generate report.",
            error: error.message
        });
    }
});

module.exports = router;
