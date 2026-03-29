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
 *     since the last interest period end for each user.
 *   - If multiple periods were missed (e.g. cron was down), ALL missed periods
 *     are applied in a single run to prevent under-charging.
 *   - Legacy repayments (no paymentTarget) are applied to interest first, then
 *     principal — consistent with computeLoanSummary in loanController.js.
 */

const PERIOD_DAYS = 28;
const INTEREST_RATE = 0.01;

/**
 * Computes the principal balance from a sorted (oldest-first) transaction list.
 * Mirrors the logic in computeLoanSummary (loanController.js) exactly:
 *   - loan          → increases principal
 *   - repayment/principal → decreases principal
 *   - repayment/interest  → decreases interest only (no effect on principal)
 *   - repayment (legacy, no paymentTarget) → applied to interest first, then principal
 *   - interest / fine → no effect on principal
 *
 * @param {Array} transactions - sorted oldest-first
 * @returns {{ principalBalance: number, interestBalance: number }}
 */
const computeBalances = (transactions) => {
  let totalDisbursed = 0;
  let totalPrincipalRepaid = 0;
  let totalInterestAccrued = 0;
  let totalFines = 0;
  let totalInterestRepaid = 0;

  for (const tx of transactions) {
    if (tx.type === "loan") {
      totalDisbursed += tx.amount;
    } else if (tx.type === "interest") {
      totalInterestAccrued += tx.amount;
    } else if (tx.type === "fine") {
      totalFines += tx.amount;
    } else if (tx.type === "repayment") {
      if (tx.paymentTarget === "principal") {
        totalPrincipalRepaid += tx.amount;
      } else if (tx.paymentTarget === "interest") {
        totalInterestRepaid += tx.amount;
      } else {
        // Legacy repayments without paymentTarget:
        // apply to outstanding interest first, then to principal.
        const remainingInterest =
          totalInterestAccrued + totalFines - totalInterestRepaid;
        if (remainingInterest > 0) {
          const toInterest = Math.min(tx.amount, remainingInterest);
          totalInterestRepaid += toInterest;
          totalPrincipalRepaid += tx.amount - toInterest;
        } else {
          totalPrincipalRepaid += tx.amount;
        }
      }
    }
  }

  return {
    principalBalance: Math.max(0, totalDisbursed - totalPrincipalRepaid),
    interestBalance: Math.max(
      0,
      totalInterestAccrued + totalFines - totalInterestRepaid,
    ),
  };
};

/**
 * Returns the principal balance as of a specific date, considering only
 * transactions on or before that date.
 * Used to determine the correct principal for each historical period.
 *
 * @param {Array} transactions - all transactions, sorted oldest-first
 * @param {Date}  asOfDate
 * @returns {number}
 */
const getPrincipalAtDate = (transactions, asOfDate) => {
  let totalDisbursed = 0;
  let totalPrincipalRepaid = 0;
  let totalInterestAccrued = 0;
  let totalFines = 0;
  let totalInterestRepaid = 0;

  for (const tx of transactions) {
    if (new Date(tx.date) > asOfDate) break; // sorted oldest-first

    if (tx.type === "loan") {
      totalDisbursed += tx.amount;
    } else if (tx.type === "interest") {
      totalInterestAccrued += tx.amount;
    } else if (tx.type === "fine") {
      totalFines += tx.amount;
    } else if (tx.type === "repayment") {
      if (tx.paymentTarget === "principal") {
        totalPrincipalRepaid += tx.amount;
      } else if (tx.paymentTarget === "interest") {
        totalInterestRepaid += tx.amount;
      } else {
        const remainingInterest =
          totalInterestAccrued + totalFines - totalInterestRepaid;
        if (remainingInterest > 0) {
          const toInterest = Math.min(tx.amount, remainingInterest);
          totalInterestRepaid += toInterest;
          totalPrincipalRepaid += tx.amount - toInterest;
        } else {
          totalPrincipalRepaid += tx.amount;
        }
      }
    }
  }

  return Math.max(0, totalDisbursed - totalPrincipalRepaid);
};

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

      // Compute current principal balance (mirrors computeLoanSummary exactly)
      const { principalBalance } = computeBalances(transactions);

      // Skip users with zero or negative principal balance (loan fully repaid)
      if (principalBalance <= 0) {
        skipped++;
        continue;
      }

      // Find the first loan disbursement — this anchors the period timeline
      const firstLoan = transactions.find((tx) => tx.type === "loan");
      if (!firstLoan) {
        skipped++;
        continue;
      }

      // Determine where the next period should start:
      //   - If there are prior interest transactions, use the periodEnd of the
      //     last one (so periods stay anchored to the original disbursement date
      //     and don't drift when the cron runs late).
      //   - Fall back to the first loan date if no interest has been applied yet.
      const interestTxs = transactions.filter((tx) => tx.type === "interest");
      const lastInterestTx = interestTxs.at(-1);

      let nextPeriodStart;
      if (
        lastInterestTx &&
        lastInterestTx.interestPeriod &&
        lastInterestTx.interestPeriod.periodEnd
      ) {
        // Anchor to the end of the last recorded period (no drift)
        nextPeriodStart = new Date(lastInterestTx.interestPeriod.periodEnd);
      } else {
        // No interest recorded yet — start from the first loan disbursement
        nextPeriodStart = new Date(firstLoan.date);
      }

      const now = new Date();

      // Apply ALL overdue periods in one run (handles cron downtime / missed days)
      let periodsAppliedThisRun = 0;
      while (true) {
        const periodEnd = new Date(nextPeriodStart);
        periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS);

        // Stop if this period has not yet completed
        if (periodEnd > now) break;

        // Get the principal balance at the START of this period
        // (principal may have changed due to repayments during the period)
        const principalAtPeriodStart = getPrincipalAtDate(
          transactions,
          nextPeriodStart,
        );

        if (principalAtPeriodStart <= 0) {
          // No principal at the start of this period — skip it
          nextPeriodStart = new Date(periodEnd);
          continue;
        }

        const interestAmount = parseFloat(
          (principalAtPeriodStart * INTEREST_RATE).toFixed(2),
        );

        const periodStart = new Date(nextPeriodStart);

        await LoanTransaction.create({
          user: user._id,
          type: "interest",
          amount: interestAmount,
          date: now,
          note: `Auto interest: 1% of principal ₹${principalAtPeriodStart.toFixed(2)} for period ${periodStart.toLocaleDateString("en-IN")} – ${periodEnd.toLocaleDateString("en-IN")}`,
          recordedBy: null, // System-generated
          interestPeriod: {
            periodStart,
            periodEnd,
            principalBalance: principalAtPeriodStart,
            interestRate: INTEREST_RATE,
          },
        });

        console.log(
          `[InterestCron] Applied ₹${interestAmount} interest for user ${user.name} (principal: ₹${principalAtPeriodStart.toFixed(2)}, period: ${periodStart.toLocaleDateString("en-IN")} – ${periodEnd.toLocaleDateString("en-IN")})`,
        );

        applied++;
        periodsAppliedThisRun++;

        // Advance to the next period
        nextPeriodStart = new Date(periodEnd);
      }

      if (periodsAppliedThisRun === 0) {
        skipped++;
      }
    }

    console.log(
      `[InterestCron] Done — applied: ${applied} period(s), skipped: ${skipped} user(s)`,
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
