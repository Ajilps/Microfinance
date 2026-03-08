import { body, param } from "express-validator";

export const updateProfileValidation = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2 and 100 characters"),

  body("phone")
    .optional()
    .trim()
    .isMobilePhone("any")
    .withMessage("Please provide a valid phone number"),
];

export const userIdParamValidation = [
  param("id").isMongoId().withMessage("Invalid user ID"),
];
