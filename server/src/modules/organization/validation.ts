import { body, param } from "express-validator";

export const createOrganizationValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Organization name must be between 2 and 100 characters"),

  body("subdomain")
    .trim()
    .toLowerCase()
    .isLength({ min: 2, max: 50 })
    .withMessage("Subdomain must be between 2 and 50 characters")
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Subdomain can only contain lowercase letters, numbers, and hyphens",
    ),

  body("subscriptionPlan")
    .optional()
    .isIn(["free", "basic", "premium", "enterprise"])
    .withMessage(
      "Subscription plan must be one of: free, basic, premium, enterprise",
    ),

  body("settings.loanInterestRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Loan interest rate must be between 0 and 100"),

  body("settings.minSavingsForLoan")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum savings for loan must be a non-negative number"),
];

export const updateOrganizationValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Organization name must be between 2 and 100 characters"),

  body("subscriptionPlan")
    .optional()
    .isIn(["free", "basic", "premium", "enterprise"])
    .withMessage(
      "Subscription plan must be one of: free, basic, premium, enterprise",
    ),

  body("settings.loanInterestRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Loan interest rate must be between 0 and 100"),

  body("settings.minSavingsForLoan")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum savings for loan must be a non-negative number"),
];

export const orgIdParamValidation = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
];
