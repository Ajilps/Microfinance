import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

import api from '../../services/api';

const COLORS = {
  indigo: '#818cf8',
  emerald: '#34d399',
  sky: '#38bdf8',
  rose: '#fb7185',
  amber: '#fbbf24',
  violet: '#a78bfa',
  muted: '#64748b',
  grid: 'rgba(148, 163, 184, 0.13)',
};

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const compactMoney = (value) =>
  `₹${new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))}`;

const DashboardTooltip = ({ active, payload, label }) => {
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

const ChartCard = ({ title, subtitle, children, className = '' }) => (
  <section className={`dashboard-chart-card ${className}`}>
    <div className="dashboard-chart-header">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

const EmptyChart = ({ message }) => (
  <div className="dashboard-chart-empty">
    <span aria-hidden="true">◫</span>
    <p>{message}</p>
  </div>
);

const AdminDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/admin/dashboard/overview');
        setDashboard(response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || 'Failed to load dashboard analytics',
        );
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div className="spinner" />;
  if (!dashboard) {
    return <div className="alert alert-error">{error || 'Dashboard data is unavailable.'}</div>;
  }

  const {
    summary,
    monthlyActivity = [],
    loanComposition = [],
    attendanceTrend = [],
    bankTrend = [],
    topSavers = [],
    recentMembers = [],
  } = dashboard;
  const hasLoanComposition = loanComposition.some((item) => item.value > 0);
  const hasBankActivity = bankTrend.some(
    (item) => item.deposits || item.withdrawals || item.balance,
  );
  const principalTotal = loanComposition.reduce((sum, item) => sum + item.value, 0);
  const outstandingShare = principalTotal
    ? ((summary.principalOutstanding / principalTotal) * 100).toFixed(1)
    : '0.0';

  const kpis = [
    {
      label: 'Members',
      value: summary.memberCount,
      detail: `${summary.latestAttendanceRate.toFixed(1)}% present in latest session`,
      color: 'var(--indigo-400)',
    },
    {
      label: 'Savings Pool',
      value: money(summary.totalSavings),
      detail: `${summary.savingsCoverage.toFixed(1)}% of outstanding principal`,
      color: 'var(--emerald-400)',
    },
    {
      label: 'Principal Outstanding',
      value: money(summary.principalOutstanding),
      detail: `${summary.principalCollectionRate.toFixed(1)}% principal collected`,
      color: 'var(--rose-400)',
      alert: summary.principalOutstanding > 0,
    },
    {
      label: 'Unpaid Interest',
      value: money(summary.unpaidInterest),
      detail: `${money(summary.interestCollected)} interest collected`,
      color: 'var(--rose-400)',
      alert: summary.unpaidInterest > 0,
    },
    {
      label: 'Bank Balance',
      value: money(summary.bankBalance),
      detail: 'From the bank transaction ledger',
      color: summary.bankBalance >= 0 ? 'var(--sky-400)' : 'var(--rose-400)',
      alert: summary.bankBalance < 0,
    },
    {
      label: 'Profit Available',
      value: money(summary.availableProfit),
      detail: 'Collected cash profit not yet distributed',
      color: 'var(--amber-400)',
    },
  ];

  return (
    <div>
      <div className="page-header flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2>Admin Dashboard</h2>
          <p>Portfolio health, cash movement, attendance, and member savings at a glance.</p>
        </div>
        <div className="dashboard-updated">
          Updated {new Date(dashboard.generatedAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid dashboard-kpi-grid">
        {kpis.map((kpi) => (
          <div
            className="stat-card"
            key={kpi.label}
            style={kpi.alert ? { borderColor: 'rgba(251, 113, 133, 0.38)' } : undefined}
          >
            <div className="stat-title">{kpi.label}</div>
            <div className="stat-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="stat-sub">{kpi.detail}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-chart-grid">
        <ChartCard
          title="Six-month fund activity"
          subtitle="Savings deposited and withdrawn, loans issued, and repayments collected by month."
          className="dashboard-chart-card--wide"
        >
          <div className="dashboard-chart" role="img" aria-label="Grouped bar chart of monthly savings, loan disbursements, and repayments">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={monthlyActivity} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} accessibilityLayer>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compactMoney} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
                <Tooltip content={<DashboardTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Bar dataKey="savingsDeposits" name="Savings deposits" fill={COLORS.emerald} radius={[5, 5, 0, 0]} />
                <Bar dataKey="savingsWithdrawals" name="Savings withdrawals" fill={COLORS.rose} radius={[5, 5, 0, 0]} />
                <Bar dataKey="loansDisbursed" name="Loans issued" fill={COLORS.rose} radius={[5, 5, 0, 0]} />
                <Bar dataKey="repayments" name="Repayments" fill={COLORS.sky} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ScreenReaderTable
            caption="Six-month fund activity data"
            columns={[
              { key: 'month', label: 'Month' },
              { key: 'savingsDeposits', label: 'Savings deposits' },
              { key: 'savingsWithdrawals', label: 'Savings withdrawals' },
              { key: 'loansDisbursed', label: 'Loans issued' },
              { key: 'repayments', label: 'Repayments' },
            ]}
            rows={monthlyActivity}
          />
        </ChartCard>

        <ChartCard
          title="Loan principal position"
          subtitle={`${outstandingShare}% of distributed principal remains outstanding.`}
        >
          {hasLoanComposition ? (
            <>
              <div className="dashboard-chart" role="img" aria-label="Donut chart showing repaid and outstanding loan principal">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart accessibilityLayer>
                    <Pie
                      data={loanComposition}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      <Cell fill={COLORS.emerald} />
                      <Cell fill={COLORS.rose} />
                    </Pie>
                    <Tooltip content={<DashboardTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ScreenReaderTable
                caption="Loan principal position data"
                columns={[
                  { key: 'name', label: 'Status' },
                  { key: 'value', label: 'Amount' },
                ]}
                rows={loanComposition}
              />
            </>
          ) : <EmptyChart message="Loan activity will appear here after the first disbursement." />}
        </ChartCard>

        <ChartCard
          title="Largest savings balances"
          subtitle="Top six members by cumulative recorded savings."
        >
          {topSavers.length ? (
            <>
              <div className="dashboard-chart" role="img" aria-label="Horizontal bar chart of the six largest member savings balances">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={topSavers} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                    <XAxis type="number" tickFormatter={compactMoney} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={88} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DashboardTooltip />} />
                    <Bar dataKey="amount" name="Savings" fill={COLORS.indigo} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ScreenReaderTable
                caption="Largest member savings balances"
                columns={[
                  { key: 'name', label: 'Member' },
                  { key: 'amount', label: 'Savings' },
                ]}
                rows={topSavers}
              />
            </>
          ) : <EmptyChart message="Member savings will appear here after deposits are recorded." />}
        </ChartCard>

        <ChartCard
          title="Recent attendance sessions"
          subtitle="Present, absent, late, and leave counts for the latest eight recorded weeks."
        >
          {attendanceTrend.length ? (
            <>
              <div className="dashboard-chart" role="img" aria-label="Stacked bar chart of recent attendance statuses">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={attendanceTrend} margin={{ top: 12, right: 8, left: -20, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid stroke={COLORS.grid} vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Bar dataKey="present" name="Present" stackId="attendance" fill={COLORS.emerald} />
                    <Bar dataKey="late" name="Late" stackId="attendance" fill={COLORS.amber} />
                    <Bar dataKey="leave" name="Leave" stackId="attendance" fill={COLORS.sky} />
                    <Bar dataKey="absent" name="Absent" stackId="attendance" fill={COLORS.rose} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ScreenReaderTable
                caption="Recent attendance session data"
                columns={[
                  { key: 'week', label: 'Week' },
                  { key: 'present', label: 'Present' },
                  { key: 'absent', label: 'Absent' },
                  { key: 'late', label: 'Late' },
                  { key: 'leave', label: 'Leave' },
                ]}
                rows={attendanceTrend}
              />
            </>
          ) : <EmptyChart message="Attendance trends will appear after attendance is recorded." />}
        </ChartCard>

        <ChartCard
          title="Bank balance movement"
          subtitle="Monthly deposits, withdrawals, and closing ledger balance."
        >
          {hasBankActivity ? (
            <>
              <div className="dashboard-chart" role="img" aria-label="Combined chart of monthly bank deposits, withdrawals, and closing balance">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={bankTrend} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid stroke={COLORS.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={compactMoney} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
                    <Tooltip content={<DashboardTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Bar dataKey="deposits" name="Deposits" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="withdrawals" name="Withdrawals" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="balance" name="Closing balance" stroke={COLORS.amber} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <ScreenReaderTable
                caption="Bank balance movement data"
                columns={[
                  { key: 'month', label: 'Month' },
                  { key: 'deposits', label: 'Deposits' },
                  { key: 'withdrawals', label: 'Withdrawals' },
                  { key: 'balance', label: 'Closing balance' },
                ]}
                rows={bankTrend}
              />
            </>
          ) : <EmptyChart message="Bank trends will appear after bank transactions are recorded." />}
        </ChartCard>
      </div>

      <section className="card dashboard-actions">
        <div>
          <h3>Quick actions</h3>
          <p>Jump directly to the most common weekly administration tasks.</p>
        </div>
        <div className="dashboard-action-grid">
          <Link to="/admin/find-user" className="btn btn-primary">⌕ Find by User</Link>
          <Link to="/admin/loans" className="btn btn-primary">💳 Manage Loans</Link>
          <Link to="/admin/savings" className="btn btn-secondary">🏦 Record Savings</Link>
          <Link to="/admin/attendance" className="btn btn-primary">📋 Mark Attendance</Link>
          <Link to="/admin/bank-transactions" className="btn btn-ghost">🏛️ Bank Ledger</Link>
        </div>
      </section>

      {recentMembers.length > 0 && (
        <section className="table-container dashboard-recent-members">
          <div className="dashboard-table-heading">
            <div>
              <h3>Recently added members</h3>
              <p>The five newest registered members.</p>
            </div>
            <Link to="/admin/users" className="btn btn-ghost">View all members</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentMembers.map((user) => (
                <tr key={user._id}>
                  <td style={{ fontWeight: 700 }}>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

export default AdminDashboard;
