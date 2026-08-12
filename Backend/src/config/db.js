import mongoose from "mongoose";
import User from "../models/userModel.js";
import LoanTransaction from "../models/loanModel.js";

const ensureModelIndexes = async () => {
  let loanIndexes = [];
  try {
    loanIndexes = await LoanTransaction.collection.indexes();
  } catch (error) {
    // A brand-new database has no loantransactions collection yet.
    if (error.code !== 26) throw error;
  }

  const legacyIndex = loanIndexes.find(
    (index) => index.name === "unique_interest_period_per_user",
  );

  if (legacyIndex && !legacyIndex.partialFilterExpression) {
    console.log("Replacing legacy loan-interest sparse index...");
    await LoanTransaction.collection.dropIndex(legacyIndex.name);
  }

  // autoIndex is disabled during connection so the legacy index can be safely
  // replaced before Mongoose attempts to create the corrected definition.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.createIndexes()),
  );
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: false,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    await ensureModelIndexes();
    await User.createDefaultAdmin();
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
