const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const getId = (record) => String(record?._id || "");

const computeSavingsSummary = (payments = [], withdrawals = []) => {
  const totalDeposits = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const totalWithdrawals = withdrawals.reduce(
    (sum, withdrawal) => sum + Number(withdrawal.amount || 0),
    0,
  );
  return {
    totalDeposits: roundMoney(totalDeposits),
    totalWithdrawals: roundMoney(totalWithdrawals),
    totalSavings: Math.max(0, roundMoney(totalDeposits - totalWithdrawals)),
    depositCount: payments.length,
    withdrawalCount: withdrawals.length,
    transactionCount: payments.length + withdrawals.length,
  };
};

const buildSavingsTimeline = (payments = [], withdrawals = []) => [
  ...payments.map((payment) => ({
    id: getId(payment),
    type: "deposit",
    amount: Number(payment.amount || 0),
    date: new Date(payment.paidOn),
    createdAt: new Date(payment.createdAt || payment.paidOn),
    record: payment,
  })),
  ...withdrawals.map((withdrawal) => ({
    id: getId(withdrawal),
    type: "withdrawal",
    amount: Number(withdrawal.amount || 0),
    date: new Date(withdrawal.withdrawalDate),
    createdAt: new Date(withdrawal.createdAt || withdrawal.withdrawalDate),
    record: withdrawal,
  })),
].sort(
  (left, right) =>
    left.date - right.date ||
    // Money deposited on a date is available for a withdrawal on that date.
    (left.type === right.type ? 0 : left.type === "deposit" ? -1 : 1) ||
    left.createdAt - right.createdAt,
);

const validateSavingsTimeline = (payments = [], withdrawals = []) => {
  let balance = 0;
  for (const transaction of buildSavingsTimeline(payments, withdrawals)) {
    balance +=
      transaction.type === "deposit"
        ? transaction.amount
        : -transaction.amount;
    balance = roundMoney(balance);
    if (balance < 0) {
      return {
        valid: false,
        balanceBefore: roundMoney(balance + transaction.amount),
        shortage: roundMoney(-balance),
        transaction,
      };
    }
  }
  return { valid: true, balance: roundMoney(balance) };
};

export {
  buildSavingsTimeline,
  computeSavingsSummary,
  roundMoney,
  validateSavingsTimeline,
};
