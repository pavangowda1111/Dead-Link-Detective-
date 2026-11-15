
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/database");
const scanRoutes = require("./routes/scanRoutes");
const historyRoutes = require("./routes/historyRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

// Security middleware
app.use(helmet());

// Allow VS Code Live Server on any localhost port
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        const isLocalFrontend =
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

        if (isLocalFrontend) {
            return callback(null, true);
        }

        return callback(new Error("Origin not allowed by CORS"));
    }
}));

// Parse JSON
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});

app.use("/api", limiter);

// API routes
app.use("/api/scan", scanRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/reports", reportRoutes);

// Welcome route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Dead Link Detective Backend is Running!"
    });
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        server: "Running",
        database: "Connected"
    });
});

// Start server
const startServer = async () => {
    try {
        await connectDB();

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {
            console.log("--------------------------------");
            console.log("DEAD LINK DETECTIVE");
            console.log(`Server running on port ${PORT}`);
            console.log("--------------------------------");
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
