import Attendance from "../models/attendanceModel.js";
import AuditLog from "../models/auditLogModel.js";
import FinePayment from "../models/finePaymentModel.js";
import LoanTransaction from "../models/loanModel.js";
import SavingsPayment from "../models/savingsModel.js";

/**
 * Remove records owned by a member before deleting the member account.
 * Keeping this in one place prevents the admin and self-service delete paths
 * from leaving different sets of orphaned records behind.
 */
const deleteUserData = async (userId) => {
  await Promise.all([
    Attendance.deleteMany({ user: userId }),
    FinePayment.deleteMany({ user: userId }),
    LoanTransaction.deleteMany({ user: userId }),
    SavingsPayment.deleteMany({ user: userId }),
    AuditLog.deleteMany({ $or: [{ userId }, { adminId: userId }] }),
  ]);
};

export default deleteUserData;
