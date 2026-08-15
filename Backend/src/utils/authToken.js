import jwt from "jsonwebtoken";

const generateToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      tokenVersion: Number(user.tokenVersion || 0),
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

const isTokenVersionCurrent = (decodedToken, user) =>
  Number(decodedToken?.tokenVersion || 0) === Number(user?.tokenVersion || 0);

export { generateToken, isTokenVersionCurrent };
