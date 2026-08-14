import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Resolve from this file instead of process.cwd(). Render, Docker, and local
// development can start Node from different working directories.
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(currentDirectory, "../dist");
const frontendIndexPath = path.join(distPath, "index.html");
console.log(`Serving frontend from ${distPath}`);
// Serve frontend
app.use(express.static(distPath));

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

// Handle React routes
app.get("*", (req, res) => {
  if (!req.originalUrl.startsWith("/api")) {
    res.sendFile(frontendIndexPath, (error) => {
      if (!error) return;
      if (error.code === "ENOENT") {
        return res.status(503).json({
          message:
            "Frontend build is missing. Run the repository build command before starting the server.",
        });
      }
      return res.status(error.status || 500).json({ message: error.message });
    });
  }
});

// Error handlers (LAST)
app.use(notFound);
app.use(errorHandler);

export default app;
