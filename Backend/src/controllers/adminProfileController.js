import {
  ADMIN_EMAIL_PATTERN,
  ADMIN_PASSWORD_REQUIREMENTS,
} from "../config/constants.js";
import User from "../models/userModel.js";
import { generateToken } from "../utils/authToken.js";

const normalizeAdminProfileInput = ({ name, email } = {}) => {
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (normalizedName.length < 2 || normalizedName.length > 100) {
    throw new Error("Name must be between 2 and 100 characters");
  }
  if (
    !ADMIN_EMAIL_PATTERN.test(normalizedEmail) ||
    normalizedEmail.length > 254
  ) {
    throw new Error("Please enter a valid email address");
  }

  return { name: normalizedName, email: normalizedEmail };
};

const validateAdminPassword = (password) => {
  const value = String(password || "");
  const missing = ADMIN_PASSWORD_REQUIREMENTS.filter(
    ({ test }) => !test(value),
  ).map(({ message }) => message);

  if (missing.length > 0) {
    throw new Error(`New password must include ${missing.join(", ")}`);
  }

  return value;
};

const serializeAdmin = (admin, { includeToken = false } = {}) => {
  const result = {
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };

  if (includeToken) result.token = generateToken(admin);
  return result;
};

// @desc    Get the currently authenticated admin profile
// @route   GET /api/admin/profile
// @access  Private/Admin
const getAdminProfile = async (req, res) => {
  res.json(serializeAdmin(req.user));
};

// @desc    Update the currently authenticated admin profile
// @route   PUT /api/admin/profile
// @access  Private/Admin
const updateAdminProfile = async (req, res) => {
  let profile;
  try {
    profile = normalizeAdminProfileInput(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const duplicate = await User.findOne({
    email: profile.email,
    _id: { $ne: req.user._id },
  });
  if (duplicate) {
    return res.status(409).json({ message: "Email address is already in use" });
  }

  const admin = await User.findById(req.user._id);
  if (!admin || admin.role !== "admin") {
    return res.status(404).json({ message: "Admin account not found" });
  }

  admin.name = profile.name;
  admin.email = profile.email;

  try {
    await admin.save();
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Email address is already in use" });
    }
    throw error;
  }

  res.json({
    message: "Profile updated successfully",
    ...serializeAdmin(admin, { includeToken: true }),
  });
};

// @desc    Change the currently authenticated admin password
// @route   PUT /api/admin/profile/password
// @access  Private/Admin
const changeAdminPassword = async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  let newPassword;

  if (!currentPassword) {
    return res.status(400).json({ message: "Current password is required" });
  }

  try {
    newPassword = validateAdminPassword(req.body?.newPassword);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const admin = await User.findById(req.user._id).select("+password");
  if (!admin || admin.role !== "admin") {
    return res.status(404).json({ message: "Admin account not found" });
  }

  if (!(await admin.matchPassword(currentPassword))) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  if (await admin.matchPassword(newPassword)) {
    return res.status(400).json({
      message: "New password must be different from the current password",
    });
  }

  admin.password = newPassword;
  admin.tokenVersion = Number(admin.tokenVersion || 0) + 1;
  await admin.save();

  res.json({
    message: "Password changed successfully. Other sessions were signed out.",
    ...serializeAdmin(admin, { includeToken: true }),
  });
};

export {
  changeAdminPassword,
  getAdminProfile,
  normalizeAdminProfileInput,
  updateAdminProfile,
  validateAdminPassword,
};
