import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

import api from '../../services/api';
import LoanClosurePanel from '../../components/LoanClosurePanel';

const COLORS = {
  indigo: '#e7c87a',
  emerald: '#5e9bbd',
  sky: '#8ab8d2',
  rose: '#d88472',
  amber: '#f5dc9a',
  violet: '#9a88bd',
  muted: '#74889f',
  grid: 'rgba(231, 200, 122, 0.12)',
};

const TABS = [
  ['overview', 'Overview'],
  ['savings', 'Savings'],
  ['loans', 'Loans & Interest'],
  ['attendance', 'Attendance'],
  ['activity', 'All Activity'],
];

const today = () => new Date().toISOString().slice(0, 10);

const dateInputValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
};

const mondayFor = (value) => {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date.toISOString().slice(0, 10);
};

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const compactMoney = (value) => `₹${new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value || 0))}`;

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' })
  : '—');

const titleCase = (value) => String(value || '')
  .replaceAll('-', ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const MoneyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashboard-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((item) => (
        <div key={`${item.dataKey}-${item.name}`} style={{ color: item.color }}>
          <span>{item.name}</span>
          <b>{money(item.value)}</b>
        </div>
      ))}
    </div>
  );
};

const ScreenReaderTable = ({ caption, columns, rows }) => (
  <table className="sr-only">
    <caption>{caption}</caption>
    <thead>
      <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
    </thead>
    <tbody>
      {rows.map((row, index) => (
        <tr key={`${caption}-${index}`}>
          {columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
);

const ChartCard = ({ title, subtitle, children, wide = false }) => (
  <section className={`dashboard-chart-card${wide ? ' dashboard-chart-card--wide' : ''}`}>
    <div className="dashboard-chart-header">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

const EmptyState = ({ message }) => (
  <div className="member-empty-state member-empty-state--compact">
    <span aria-hidden="true">◫</span>
    <p>{message}</p>
  </div>
);

const UserWorkspace = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [busy, setBusy] = useState('');
  const [interestCalc, setInterestCalc] = useState(null);
  const [interestToDate, setInterestToDate] = useState(today());
  const [automationStatus, setAutomationStatus] = useState(null);

  const [savingsForm, setSavingsForm] = useState({
    amount: '',
    paidOn: today(),
    weekStartDate: mondayFor(today()),
    note: '',
  });
  const [editingSavingsPaymentId, setEditingSavingsPaymentId] = useState(null);
  const [loanForm, setLoanForm] = useState({
    action: 'loan',
    amount: '',
    date: today(),
    note: '',
  });
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    withdrawalDate: today(),
    reason: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    note: '',
  });
  const [attendanceForm, setAttendanceForm] = useState({
    attendanceDate: today(),
    status: 'present',
    note: '',
  });
  const currentDate = new Date();
  const [fineForm, setFineForm] = useState({
    amount: '',
    month: String(currentDate.getMonth() + 1),
    year: String(currentDate.getFullYear()),
    paidOn: today(),
    note: '',
  });

  const fetchWorkspace = useCallback(async () => {
    try {
      setError('');
      const response = await api.get(`/admin/members/${userId}/workspace`);
      setWorkspace(response.data);
      api.get('/admin/interest-automation/status')
        .then((statusResponse) => setAutomationStatus(statusResponse.data))
        .catch(() => setAutomationStatus(null));
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Failed to load member workspace';
      setError(message);
      if (requestError.response?.status !== 404) toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    setWorkspace(null);
    setActiveTab('overview');
    setInterestCalc(null);
    fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    if (activeTab !== 'savings' || !workspace || !savingsForm.paidOn) return;

    const weekStartDate = mondayFor(savingsForm.paidOn);
    const payments = workspace.savingsPayments || [];
    const existingPayment = payments.find((payment) => (
      dateInputValue(payment.weekStartDate) === weekStartDate
    )) || payments.find((payment) => (
      mondayFor(dateInputValue(payment.paidOn)) === weekStartDate
    ));

    setEditingSavingsPaymentId(existingPayment?._id || null);
    setSavingsForm((current) => ({
      ...current,
      weekStartDate,
      amount: existingPayment ? String(existingPayment.amount) : '',
      note: existingPayment?.note || '',
    }));
  }, [activeTab, savingsForm.paidOn, workspace]);

  const runMutation = async (key, operation, successMessage) => {
    setBusy(key);
    try {
      await operation();
      toast.success(successMessage);
      await fetchWorkspace();
      return true;
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'The update could not be saved');
      return false;
    } finally {
      setBusy('');
    }
  };

  const submitSavings = async (event) => {
    event.preventDefault();
    const endpoint = editingSavingsPaymentId
      ? `/admin/savings/${userId}/payment/${editingSavingsPaymentId}`
      : `/admin/savings/${userId}/payment`;
    await runMutation(
      'savings',
      () => {
        const payload = {
          ...savingsForm,
          amount: Number(savingsForm.amount),
        };
        return editingSavingsPaymentId
          ? api.put(endpoint, payload)
          : api.post(endpoint, payload);
      },
      editingSavingsPaymentId ? 'Savings payment updated' : 'Savings payment recorded',
    );
  };

  const submitLoanTransaction = async (event) => {
    event.preventDefault();
    const transactionTypes = {
      loan: { type: 'loan' },
      principal_repayment: { type: 'repayment', paymentTarget: 'principal' },
      interest_repayment: { type: 'repayment', paymentTarget: 'interest' },
      fine: { type: 'fine' },
    };
    const saved = await runMutation(
      'loan',
      () => api.post(`/admin/loans/${userId}/transaction`, {
        ...transactionTypes[loanForm.action],
        amount: Number(loanForm.amount),
        date: loanForm.date,
        note: loanForm.note,
      }),
      'Loan transaction recorded',
    );
    if (saved) {
      setLoanForm((current) => ({ ...current, amount: '', note: '' }));
      setInterestCalc(null);
    }
  };

  const submitSavingsWithdrawal = async (event) => {
    event.preventDefault();
    const saved = await runMutation(
      'savings-withdrawal',
      () => api.post(`/admin/savings/${userId}/withdrawal`, {
        ...withdrawalForm,
        amount: Number(withdrawalForm.amount),
      }),
      'Savings withdrawal recorded',
    );
    if (saved) {
      setWithdrawalForm((current) => ({
        ...current,
        amount: '',
        reason: '',
        referenceNumber: '',
        note: '',
      }));
    }
  };

  const submitAttendance = async (event) => {
    event.preventDefault();
    const saved = await runMutation(
      'attendance',
      () => api.post('/admin/attendance', {
        attendanceDate: attendanceForm.attendanceDate,
        records: [{
          userId,
          status: attendanceForm.status,
          note: attendanceForm.note,
        }],
      }),
      'Attendance saved for this member',
    );
    if (saved) setAttendanceForm((current) => ({ ...current, note: '' }));
  };

  const submitFinePayment = async (event) => {
    event.preventDefault();
    const saved = await runMutation(
      'fine-payment',
      () => api.post('/admin/attendance/fine/payment', {
        userId,
        amount: Number(fineForm.amount),
        month: Number(fineForm.month),
        year: Number(fineForm.year),
        paidOn: fineForm.paidOn,
        note: fineForm.note,
      }),
      'Attendance fine payment recorded',
    );
    if (saved) setFineForm((current) => ({ ...current, amount: '', note: '' }));
  };

  const calculateInterest = async () => {
    setBusy('interest-calculate');
    try {
      const response = await api.get(`/admin/loans/${userId}/interest/calculate`, {
        params: { toDate: interestToDate },
      });
      setInterestCalc(response.data);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to calculate interest');
    } finally {
      setBusy('');
    }
  };

  const applyUnrecordedInterest = async () => {
    const saved = await runMutation(
      'interest-apply',
      () => api.post(`/admin/loans/${userId}/interest/apply-unrecorded`, {
        toDate: interestToDate,
      }),
      'Completed interest periods applied',
    );
    if (saved) {
      setInterestCalc(null);
      await calculateInterest();
    }
  };

  const recordInterestPeriod = async (period) => {
    const busyKey = `interest-${period.periodStart}`;
    setBusy(busyKey);
    let shouldRefresh = false;
    try {
      await api.post(`/admin/loans/${userId}/interest`, {
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        date: new Date(period.periodEnd).toISOString().slice(0, 10),
        note: `Interest for ${formatDate(period.periodStart)} to ${formatDate(period.periodEnd)}`,
      });
      toast.success('Interest period recorded');
      shouldRefresh = true;
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        toast.info('This interest period was already recorded. Refreshing the ledger.');
        shouldRefresh = true;
      } else {
        toast.error(requestError.response?.data?.message || 'The interest period could not be saved');
      }
    } finally {
      setBusy('');
    }

    if (shouldRefresh) {
      await fetchWorkspace();
      setInterestCalc(null);
      await calculateInterest();
    }
  };

  const confirmDelete = async ({ title, text, endpoint }) => {
    const result = await Swal.fire({
      title,
      text,
      input: 'text',
      inputLabel: 'Reason for deletion (optional)',
      inputPlaceholder: 'e.g. Entered in error',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete permanently',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#475569',
      background: '#0d1117',
      color: '#e4ecf8',
    });
    if (!result.isConfirmed) return;
    await runMutation(
      `delete-${endpoint}`,
      () => api.delete(endpoint, { data: { reason: result.value || '' } }),
      'Record deleted and balances recalculated',
    );
  };

  const loanChartHasData = useMemo(
    () => workspace?.charts.loanPrincipal.some((item) => item.value > 0),
    [workspace],
  );
  const attendanceChartHasData = useMemo(
    () => workspace?.charts.attendanceStatus.some((item) => item.value > 0),
    [workspace],
  );

  if (loading) return <div className="spinner" aria-label="Loading member workspace" />;
  if (!workspace) {
    return (
      <div className="card member-workspace-error">
        <h2>Member workspace unavailable</h2>
        <p>{error || 'This member could not be found.'}</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/find-user')}>
          ← Back to member directory
        </button>
      </div>
    );
  }

  const { user, summary, charts } = workspace;
  const savingsTransactions = [
    ...workspace.savingsPayments.map((payment) => ({
      ...payment,
      transactionType: 'deposit',
      transactionDate: payment.paidOn,
    })),
    ...(workspace.savingsWithdrawals || []).map((withdrawal) => ({
      ...withdrawal,
      transactionType: 'withdrawal',
      transactionDate: withdrawal.withdrawalDate,
    })),
  ].sort((left, right) => new Date(right.transactionDate) - new Date(left.transactionDate));

  return (
    <div>
      <header className="member-profile-header">
        <div className="member-profile-main">
          <Link to="/admin/find-user" className="member-back-link">← Member directory</Link>
          <div className="member-profile-identity">
            <span className="member-profile-avatar" aria-hidden="true">
              {user.name?.[0]?.toUpperCase() || 'M'}
            </span>
            <div>
              <h2>{user.name}</h2>
              <p>{user.email}</p>
            </div>
          </div>
        </div>
        <div className="member-profile-meta">
          <span>Member since</span>
          <strong>{formatDate(user.createdAt)}</strong>
        </div>
      </header>

      <div className="stat-grid member-workspace-kpis">
        <div className="stat-card">
          <div className="stat-title">Total Savings</div>
          <div className="stat-value member-value-positive">{money(summary.totalSavings)}</div>
          <div className="stat-sub">{money(summary.totalSavingsDeposited)} deposited · {money(summary.totalSavingsWithdrawn)} withdrawn</div>
        </div>
        <div className={`stat-card${summary.principalBalance > 0 ? ' member-unpaid-card' : ''}`}>
          <div className="stat-title">Principal Due</div>
          <div className={`stat-value${summary.principalBalance > 0 ? ' member-value-danger' : ''}`}>
            {money(summary.principalBalance)}
          </div>
          <div className="stat-sub">{money(summary.totalDisbursed)} distributed · {money(summary.totalPrincipalRepaid)} paid</div>
        </div>
        <div className={`stat-card${summary.interestBalance > 0 ? ' member-unpaid-card' : ''}`}>
          <div className="stat-title">Interest Due</div>
          <div className={`stat-value${summary.interestBalance > 0 ? ' member-value-danger' : ''}`}>
            {money(summary.interestBalance)}
          </div>
          <div className="stat-sub">{money(summary.totalInterestAccrued + summary.totalFines)} generated · {money(summary.totalInterestRepaid)} paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Present Rate</div>
          <div className="stat-value">{summary.attendanceRate.toFixed(1)}%</div>
          <div className="stat-sub">Across {summary.attendanceSessions} recorded sessions</div>
        </div>
        <div className={`stat-card${summary.fineBalance > 0 ? ' member-unpaid-card' : ''}`}>
          <div className="stat-title">Attendance Fine Due</div>
          <div className={`stat-value${summary.fineBalance > 0 ? ' member-value-danger' : ''}`}>
            {money(summary.fineBalance)}
          </div>
          <div className="stat-sub">{money(summary.fineOwed)} generated · {money(summary.finePaid)} paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Profit Allocated</div>
          <div className="stat-value member-value-profit">{money(summary.activeProfitAllocated)}</div>
          <div className="stat-sub">Active recorded allocations</div>
        </div>
      </div>

      <nav className="member-workspace-tabs" aria-label="Member workspace sections">
        {TABS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={activeTab === value ? 'active' : ''}
            aria-current={activeTab === value ? 'page' : undefined}
            onClick={() => setActiveTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <div className="dashboard-chart-grid member-overview-charts">
          <ChartCard
            title="Twelve-month financial activity"
            subtitle="Savings growth, loan disbursements, and all repayments for this member."
            wide
          >
            <div className="dashboard-chart" role="img" aria-label="Twelve-month chart of member savings, loans, and repayments">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={charts.monthlyFinancialActivity} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} accessibilityLayer>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compactMoney} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="loansDisbursed" name="Loans received" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="repayments" name="Repayments" fill={COLORS.sky} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="savingsWithdrawn" name="Savings withdrawn" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="savingsBalance" name="Savings balance" stroke={COLORS.emerald} strokeWidth={3} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <ScreenReaderTable
              caption="Member twelve-month financial activity data"
              columns={[
                { key: 'month', label: 'Month' },
                { key: 'savingsBalance', label: 'Savings balance' },
                { key: 'loansDisbursed', label: 'Loans received' },
                { key: 'repayments', label: 'Repayments' },
                { key: 'savingsWithdrawn', label: 'Savings withdrawn' },
              ]}
              rows={charts.monthlyFinancialActivity}
            />
          </ChartCard>

          <ChartCard
            title="Loan principal position"
            subtitle={`${money(summary.totalDisbursed)} distributed across all loans.`}
          >
            {loanChartHasData ? (
              <>
                <div className="dashboard-chart" role="img" aria-label="Donut chart showing member loan principal repaid and outstanding">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart accessibilityLayer>
                      <Pie data={charts.loanPrincipal} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="none">
                        <Cell fill={COLORS.emerald} />
                        <Cell fill={COLORS.rose} />
                      </Pie>
                      <Tooltip content={<MoneyTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ScreenReaderTable
                  caption="Member loan principal position data"
                  columns={[{ key: 'name', label: 'Status' }, { key: 'value', label: 'Amount' }]}
                  rows={charts.loanPrincipal}
                />
              </>
            ) : <EmptyState message="Loan activity will appear after the first disbursement." />}
          </ChartCard>

          <ChartCard
            title="Attendance status"
            subtitle="All recorded present, absent, late, and leave sessions."
          >
            {attendanceChartHasData ? (
              <>
                <div className="dashboard-chart" role="img" aria-label="Donut chart showing this member's attendance status distribution">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart accessibilityLayer>
                      <Pie data={charts.attendanceStatus} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={3} stroke="none">
                        {[COLORS.emerald, COLORS.rose, COLORS.amber, COLORS.sky].map((color) => <Cell key={color} fill={color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ScreenReaderTable
                  caption="Member attendance status data"
                  columns={[{ key: 'name', label: 'Status' }, { key: 'value', label: 'Sessions' }]}
                  rows={charts.attendanceStatus}
                />
              </>
            ) : <EmptyState message="Attendance data will appear after the first session is recorded." />}
          </ChartCard>

          <ChartCard
            title="Monthly attendance"
            subtitle="Status of recorded meetings during the last twelve calendar months."
            wide
          >
            <div className="dashboard-chart" role="img" aria-label="Stacked monthly attendance chart for this member">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={charts.monthlyAttendance} margin={{ top: 12, right: 8, left: -20, bottom: 0 }} accessibilityLayer>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="present" name="Present" stackId="attendance" fill={COLORS.emerald} />
                  <Bar dataKey="late" name="Late" stackId="attendance" fill={COLORS.amber} />
                  <Bar dataKey="leave" name="Leave" stackId="attendance" fill={COLORS.sky} />
                  <Bar dataKey="absent" name="Absent" stackId="attendance" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ScreenReaderTable
              caption="Member monthly attendance data"
              columns={[
                { key: 'month', label: 'Month' },
                { key: 'present', label: 'Present' },
                { key: 'absent', label: 'Absent' },
                { key: 'late', label: 'Late' },
                { key: 'leave', label: 'Leave' },
              ]}
              rows={charts.monthlyAttendance}
            />
          </ChartCard>
        </div>
      )}

      {activeTab === 'savings' && (
        <div className="member-workspace-split">
          <div className="member-tab-stack">
            <section className="card member-action-card">
            <div className="member-section-heading">
              <h3>{editingSavingsPaymentId ? 'Update savings' : 'Record savings'}</h3>
              <p>{editingSavingsPaymentId ? 'Update the saved payment for this week.' : 'Add this member\'s weekly savings payment.'}</p>
            </div>
            <form onSubmit={submitSavings}>
              <div className="input-group">
                <label className="input-label" htmlFor="member-saving-amount">Amount (₹) *</label>
                <input id="member-saving-amount" className="input-field" type="number" min="1" step="0.01" required value={savingsForm.amount} onChange={(event) => setSavingsForm({ ...savingsForm, amount: event.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="member-saving-date">Paid on *</label>
                <input id="member-saving-date" className="input-field" type="date" required value={savingsForm.paidOn} onChange={(event) => setSavingsForm({ ...savingsForm, paidOn: event.target.value, weekStartDate: mondayFor(event.target.value) })} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="member-saving-week">Week start date *</label>
                <input id="member-saving-week" className="input-field" type="date" required readOnly value={savingsForm.weekStartDate} />
                <p className="input-help">Automatically derived from Paid on to prevent duplicate weekly payments.</p>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="member-saving-note">Note</label>
                <input id="member-saving-note" className="input-field" value={savingsForm.note} onChange={(event) => setSavingsForm({ ...savingsForm, note: event.target.value })} placeholder="Optional payment details" />
              </div>
              <button className="btn btn-secondary member-form-submit" type="submit" disabled={busy === 'savings'}>
                {busy === 'savings' ? 'Saving…' : editingSavingsPaymentId ? 'Update savings payment' : 'Record savings payment'}
              </button>
            </form>
            </section>

            <section className="card member-action-card member-withdrawal-card">
              <div className="member-section-heading">
                <h3>Withdraw savings</h3>
                <p>Available balance: {money(summary.totalSavings)}. The withdrawal cannot exceed the balance available on its date.</p>
              </div>
              <form onSubmit={submitSavingsWithdrawal}>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-withdrawal-amount">Amount (₹) *</label>
                  <input id="member-withdrawal-amount" className="input-field" type="number" min="0.01" max={summary.totalSavings} step="0.01" required value={withdrawalForm.amount} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, amount: event.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-withdrawal-date">Withdrawal date *</label>
                  <input id="member-withdrawal-date" className="input-field" type="date" max={today()} required value={withdrawalForm.withdrawalDate} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, withdrawalDate: event.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-withdrawal-reason">Reason *</label>
                  <input id="member-withdrawal-reason" className="input-field" required maxLength="300" value={withdrawalForm.reason} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, reason: event.target.value })} placeholder="Why the member withdrew the money" />
                </div>
                <div className="member-form-row">
                  <div className="input-group">
                    <label className="input-label" htmlFor="member-withdrawal-method">Payment method *</label>
                    <select id="member-withdrawal-method" className="input-field" value={withdrawalForm.paymentMethod} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, paymentMethod: event.target.value })}>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="member-withdrawal-reference">Reference number</label>
                    <input id="member-withdrawal-reference" className="input-field" maxLength="100" value={withdrawalForm.referenceNumber} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, referenceNumber: event.target.value })} placeholder="Receipt / transfer ID" />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-withdrawal-note">Note</label>
                  <input id="member-withdrawal-note" className="input-field" maxLength="1000" value={withdrawalForm.note} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, note: event.target.value })} placeholder="Optional details" />
                </div>
                <button className="btn member-withdrawal-submit member-form-submit" type="submit" disabled={busy === 'savings-withdrawal' || summary.totalSavings <= 0}>
                  {busy === 'savings-withdrawal' ? 'Recording…' : 'Record withdrawal'}
                </button>
              </form>
            </section>
          </div>

          <section className="table-container member-history-panel">
            <div className="member-history-heading">
              <div>
                <h3>Complete savings ledger</h3>
                <p>{summary.savingsPayments} deposits · {summary.savingsWithdrawals} withdrawals · {money(summary.totalSavings)} balance</p>
              </div>
            </div>
            {savingsTransactions.length ? (
              <div className="table-scroll member-history-scroll">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Week / Method</th><th>Amount</th><th>Reason / Note</th><th>Recorded by</th><th /></tr></thead>
                  <tbody>
                    {savingsTransactions.map((transaction) => (
                      <tr key={`${transaction.transactionType}-${transaction._id}`}>
                        <td>{formatDate(transaction.transactionDate)}</td>
                        <td><span className={`member-activity-badge activity-savings${transaction.transactionType === 'withdrawal' ? '-withdrawal' : ''}`}>{titleCase(transaction.transactionType)}</span></td>
                        <td>{transaction.transactionType === 'deposit' ? formatDate(transaction.weekStartDate) : titleCase(transaction.paymentMethod)}</td>
                        <td className={transaction.transactionType === 'deposit' ? 'member-value-positive' : 'member-value-danger'}>{transaction.transactionType === 'withdrawal' ? '−' : '+'}{money(transaction.amount)}</td>
                        <td>{transaction.reason || transaction.note || '—'}{transaction.referenceNumber ? ` · ${transaction.referenceNumber}` : ''}</td>
                        <td>{transaction.recordedBy?.name || '—'}</td>
                        <td>
                          <button type="button" className="member-delete-button" onClick={() => confirmDelete({ title: `Delete savings ${transaction.transactionType}?`, text: `${money(transaction.amount)} recorded on ${formatDate(transaction.transactionDate)} will be permanently removed.`, endpoint: transaction.transactionType === 'deposit' ? `/admin/savings/${userId}/payment/${transaction._id}` : `/admin/savings/${userId}/withdrawal/${transaction._id}` })}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="No savings payments have been recorded for this member." />}
          </section>
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="member-tab-stack">
          <div className="member-action-grid">
            <section className="card member-action-card">
              <div className="member-section-heading">
                <h3>Add loan transaction</h3>
                <p>Disburse a loan, receive a repayment, or add a loan penalty.</p>
              </div>
              <form onSubmit={submitLoanTransaction}>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-loan-action">Transaction *</label>
                  <select id="member-loan-action" className="input-field" value={loanForm.action} onChange={(event) => setLoanForm({ ...loanForm, action: event.target.value })}>
                    <option value="loan">New loan disbursement</option>
                    <option value="principal_repayment">Principal repayment</option>
                    <option value="interest_repayment">Interest repayment</option>
                    <option value="fine">Loan fine / penalty</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-loan-amount">Amount (₹) *</label>
                  <input id="member-loan-amount" className="input-field" type="number" min="0.01" step="0.01" required value={loanForm.amount} onChange={(event) => setLoanForm({ ...loanForm, amount: event.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-loan-date">Transaction date *</label>
                  <input id="member-loan-date" className="input-field" type="date" required value={loanForm.date} onChange={(event) => setLoanForm({ ...loanForm, date: event.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-loan-note">Reason or note</label>
                  <input id="member-loan-note" className="input-field" value={loanForm.note} onChange={(event) => setLoanForm({ ...loanForm, note: event.target.value })} placeholder="Optional transaction details" />
                </div>
                <button className="btn btn-primary member-form-submit" type="submit" disabled={busy === 'loan'}>
                  {busy === 'loan' ? 'Recording…' : 'Record loan transaction'}
                </button>
              </form>
            </section>

            <section className="card member-action-card member-interest-card">
              <div className="member-section-heading">
                <h3>Calculate and record interest</h3>
                <p>Uses the existing 1% per completed 28-day period rule.</p>
              </div>
              {automationStatus && (
                <div className={`member-automation-status${automationStatus.enabled ? ' enabled' : ' disabled'}`}>
                  <span className="member-automation-dot" aria-hidden="true" />
                  <div>
                    <strong>Automatic interest {automationStatus.enabled ? 'enabled' : 'disabled'}</strong>
                    <p>
                      {automationStatus.enabled
                        ? `Startup catch-up ${automationStatus.runOnStartup ? 'on' : 'off'} · ${automationStatus.schedule} · ${automationStatus.timezone}`
                        : 'Manual calculation and application remain available.'}
                    </p>
                    {automationStatus.lastResult && (
                      <small>
                        Last run applied {automationStatus.lastResult.periodsApplied} period(s), {money(automationStatus.lastResult.totalApplied)}.
                      </small>
                    )}
                  </div>
                </div>
              )}
              <div className="member-inline-control">
                <input className="input-field" type="date" value={interestToDate} onChange={(event) => setInterestToDate(event.target.value)} aria-label="Calculate interest through date" />
                <button type="button" className="btn btn-secondary" onClick={calculateInterest} disabled={busy === 'interest-calculate'}>
                  {busy === 'interest-calculate' ? 'Calculating…' : 'Calculate'}
                </button>
              </div>
              {interestCalc ? (
                <div className="member-interest-results">
                  <div><span>Total to date</span><strong>{money(interestCalc.totalInterestToDate)}</strong></div>
                  <div><span>Already recorded</span><strong>{money(interestCalc.totalAlreadyRecorded)}</strong></div>
                  <div className={interestCalc.totalUnrecorded > 0 ? 'danger' : ''}><span>Due and unrecorded</span><strong>{money(interestCalc.totalUnrecorded)}</strong></div>
                  <div><span>Partial projection</span><strong>{money(interestCalc.projectedPartialInterest)}</strong></div>
                  <button type="button" className="btn btn-primary member-form-submit" disabled={interestCalc.totalUnrecorded <= 0 || busy === 'interest-apply'} onClick={applyUnrecordedInterest}>
                    {busy === 'interest-apply' ? 'Applying…' : 'Apply all completed periods'}
                  </button>
                </div>
              ) : (
                <p className="member-interest-hint">Choose a date and calculate to preview recorded, unrecorded, and projected interest.</p>
              )}
            </section>
          </div>

          <LoanClosurePanel
            userId={userId}
            outstandingBalance={summary.totalOutstanding}
            onClosed={async () => {
              setInterestCalc(null);
              await fetchWorkspace();
            }}
          />

          {interestCalc?.periods?.length > 0 && (
            <section className="table-container">
              <div className="member-history-heading"><div><h3>Interest periods</h3><p>Partial periods are projections and cannot be recorded.</p></div></div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Period</th><th>Days</th><th>Principal</th><th>Interest</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {interestCalc.periods.map((period) => (
                      <tr key={period.periodStart}>
                        <td>{formatDate(period.periodStart)} – {formatDate(period.periodEnd)}</td>
                        <td>{period.daysInPeriod}</td>
                        <td>{money(period.principalBalance)}</td>
                        <td>{money(period.interestAmount)}</td>
                        <td>
                          <span className={`member-status-badge ${period.alreadyRecorded ? 'status-present' : period.isPartial ? 'status-leave' : 'status-absent'}`}>
                            {period.alreadyRecorded ? 'Recorded' : period.isPartial ? 'Projection' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          {!period.alreadyRecorded && !period.isPartial && (
                            <button type="button" className="btn btn-primary member-small-button" disabled={busy === `interest-${period.periodStart}`} onClick={() => recordInterestPeriod(period)}>
                              Record
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="table-container">
            <div className="member-history-heading">
              <div><h3>Complete loan ledger</h3><p>{workspace.loanTransactions.length} transactions · {money(summary.totalOutstanding)} outstanding</p></div>
            </div>
            {workspace.loanTransactions.length ? (
              <div className="table-scroll member-history-scroll">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Recorded by</th><th>Note / period</th><th /></tr></thead>
                  <tbody>
                    {workspace.loanTransactions.map((transaction) => (
                      <tr key={transaction._id}>
                        <td>{formatDate(transaction.date)}</td>
                        <td><span className={`member-activity-badge activity-${transaction.type}`}>{titleCase(transaction.type)}{transaction.paymentTarget ? ` · ${titleCase(transaction.paymentTarget)}` : ''}</span></td>
                        <td className={transaction.type === 'repayment' || transaction.type === 'closure' ? 'member-value-positive' : transaction.type === 'interest' || transaction.type === 'fine' ? 'member-value-danger' : ''}>{money(transaction.amount)}</td>
                        <td>{transaction.entrySource === 'automatic' ? 'Automatic scheduler' : transaction.recordedBy?.name || 'Legacy / unknown'}</td>
                        <td>{transaction.type === 'closure' && transaction.closureDetails ? `Principal ${money(transaction.closureDetails.principalPaid)} · Interest ${money(transaction.closureDetails.interestPaid)}` : transaction.interestPeriod?.periodStart ? `${formatDate(transaction.interestPeriod.periodStart)} – ${formatDate(transaction.interestPeriod.periodEnd)}` : transaction.note || '—'}</td>
                        <td>
                          <button type="button" className="member-delete-button" onClick={() => confirmDelete({ title: 'Delete loan transaction?', text: `${titleCase(transaction.type)} of ${money(transaction.amount)} will be permanently removed and balances recalculated.`, endpoint: `/admin/loans/${userId}/transaction/${transaction._id}` })}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="No loan transactions have been recorded for this member." />}
          </section>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="member-tab-stack">
          <div className="member-action-grid">
            <section className="card member-action-card">
              <div className="member-section-heading"><h3>Mark or update attendance</h3><p>Saving another status in the same week updates that week&apos;s record.</p></div>
              <form onSubmit={submitAttendance}>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-attendance-date">Attendance date *</label>
                  <input id="member-attendance-date" className="input-field" type="date" required value={attendanceForm.attendanceDate} onChange={(event) => setAttendanceForm({ ...attendanceForm, attendanceDate: event.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-attendance-status">Status *</label>
                  <select id="member-attendance-status" className="input-field" value={attendanceForm.status} onChange={(event) => setAttendanceForm({ ...attendanceForm, status: event.target.value })}>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="leave">Leave</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-attendance-note">Note</label>
                  <input id="member-attendance-note" className="input-field" value={attendanceForm.note} onChange={(event) => setAttendanceForm({ ...attendanceForm, note: event.target.value })} placeholder="Optional attendance details" />
                </div>
                <button className="btn btn-primary member-form-submit" type="submit" disabled={busy === 'attendance'}>
                  {busy === 'attendance' ? 'Saving…' : 'Save attendance'}
                </button>
              </form>
            </section>

            <section className="card member-action-card">
              <div className="member-section-heading"><h3>Record attendance fine payment</h3><p>Current all-time fine balance: {money(summary.fineBalance)}</p></div>
              <form onSubmit={submitFinePayment}>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-fine-amount">Amount (₹) *</label>
                  <input id="member-fine-amount" className="input-field" type="number" min="1" step="0.01" required value={fineForm.amount} onChange={(event) => setFineForm({ ...fineForm, amount: event.target.value })} />
                </div>
                <div className="member-form-row">
                  <div className="input-group">
                    <label className="input-label" htmlFor="member-fine-month">Month *</label>
                    <select id="member-fine-month" className="input-field" value={fineForm.month} onChange={(event) => setFineForm({ ...fineForm, month: event.target.value })}>
                      {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index).toLocaleString('en-IN', { month: 'long' })}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="member-fine-year">Year *</label>
                    <input id="member-fine-year" className="input-field" type="number" min="2000" required value={fineForm.year} onChange={(event) => setFineForm({ ...fineForm, year: event.target.value })} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-fine-paid-on">Paid on *</label>
                  <input id="member-fine-paid-on" className="input-field" type="date" required value={fineForm.paidOn} onChange={(event) => setFineForm({ ...fineForm, paidOn: event.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="member-fine-note">Note</label>
                  <input id="member-fine-note" className="input-field" value={fineForm.note} onChange={(event) => setFineForm({ ...fineForm, note: event.target.value })} placeholder="Optional payment details" />
                </div>
                <button className="btn btn-secondary member-form-submit" type="submit" disabled={busy === 'fine-payment'}>
                  {busy === 'fine-payment' ? 'Recording…' : 'Record fine payment'}
                </button>
              </form>
            </section>
          </div>

          <section className="table-container">
            <div className="member-history-heading"><div><h3>Detailed attendance history</h3><p>Exact date and status for every recorded session.</p></div></div>
            {workspace.attendanceRecords.length ? (
              <div className="table-scroll member-history-scroll">
                <table className="data-table">
                  <thead><tr><th>Attendance date</th><th>Week start</th><th>Status</th><th>Marked by</th><th>Note</th></tr></thead>
                  <tbody>
                    {workspace.attendanceRecords.map((record) => (
                      <tr key={record._id}>
                        <td><strong>{formatDate(record.attendanceDate)}</strong></td>
                        <td>{formatDate(record.weekStartDate)}</td>
                        <td><span className={`member-status-badge status-${record.status}`}>{titleCase(record.status)}</span></td>
                        <td>{record.markedBy?.name || '—'}</td>
                        <td>{record.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="No attendance has been recorded for this member." />}
          </section>

          <section className="table-container">
            <div className="member-history-heading"><div><h3>Attendance fine payments</h3><p>{money(summary.finePaid)} paid against {money(summary.fineOwed)} generated.</p></div></div>
            {workspace.finePayments.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Paid on</th><th>For month</th><th>Amount</th><th>Recorded by</th><th>Note</th></tr></thead>
                  <tbody>
                    {workspace.finePayments.map((payment) => (
                      <tr key={payment._id}>
                        <td>{formatDate(payment.paidOn)}</td>
                        <td>{new Date(payment.year, payment.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</td>
                        <td className="member-value-positive">{money(payment.amount)}</td>
                        <td>{payment.recordedBy?.name || '—'}</td>
                        <td>{payment.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="No attendance fine payments have been recorded." />}
          </section>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="member-tab-stack">
          <section className="table-container">
            <div className="member-history-heading"><div><h3>All financial activity</h3><p>Savings, loan transactions, fine payments, and profit allocations in one timeline.</p></div></div>
            {workspace.activity.length ? (
              <div className="table-scroll member-history-scroll">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Category</th><th>Activity</th><th>Amount</th><th>Note</th></tr></thead>
                  <tbody>
                    {workspace.activity.map((item, index) => (
                      <tr key={`${item.category}-${item.id}-${index}`}>
                        <td>{formatDate(item.date)}</td>
                        <td><span className={`member-activity-badge activity-${item.category}`}>{titleCase(item.category)}</span></td>
                        <td>{titleCase(item.type)}</td>
                        <td>{money(item.amount)}</td>
                        <td>{item.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="No financial activity has been recorded for this member." />}
          </section>

          <section className="table-container">
            <div className="member-history-heading"><div><h3>Profit allocation history</h3><p>Allocations are shown separately and are not automatically added to savings.</p></div></div>
            {workspace.profitAllocations.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Distribution date</th><th>As of</th><th>Savings used</th><th>Share</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {workspace.profitAllocations.map((allocation) => (
                      <tr key={allocation.distributionId}>
                        <td>{formatDate(allocation.distributionDate)}</td>
                        <td>{formatDate(allocation.asOfDate)}</td>
                        <td>{money(allocation.savingsBalance)}</td>
                        <td>{allocation.sharePercent.toFixed(2)}%</td>
                        <td className={allocation.status === 'active' ? 'member-value-profit' : ''}>{money(allocation.amount)}</td>
                        <td><span className={`member-status-badge ${allocation.status === 'active' ? 'status-present' : 'status-absent'}`}>{titleCase(allocation.status)}{allocation.unallocationLocked ? ' · Locked' : ''}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="This member has no profit allocation history." />}
          </section>
        </div>
      )}
    </div>
  );
};

export default UserWorkspace;
