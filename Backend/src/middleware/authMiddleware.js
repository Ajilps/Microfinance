import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { isTokenVersionCurrent } from "../utils/authToken.js";

const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Not authorized, user not found" });
    }

    if (!isTokenVersionCurrent(decoded, req.user)) {
      return res.status(401).json({
        message: "Your session has expired. Please log in again.",
      });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

export { protect };
