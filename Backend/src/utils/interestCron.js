import cron from "node-cron";
import LoanTransaction from "../models/loanModel.js";
import User from "../models/userModel.js";
import { calculateInterestPeriods } from "../controllers/loanController.js";

const applyDueInterest = async (toDate = new Date()) => {
  const users = await User.find({ role: "user" }).select("_id");
  let periodsApplied = 0;

  for (const user of users) {
    const transactions = await LoanTransaction.find({ user: user._id }).sort({
      date: 1,
    });

    const duePeriods = calculateInterestPeriods(transactions, toDate).filter(
      (period) => !period.alreadyRecorded && !period.isPartial,
    );

    for (const period of duePeriods) {
      try {
        await LoanTransaction.create({
          user: user._id,
          type: "interest",
          amount: period.interestAmount,
          date: period.periodEnd,
          note: `Automatic interest: 1% of ₹${period.principalBalance.toFixed(2)} for ${period.periodStart.toLocaleDateString("en-IN")} – ${period.periodEnd.toLocaleDateString("en-IN")}`,
          interestPeriod: {
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            principalBalance: period.principalBalance,
            interestRate: period.interestRate,
          },
        });
        periodsApplied += 1;
      } catch (error) {
        // Another server instance may have inserted the same period first.
        if (error.code !== 11000) throw error;
      }
    }
  }

  return periodsApplied;
};

const startInterestCron = () => {
  if (process.env.INTEREST_CRON_ENABLED === "false") {
    console.log("Automatic interest scheduler disabled");
    return null;
  }

  const timezone = process.env.INTEREST_CRON_TIMEZONE || "Asia/Kolkata";
  const task = cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const periodsApplied = await applyDueInterest();
        console.log(
          `[InterestCron] Applied ${periodsApplied} due interest period(s)`,
        );
      } catch (error) {
        console.error("[InterestCron] Failed:", error.message);
      }
    },
    { timezone },
  );

  console.log(`Automatic interest scheduler started (${timezone})`);
  return task;
};

export { applyDueInterest, startInterestCron };
