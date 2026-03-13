/**
 * Admin Seeder
 *
 * Creates a default super_admin and admin user using credentials from
 * environment variables. Uses upsert logic — safe to re-run at any time.
 *
 * On each run:
 *  - If the user does NOT exist → creates it with a freshly bcrypt-hashed password.
 *  - If the user DOES exist → updates fullName, role, isActive, and re-hashes
 *    the password so credentials from .env are always applied.
 *
 * Usage:
 *   npm run seed:admin
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "../config/env.config";
import connectDatabase from "../config/database.config";
import User from "../modules/auth/model";
import { UserRole } from "../types";

interface SeedUser {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

const SEED_USERS: SeedUser[] = [
  {
    email: config.superAdminEmail,
    password: config.superAdminPassword,
    fullName: config.superAdminFullName,
    role: UserRole.SUPER_ADMIN,
  },
  {
    email: config.adminEmail,
    password: config.adminPassword,
    fullName: config.adminFullName,
    role: UserRole.ADMIN,
  },
];

/**
 * Upserts a single admin/super_admin user.
 * Always hashes the password from env so credentials stay in sync.
 */
const upsertAdminUser = async (data: SeedUser): Promise<void> => {
  // Hash the password directly — bypasses the pre-save hook to avoid double-hashing
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const existing = await User.findOne({ email: data.email });

  if (existing) {
    // Update all fields including the freshly hashed password
    existing.fullName = data.fullName;
    existing.role = data.role;
    existing.isActive = true;
    existing.password = hashedPassword;
    // Mark password as NOT modified so the pre-save hook does NOT re-hash it
    existing.markModified("fullName");
    // Use updateOne to bypass the pre-save hook entirely
    await User.updateOne(
      { _id: existing._id },
      {
        $set: {
          fullName: data.fullName,
          role: data.role,
          isActive: true,
          password: hashedPassword,
        },
      },
    );
    console.log(`  ✅ Updated  [${data.role}] ${data.email}`);
  } else {
    // Create new user — insert directly with pre-hashed password
    // Use insertOne via the model to bypass the pre-save hook
    await User.collection.insertOne({
      email: data.email,
      password: hashedPassword,
      fullName: data.fullName,
      role: data.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  ✅ Created  [${data.role}] ${data.email}`);
  }
};

const run = async (): Promise<void> => {
  console.log("\n🌱 MicroFinance Admin Seeder");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await connectDatabase();

  for (const seedUser of SEED_USERS) {
    await upsertAdminUser(seedUser);
  }

  console.log("\n✅ Seeding complete.\n");
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
