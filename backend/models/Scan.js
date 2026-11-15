
const mongoose = require("mongoose");

// Individual test result
const testSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        default: "General"
    },
    status: {
        type: String,
        enum: ["Passed", "Failed", "Warning", "Skipped"],
        default: "Skipped"
    },
    details: {
        type: String,
        default: ""
    }
}, { _id: false });

// Website URL result
const resultSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    finalURL: {
        type: String,
        default: null
    },
    statusCode: {
        type: Number,
        default: null
    },
    responseTime: {
        type: Number,
        default: 0
    },
    redirected: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        required: true
    },
    speedStatus: {
        type: String,
        default: "Normal"
    },
    isSlow: {
        type: Boolean,
        default: false
    },
    error: {
        type: String,
        default: null
    }
}, { _id: false });

// Link crawling summary
const linkCrawlSchema = new mongoose.Schema({
    websitesCrawled: { type: Number, default: 0 },
    totalLinksFound: { type: Number, default: 0 },
    totalLinksChecked: { type: Number, default: 0 },
    internalLinks: { type: Number, default: 0 },
    externalLinks: { type: Number, default: 0 },
    working: { type: Number, default: 0 },
    broken: { type: Number, default: 0 },
    unreachable: { type: Number, default: 0 },
    redirected: { type: Number, default: 0 },
    links: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    }
}, { _id: false });

// Main scan document
const scanSchema = new mongoose.Schema({

    scanMode: {
        type: String,
        enum: ["light", "full", "cli"],
        default: "light"
    },

    totalURLs: {
        type: Number,
        required: true
    },

    working: { type: Number, default: 0 },
    broken: { type: Number, default: 0 },
    unreachable: { type: Number, default: 0 },
    slow: { type: Number, default: 0 },
    verySlow: { type: Number, default: 0 },

    // Test statistics
    totalChecks: { type: Number, default: 0 },
    totalFindings: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },

    // Website health score
    websiteScore: {
        type: Number,
        default: 0
    },

    scoreLabel: {
        type: String,
        default: "Not calculated"
    },

    // Individual tests
    tests: {
        type: [testSchema],
        default: []
    },

    // Security and severity information
    severitySummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    findings: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    // Pros and cons
    pros: {
        type: [String],
        default: []
    },

    cons: {
        type: [String],
        default: []
    },

    recommendations: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    // Link crawling
    linkCrawlSummary: {
        type: linkCrawlSchema,
        default: () => ({})
    },

    // Individual website results
    results: {
        type: [resultSchema],
        default: []
    },

    // Detailed per-website analysis
    analysis: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Scan", scanSchema);
