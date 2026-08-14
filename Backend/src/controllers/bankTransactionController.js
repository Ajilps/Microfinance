import BankTransaction from "../models/bankTransactionModel.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const parseBankDate = (value, fieldName) => {
  if (!value || typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  return date;
};

const validateBankTransaction = (body) => {
  const particulars =
    typeof body.particulars === "string" ? body.particulars.trim() : "";
  const chequeNumber =
    typeof body.chequeNumber === "string" ? body.chequeNumber.trim() : "";
  const chequeName =
    typeof body.chequeName === "string" ? body.chequeName.trim() : "";
  const withdrawal = body.withdrawal === "" ? 0 : Number(body.withdrawal || 0);
  const deposit = body.deposit === "" ? 0 : Number(body.deposit || 0);

  if (!particulars) throw new Error("Particulars are required");
  if (particulars.length > 300) {
    throw new Error("Particulars cannot exceed 300 characters");
  }
  if (chequeNumber.length > 100) {
    throw new Error("Cheque number cannot exceed 100 characters");
  }
  if (chequeName.length > 200) {
    throw new Error("Cheque name cannot exceed 200 characters");
  }
  if (!Number.isFinite(withdrawal) || withdrawal < 0) {
    throw new Error("Withdrawal must be zero or greater");
  }
  if (!Number.isFinite(deposit) || deposit < 0) {
    throw new Error("Deposit must be zero or greater");
  }
  if ((withdrawal > 0 && deposit > 0) || (withdrawal === 0 && deposit === 0)) {
    throw new Error("Enter either a withdrawal or a deposit, but not both");
  }

  return {
    transactionDate: parseBankDate(body.transactionDate, "transactionDate"),
    particulars,
    chequeNumber,
    chequeName,
    withdrawal: roundMoney(withdrawal),
    deposit: roundMoney(deposit),
  };
};

const buildBankLedger = (transactions) => {
  let balance = 0;
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  const entries = transactions.map((transaction) => {
    const deposit = roundMoney(transaction.deposit);
    const withdrawal = roundMoney(transaction.withdrawal);
    totalDeposits += deposit;
    totalWithdrawals += withdrawal;
    balance += deposit - withdrawal;
    return {
      ...(typeof transaction.toObject === "function"
        ? transaction.toObject()
        : transaction),
      deposit,
      withdrawal,
      balance: roundMoney(balance),
    };
  });

  return {
    entries,
    totals: {
      totalDeposits: roundMoney(totalDeposits),
      totalWithdrawals: roundMoney(totalWithdrawals),
      currentBalance: roundMoney(balance),
    },
  };
};

const createBankTransaction = async (req, res) => {
  let values;
  try {
    values = validateBankTransaction(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const transaction = await BankTransaction.create({
    ...values,
    recordedBy: req.user._id,
  });
  await transaction.populate("recordedBy", "name");
  return res.status(201).json(transaction);
};

const updateBankTransaction = async (req, res) => {
  let values;
  try {
    values = validateBankTransaction(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const transaction = await BankTransaction.findById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ message: "Bank transaction not found" });
  }

  Object.assign(transaction, values, { updatedBy: req.user._id });
  await transaction.save();
  await transaction.populate([
    { path: "recordedBy", select: "name" },
    { path: "updatedBy", select: "name" },
  ]);
  return res.json(transaction);
};

const getBankTransactions = async (req, res) => {
  let startDate;
  let endExclusive;
  try {
    if (req.query.startDate) {
      startDate = parseBankDate(req.query.startDate, "startDate");
    }
    if (req.query.endDate) {
      endExclusive = parseBankDate(req.query.endDate, "endDate");
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    }
    if (startDate && endExclusive && startDate >= endExclusive) {
      return res.status(400).json({
        message: "startDate must be on or before endDate",
      });
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const transactions = await BankTransaction.find()
    .sort({ transactionDate: 1, createdAt: 1, _id: 1 })
    .populate("recordedBy", "name")
    .populate("updatedBy", "name");
  const ledger = buildBankLedger(transactions);
  const filteredEntries = ledger.entries.filter((entry) => {
    const date = new Date(entry.transactionDate);
    return (!startDate || date >= startDate) && (!endExclusive || date < endExclusive);
  });
  const filteredDeposits = filteredEntries.reduce(
    (sum, entry) => sum + entry.deposit,
    0,
  );
  const filteredWithdrawals = filteredEntries.reduce(
    (sum, entry) => sum + entry.withdrawal,
    0,
  );

  return res.json({
    entries: filteredEntries.reverse(),
    totals: {
      ...ledger.totals,
      filteredDeposits: roundMoney(filteredDeposits),
      filteredWithdrawals: roundMoney(filteredWithdrawals),
    },
  });
};

export {
  buildBankLedger,
  createBankTransaction,
  getBankTransactions,
  parseBankDate,
  updateBankTransaction,
  validateBankTransaction,
};
