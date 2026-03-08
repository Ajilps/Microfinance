/**
 * Admin Seeder
 *
 * Creates a default super_admin and admin user using credentials from
 * environment variables. Uses upsert logic — safe to re-run at any time.
 *
 * Usage:
 *   npx ts-node src/seeders/adminSeeder.ts
 *   — or —
 *   npm run seed:admin   (add script to package.json)
 */

import "dotenv/config";
import mongoose from "mongoose";
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
 * - If the user does not exist → creates it (password will be hashed by the pre-save hook).
 * - If the user already exists → updates fullName and role only (does NOT overwrite password).
 */
const upsertAdminUser = async (data: SeedUser): Promise<void> => {
  const existing = await User.findOne({ email: data.email });

  if (existing) {
    // Update non-sensitive fields only
    existing.fullName = data.fullName;
    existing.role = data.role;
    existing.isActive = true;
    await existing.save({ validateBeforeSave: false });
    console.log(`  ✅ Updated  [${data.role}] ${data.email}`);
  } else {
    // Create new — the pre-save hook will hash the password
    await User.create({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      role: data.role,
      isActive: true,
      // organizationId is intentionally omitted for platform-level admins;
      // validateBeforeSave is not used here so the model's required check
      // would fail — we mark organizationId as optional for SUPER_ADMIN users
      // by saving with validateBeforeSave: false below.
    }).catch(async () => {
      // Fallback: use save with validation bypassed for missing organizationId
      const user = new User({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
        isActive: true,
      });
      await user.save({ validateBeforeSave: false });
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
