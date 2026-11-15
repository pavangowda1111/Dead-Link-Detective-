
const express = require("express");
const router = express.Router();

const { scanWebsite } = require("../services/scanService");
const { generateReports } = require("../services/reportService");
const Scan = require("../models/Scan");

// POST /api/scan
router.post("/", async (req, res) => {
    try {
        const { urls, mode } = req.body;

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide at least one URL."
            });
        }

        if (urls.length > 10) {
            return res.status(400).json({
                success: false,
                message: "Maximum 10 URLs allowed per scan."
            });
        }

        if (!urls.every(url =>
            typeof url === "string" && url.trim()
        )) {
            return res.status(400).json({
                success: false,
                message: "All URLs must be non-empty strings."
            });
        }

        const requestedMode = String(mode || "normal").toLowerCase();

        const modes = {
            normal: "light",
            light: "light",
            deep: "full",
            full: "full",
            cli: "cli"
        };

        const scanMode = modes[requestedMode];

        if (!scanMode) {
            return res.status(400).json({
                success: false,
                message: "Invalid scan mode."
            });
        }

        // Run the existing website scanner.
        const scanResults = await scanWebsite(
            urls.map(url => url.trim()),
            scanMode
        );

        // Save scan results in MongoDB.
        const savedScan = await Scan.create(scanResults);

        // Save JSON and TXT reports using fs.
        let reportFiles = null;

        try {
            reportFiles = await generateReports(
                savedScan.toObject()
            );
        } catch (reportError) {
            console.error(
                "Report Generation Error:",
                reportError
            );
        }

        return res.status(200).json({
            success: true,
            message: "Website scan completed successfully!",
            scanId: savedScan._id,
            scanMode,
            reportFiles,
            data: savedScan
        });

    } catch (error) {
        console.error("Scan Error:", error);

        return res.status(500).json({
            success: false,
            message: "Website scan failed.",
            error: error.message
        });
    }
});

module.exports = router;
