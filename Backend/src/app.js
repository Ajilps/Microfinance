import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";

import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

dotenv.config();

// Connect DB
connectDB();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const distPath = path.join(process.cwd(), "dist");
console.log(distPath);
// Serve frontend
app.use(express.static(distPath));

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

// Handle React routes
app.get("*", (req, res) => {
  if (!req.originalUrl.startsWith("/api")) {
    res.sendFile(path.join(distPath, "index.html"));
  }
});

// Error handlers (LAST)
app.use(notFound);
app.use(errorHandler);

export default app;
