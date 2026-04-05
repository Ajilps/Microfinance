import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import LoanTransaction from "../models/loanModel.js";
import SavingsPayment from "../models/savingsModel.js";

// Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  const users = await User.find({ role: "user" });
  res.json(users);
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(user);
};

// @desc    Update user details
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { name, email, password, role } = req.body;
  if (name) user.name = name;
  if (email) user.email = email;
  if (password) user.password = password;
  if (role) user.role = role;

  const updated = await user.save();
  res.json({
    _id: updated._id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
  });
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  const userId = req.params.id;

  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await LoanTransaction.deleteMany({ user: userId });
  await SavingsPayment.deleteMany({ user: userId });

  res.json({ message: "User deleted successfully" });
};

// @desc    Create a new user (admin or regular) from the admin panel
// @route   POST /api/admin/users
// @access  Private/Admin
const createUser = async (req, res) => {
  const { name, email, password, role = "user" } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide name, email, and password" });
  }

  if (![""].concat(["user", "admin"]).slice(1).includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res
      .status(409)
      .json({ message: "A user with this email already exists" });
  }

  const newUser = await User.create({ name, email, password, role });

  res.status(201).json({
    _id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    createdAt: newUser.createdAt,
  });
};

// @desc    Create a new admin account
// @route   POST /api/admin/create
// @access  Private/Admin
const createAdmin = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide name, email, and password" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res
      .status(409)
      .json({ message: "User with this email already exists" });
  }

  const admin = await User.create({ name, email, password, role: "admin" });
  const token = generateToken(admin._id);

  res.status(201).json({
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    token,
  });
};

// @desc    Get all admins
// @route   GET /api/admin/all
// @access  Private/Admin
const getAllAdmins = async (req, res) => {
  const admins = await User.find({ role: "admin" });
  res.json(admins);
};

export {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
  createAdmin,
  getAllAdmins,
};
