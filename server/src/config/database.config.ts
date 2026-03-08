import mongoose from "mongoose";
import config from "./env.config";

/**
 * Connects to MongoDB using the URI from environment config.
 * Exits the process on failure in production.
 */
const connectDatabase = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      // Mongoose 6+ has sensible defaults; no extra options needed
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err);
});

export default connectDatabase;
