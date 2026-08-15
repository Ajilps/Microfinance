import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

import {
  normalizeAdminProfileInput,
  validateAdminPassword,
} from "../src/controllers/adminProfileController.js";
import {
  generateToken,
  isTokenVersionCurrent,
} from "../src/utils/authToken.js";

test("admin profile normalization trims the name and normalizes email", () => {
  assert.deepEqual(
    normalizeAdminProfileInput({
      name: "  Admin Person  ",
      email: "  ADMIN@Example.COM ",
    }),
    { name: "Admin Person", email: "admin@example.com" },
  );
});

test("admin profile validation rejects invalid identity details", () => {
  assert.throws(
    () => normalizeAdminProfileInput({ name: "A", email: "admin@example.com" }),
    /between 2 and 100/i,
  );
  assert.throws(
    () => normalizeAdminProfileInput({ name: "Admin", email: "invalid" }),
    /valid email/i,
  );
});

test("admin password policy requires every strength category", () => {
  assert.equal(validateAdminPassword("Strong#Pass9"), "Strong#Pass9");
  assert.throws(() => validateAdminPassword("weakpassword"), /uppercase/i);
  assert.throws(() => validateAdminPassword("NoSpecial9"), /special/i);
});

test("token version makes older sessions invalid after a password change", () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-admin-profile-secret";

  try {
    const token = generateToken({ _id: "admin-id", tokenVersion: 3 });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    assert.equal(isTokenVersionCurrent(decoded, { tokenVersion: 3 }), true);
    assert.equal(isTokenVersionCurrent(decoded, { tokenVersion: 4 }), false);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test("legacy tokens without a version remain valid for version-zero accounts", () => {
  assert.equal(isTokenVersionCurrent({ id: "admin-id" }, { tokenVersion: 0 }), true);
  assert.equal(isTokenVersionCurrent({ id: "admin-id" }, { tokenVersion: 1 }), false);
});
