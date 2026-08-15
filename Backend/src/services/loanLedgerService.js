const DAY_MS = 24 * 60 * 60 * 1000;
const INTEREST_PERIOD_DAYS = 28;
const INTEREST_RATE = 0.01;

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const compareTransactions = (left, right) =>
  new Date(left.date) - new Date(right.date) ||
  new Date(left.createdAt || 0) - new Date(right.createdAt || 0);

const addUtcDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

/**
 * Computes balances while keeping principal and interest strictly separated.
 * A closure represents one atomic settlement: it charges the last prorated
 * interest amount, records all remaining principal/interest as paid, and
 * therefore leaves both balances at zero.
 */
const computeLoanSummary = (transactions) => {
  let totalDisbursed = 0;
  let totalPrincipalRepaid = 0;
  let totalInterestAccrued = 0;
  let totalFines = 0;
  let totalInterestRepaid = 0;

  for (const transaction of [...transactions].sort(compareTransactions)) {
    if (transaction.type === "loan") {
      totalDisbursed += transaction.amount;
    } else if (transaction.type === "interest") {
      totalInterestAccrued += transaction.amount;
    } else if (transaction.type === "fine") {
      totalFines += transaction.amount;
    } else if (transaction.type === "closure") {
      totalPrincipalRepaid += Number(
        transaction.closureDetails?.principalPaid || 0,
      );
      totalInterestAccrued += Number(
        transaction.closureDetails?.interestCharged || 0,
      );
      totalInterestRepaid += Number(
        transaction.closureDetails?.interestPaid || 0,
      );
    } else if (transaction.type === "repayment") {
      if (transaction.paymentTarget === "principal") {
        totalPrincipalRepaid += transaction.amount;
      } else if (transaction.paymentTarget === "interest") {
        totalInterestRepaid += transaction.amount;
      } else {
        // Legacy repayments without a target reduce interest first.
        const remainingInterest =
          totalInterestAccrued + totalFines - totalInterestRepaid;
        if (remainingInterest > 0) {
          const toInterest = Math.min(transaction.amount, remainingInterest);
          totalInterestRepaid += toInterest;
          totalPrincipalRepaid += transaction.amount - toInterest;
        } else {
          totalPrincipalRepaid += transaction.amount;
        }
      }
    }
  }

  const principalBalance = Math.max(
    0,
    roundMoney(totalDisbursed - totalPrincipalRepaid),
  );
  const interestBalance = Math.max(
    0,
    roundMoney(totalInterestAccrued + totalFines - totalInterestRepaid),
  );

  return {
    totalDisbursed: roundMoney(totalDisbursed),
    totalPrincipalRepaid: roundMoney(totalPrincipalRepaid),
    totalInterestAccrued: roundMoney(totalInterestAccrued),
    totalFines: roundMoney(totalFines),
    totalInterestRepaid: roundMoney(totalInterestRepaid),
    principalBalance,
    interestBalance,
    totalOutstanding: roundMoney(principalBalance + interestBalance),
  };
};

/**
 * Split the principal ledger into independent loan cycles. Only an explicit
 * closure ends a cycle. This preserves the established 28-day calendar for
 * legacy ledgers where principal once reached zero and a later loan was added
 * without a formal closure. A loan after a new closure gets a fresh calendar.
 */
const buildLoanCycles = (transactions) => {
  const sorted = [...transactions].sort(compareTransactions);
  const cycles = [];
  let currentCycle = null;

  for (const transaction of sorted) {
    const date = new Date(transaction.date);
    if (Number.isNaN(date.getTime())) continue;

    if (transaction.type === "loan") {
      if (!currentCycle) {
        currentCycle = { start: date, end: null, events: [] };
        cycles.push(currentCycle);
      }
      currentCycle.events.push(transaction);
      continue;
    }

    if (!currentCycle) continue;

    if (
      transaction.type === "repayment" &&
      transaction.paymentTarget === "principal"
    ) {
      currentCycle.events.push(transaction);
    } else if (transaction.type === "closure") {
      currentCycle.events.push(transaction);
      currentCycle.end = date;
      currentCycle = null;
    }
  }

  return cycles;
};

const getRecordedInterestPeriods = (transactions) => {
  const recorded = [];
  for (const transaction of transactions) {
    if (transaction.type === "interest" && transaction.interestPeriod?.periodStart) {
      recorded.push({
        periodStart: new Date(transaction.interestPeriod.periodStart),
        transactionId: transaction._id || null,
      });
    }
    if (transaction.type === "closure") {
      for (const period of transaction.closureDetails?.interestPeriods || []) {
        if (!period.periodStart) continue;
        recorded.push({
          periodStart: new Date(period.periodStart),
          transactionId: transaction._id || null,
        });
      }
    }
  }
  return recorded;
};

/**
 * Builds all completed and partial 28-day periods through a target date.
 * Recorded periods are matched by period start, so calculations are repeatable
 * and closure projections cannot be applied twice.
 */
const calculateInterestPeriods = (transactions, toDate = new Date()) => {
  if (!transactions || transactions.length === 0) return [];

  const targetDate = new Date(toDate);
  if (Number.isNaN(targetDate.getTime())) return [];

  const cycles = buildLoanCycles(transactions);
  const recordedInterest = getRecordedInterestPeriods(transactions);
  const periods = [];

  for (const cycle of cycles) {
    if (cycle.start >= targetDate) continue;
    const cycleEnd = cycle.end && cycle.end < targetDate ? cycle.end : targetDate;
    if (cycle.start >= cycleEnd) continue;

    const getPrincipalAtDate = (date) => {
      let principal = 0;
      for (const transaction of cycle.events) {
        if (new Date(transaction.date) > date) continue;
        if (transaction.type === "loan") {
          principal += Number(transaction.amount || 0);
        } else if (
          transaction.type === "repayment" &&
          transaction.paymentTarget === "principal"
        ) {
          principal -= Number(transaction.amount || 0);
        } else if (transaction.type === "closure") {
          principal = 0;
        }
      }
      return Math.max(0, roundMoney(principal));
    };

    let periodStart = new Date(cycle.start);
    while (periodStart < cycleEnd) {
      const nominalPeriodEnd = addUtcDays(periodStart, INTEREST_PERIOD_DAYS);
      const isPartial = nominalPeriodEnd > cycleEnd;
      const actualPeriodEnd = isPartial
        ? new Date(cycleEnd)
        : new Date(nominalPeriodEnd);
      const daysInPeriod = Math.max(
        0,
        Math.floor((actualPeriodEnd - periodStart) / DAY_MS),
      );
      const principalBalance = getPrincipalAtDate(periodStart);

      if (principalBalance > 0 && daysInPeriod > 0) {
        const interestAmount = roundMoney(
          isPartial
            ? (principalBalance * INTEREST_RATE * daysInPeriod) /
                INTEREST_PERIOD_DAYS
            : principalBalance * INTEREST_RATE,
        );
        const recordedEntry = recordedInterest.find(
          (entry) =>
            Math.abs(entry.periodStart - periodStart) < DAY_MS,
        );

        periods.push({
          periodStart: new Date(periodStart),
          periodEnd: actualPeriodEnd,
          daysInPeriod,
          isPartial,
          principalBalance,
          interestRate: INTEREST_RATE,
          interestAmount,
          alreadyRecorded: Boolean(recordedEntry),
          recordedTransactionId: recordedEntry?.transactionId || null,
        });
      }

      periodStart = nominalPeriodEnd;
    }
  }

  return periods;
};

export {
  buildLoanCycles,
  calculateInterestPeriods,
  computeLoanSummary,
};
