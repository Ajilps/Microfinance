import cron from "node-cron";
import User from "../models/userModel.js";
import LoanTransaction from "../models/loanModel.js";

/**
 * Auto-applies 1% interest on the PRINCIPAL BALANCE every 28 days.
 *
 * Key rules:
 *   - Interest is calculated on the PRINCIPAL balance only (never on accrued interest)
 *   - Interest is recorded as a SEPARATE line item with period metadata
 *   - Interest is NEVER added to the principal balance (no capitalization)
 *   - The cron runs daily at midnight and checks whether 28 days have passed
 *     since the last interest transaction for each user.
 */
const applyLoanInterest = async () => {
  console.log("[InterestCron] Running loan interest check...");

  try {
    // Get all regular users
    const users = await User.find({ role: "user" }).select("_id name");

    let applied = 0;
    let skipped = 0;

    for (const user of users) {
      // Get all transactions for this user, sorted oldest first
      const transactions = await LoanTransaction.find({ user: user._id }).sort({
        date: 1,
      });

      if (transactions.length === 0) {
        skipped++;
        continue;
      }

      // Compute PRINCIPAL balance only (interest never added to principal)
      let principalBalance = 0;
      for (const tx of transactions) {
        if (tx.type === "loan") {
          principalBalance += tx.amount;
        } else if (
          tx.type === "repayment" &&
          tx.paymentTarget === "principal"
        ) {
          principalBalance -= tx.amount;
        }
        // Legacy repayments without paymentTarget: treat as principal repayment
        else if (tx.type === "repayment" && !tx.paymentTarget) {
          principalBalance -= tx.amount;
        }
      }

      // Skip users with zero or negative principal balance (loan fully repaid)
      if (principalBalance <= 0) {
        skipped++;
        continue;
      }

      // Find the date of the last interest transaction
      const lastInterestTx = transactions
        .filter((tx) => tx.type === "interest")
        .at(-1);

      // If no prior interest, use the date of the first loan disbursement
      const firstLoan = transactions.find((tx) => tx.type === "loan");
      const referenceDate = lastInterestTx
        ? new Date(lastInterestTx.date)
        : new Date(firstLoan?.date);

      if (!referenceDate) {
        skipped++;
        continue;
      }

      const now = new Date();
      const daysSinceReference = Math.floor(
        (now - referenceDate) / (1000 * 60 * 60 * 24),
      );

      // Only apply interest if 28 days have passed
      if (daysSinceReference < 28) {
        skipped++;
        continue;
      }

      // Calculate period start and end
      const periodStart = new Date(referenceDate);
      const periodEnd = new Date(referenceDate);
      periodEnd.setDate(periodEnd.getDate() + 28);

      // Calculate interest: 1% of PRINCIPAL balance (never on interest balance)
      const interestRate = 0.01;
      const interestAmount = parseFloat(
        (principalBalance * interestRate).toFixed(2),
      );

      await LoanTransaction.create({
        user: user._id,
        type: "interest",
        amount: interestAmount,
        date: now,
        note: `Auto interest: 1% of principal ₹${principalBalance.toFixed(2)} for period ${periodStart.toLocaleDateString("en-IN")} – ${periodEnd.toLocaleDateString("en-IN")}`,
        recordedBy: null, // System-generated
        interestPeriod: {
          periodStart,
          periodEnd,
          principalBalance,
          interestRate,
        },
      });

      console.log(
        `[InterestCron] Applied ₹${interestAmount} interest for user ${user.name} (principal: ₹${principalBalance.toFixed(2)}, period: ${periodStart.toLocaleDateString("en-IN")} – ${periodEnd.toLocaleDateString("en-IN")})`,
      );
      applied++;
    }

    console.log(
      `[InterestCron] Done — applied: ${applied}, skipped: ${skipped}`,
    );
  } catch (err) {
    console.error("[InterestCron] Error applying interest:", err.message);
  }
};

/**
 * Schedule: runs every day at midnight (00:00).
 * The handler itself checks if 28 days have elapsed per user,
 * so running daily is just the trigger — no duplicate interest is applied.
 */
const startInterestCron = () => {
  // Run every day at midnight
  cron.schedule("0 0 * * *", applyLoanInterest, {
    timezone: "Asia/Kolkata",
  });
  console.log(
    "[InterestCron] 28-day loan interest scheduler started (principal-only calculation).",
  );
};

export { startInterestCron, applyLoanInterest };
