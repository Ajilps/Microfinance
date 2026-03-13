import { Request } from "express";
import { Document, Types } from "mongoose";

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  iat?: number;
  exp?: number;
}

// ─── Passport / Express namespace augmentation ───────────────────────────────
// Makes req.user conform to JwtPayload everywhere (resolves Express.User conflict)
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends JwtPayload {}
  }
}

/** Extends Express Request to include the authenticated user */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  MANAGER = "manager",
  MEMBER = "member",
}

export enum AccountType {
  SAVINGS = "savings",
  CURRENT = "current",
}

export enum LoanStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  ACTIVE = "active",
  CLOSED = "closed",
}

export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  LOAN_DISBURSEMENT = "loan_disbursement",
  LOAN_REPAYMENT = "loan_repayment",
}

// ─── Document Interfaces ─────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  oauth?: {
    googleId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  subdomain: string;
  subscriptionPlan: string;
  isActive: boolean;
  ownerId?: Types.ObjectId;
  settings: {
    loanInterestRate: number;
    minSavingsForLoan: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccount extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  accountNumber: string;
  accountType: AccountType;
  balance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoan extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  amount: number;
  interestRate: number;
  termMonths: number;
  status: LoanStatus;
  purpose?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  accountId: Types.ObjectId;
  organizationId: Types.ObjectId;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  reference?: string;
  createdAt: Date;
}

// ─── Query / Pagination ───────────────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
