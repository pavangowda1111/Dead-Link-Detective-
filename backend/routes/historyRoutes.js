
const express = require("express");
const router = express.Router();

const Scan = require("../models/Scan");

// GET /api/history
router.get("/", async (req, res) => {
    try {
        const scans = await Scan.find()
            .sort({ createdAt: -1 })
            .limit(50);

        return res.status(200).json({
            success: true,
            message: "Scan history retrieved successfully!",
            totalScans: scans.length,
            data: scans
        });

    } catch (error) {
        console.error("History Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve scan history.",
            error: error.message
        });
    }
});

// GET /api/history/:id
router.get("/:id", async (req, res) => {
    try {
        const scan = await Scan.findById(req.params.id);

        if (!scan) {
            return res.status(404).json({
                success: false,
                message: "Scan record not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Scan details retrieved successfully!",
            data: scan
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid scan ID.",
            error: error.message
        });
    }
});

module.exports = router;
