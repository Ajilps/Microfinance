import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

import Pagination from '../../components/Pagination';
import api from '../../services/api';

const ITEMS_PER_PAGE = 12;
const PROFIT_DISTRIBUTION_ENABLED =
  import.meta.env.VITE_ENABLE_PROFIT_DISTRIBUTION === 'true';
const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const ProfitDistribution = () => {
  const [asOfDate, setAsOfDate] = useState(moment().format('YYYY-MM-DD'));
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [distributionAmount, setDistributionAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [unallocatingId, setUnallocatingId] = useState(null);
  const [lockingId, setLockingId] = useState(null);
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await api.get('/admin/finance/profit/distributions');
      setHistory(response.data || []);
      setHistoryPage(1);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to load profit distributions',
      );
    }
  }, []);

  const fetchOverview = useCallback(
    async (amount) => {
      setLoading(true);
      try {
        const response = await api.get('/admin/finance/profit', {
          params: {
            asOfDate,
            ...(amount !== undefined ? { amount } : {}),
          },
        });
        setOverview(response.data);
        setDistributionAmount(String(response.data.distributionAmount ?? 0));
        setPage(1);
      } catch (error) {
        setOverview(null);
        toast.error(
          error.response?.data?.message || 'Failed to calculate profit',
        );
      } finally {
        setLoading(false);
      }
    },
    [asOfDate],
  );

  useEffect(() => {
    fetchOverview();
    fetchHistory();
  }, [fetchHistory, fetchOverview]);

  const calculateShares = async () => {
    const amount = Number(distributionAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.warn('Enter a valid distribution amount');
      return;
    }
    setCalculating(true);
    await fetchOverview(amount);
    setCalculating(false);
  };

  const recordDistribution = async () => {
    if (!PROFIT_DISTRIBUTION_ENABLED) return;

    const amount = Number(overview?.distributionAmount || 0);
    if (amount <= 0 || !overview?.allocations?.length) {
      toast.warn('Calculate a positive allocation before recording it');
      return;
    }

    const result = await Swal.fire({
      title: 'Record profit distribution?',
      html: `<strong>${money(amount)}</strong> will be recorded for ${overview.allocations.length} members based on savings of ${money(overview.totalSavings)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Record Distribution',
      confirmButtonColor: '#10b981',
      background: '#111827',
      color: '#f8fafc',
    });
    if (!result.isConfirmed) return;

    setRecording(true);
    try {
      await api.post('/admin/finance/profit/distributions', {
        asOfDate,
        amount,
      });
      toast.success('Profit distribution recorded');
      await Promise.all([fetchOverview(), fetchHistory()]);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to record profit distribution',
      );
    } finally {
      setRecording(false);
    }
  };

  const unallocateDistribution = async (distribution) => {
    const result = await Swal.fire({
      title: 'Un-allocate this profit distribution?',
      html: `<strong>${money(distribution.amount)}</strong> will be restored to the available profit balance. The original allocation will remain in history as reversed.`,
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Reason (optional)',
      inputPlaceholder: 'Why is this allocation being reversed?',
      inputAttributes: { maxlength: '1000' },
      showCancelButton: true,
      confirmButtonText: 'Un-allocate',
      confirmButtonColor: '#f43f5e',
      background: '#111827',
      color: '#f8fafc',
      preConfirm: (value) => {
        if ((value || '').trim().length > 1000) {
          Swal.showValidationMessage('Reason cannot exceed 1000 characters');
          return false;
        }
        return (value || '').trim();
      },
    });
    if (!result.isConfirmed) return;

    setUnallocatingId(distribution._id);
    try {
      await api.patch(
        `/admin/finance/profit/distributions/${distribution._id}/unallocate`,
        { reason: result.value || '' },
      );
      toast.success('Profit allocation reversed');
      await Promise.all([fetchOverview(), fetchHistory()]);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to un-allocate profit',
      );
    } finally {
      setUnallocatingId(null);
    }
  };

  const lockUnallocation = async (distribution) => {
    const result = await Swal.fire({
      title: 'Disable un-allocation permanently?',
      html: `<strong>${money(distribution.amount)}</strong> will remain distributed and deducted from available profit. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Disable Un-allocation',
      confirmButtonColor: '#f59e0b',
      background: '#111827',
      color: '#f8fafc',
    });
    if (!result.isConfirmed) return;

    setLockingId(distribution._id);
    try {
      await api.patch(
        `/admin/finance/profit/distributions/${distribution._id}/lock-unallocate`,
      );
      toast.success('Un-allocation permanently disabled');
      await fetchHistory();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to disable un-allocation',
      );
    } finally {
      setLockingId(null);
    }
  };

  const summary = overview?.summary || {};
  const allocations = overview?.allocations || [];
  const paginatedAllocations = allocations.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const paginatedHistory = history.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE,
  );

  const activityCards = [
    ['Total Loan Distributed', summary.totalLoanDistributed, 'Includes open and fully closed loans'],
    ['Total Return', summary.totalReturn, 'Principal and interest collected'],
    ['Total Principal Paid', summary.totalPrincipalPaid, 'Capital returned by members'],
    ['Total Interest Generated', summary.totalInterestGenerated, 'Paid and unpaid interest'],
    ['Total Interest Paid', summary.totalInterestPaid, 'Interest actually collected'],
    ['Total Unpaid Loan', summary.totalUnpaidLoan, 'Outstanding principal', true],
    ['Unpaid Interest', summary.unpaidInterest, 'Generated interest not yet collected', true],
    ['Loan Fines Generated', summary.loanFinesGenerated, 'Accrued loan penalty revenue'],
    ['Attendance Fines Paid', summary.attendanceFineIncome, 'Attendance fine cash collected'],
    ['Other Income', summary.otherIncome, 'Additional income entries'],
    ['Other Expenses', summary.otherExpenses, 'Additional expense entries'],
  ];

  return (
    <div>
      <div className="page-header flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2>Profit & Distribution</h2>
          <p>Review profit through a selected date and allocate collected profit by member savings.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="profit-as-of-date">Totals Till Date</label>
            <input
              id="profit-as-of-date"
              type="date"
              className="input-field"
              max={moment().format('YYYY-MM-DD')}
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => fetchOverview()}>
            ↻ Refresh Totals
          </button>
        </div>
      </div>

      {loading && !overview ? (
        <div className="spinner" />
      ) : !overview ? null : (
        <>
          <div className="stat-grid">
            {activityCards.map(([label, value, description, isUnpaid = false]) => (
              <div
                className="stat-card"
                key={label}
                style={
                  isUnpaid
                    ? {
                        borderColor: 'rgba(251, 113, 133, 0.5)',
                        background: 'rgba(244, 63, 94, 0.08)',
                      }
                    : undefined
                }
              >
                <div className="stat-title">{label}</div>
                <div
                  className="stat-value"
                  style={isUnpaid ? { color: 'var(--rose-400)' } : undefined}
                >
                  {money(value)}
                </div>
                <div className="stat-sub">{description}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              margin: '1.5rem 0',
            }}
          >
            <div className="card" style={{ margin: 0, borderColor: 'rgba(56, 189, 248, 0.35)' }}>
              <div className="stat-title">Revenue</div>
              <div className="stat-value" style={{ color: 'var(--sky-400)' }}>{money(summary.revenue)}</div>
              <div className="stat-sub">Interest, fines, and other income</div>
            </div>
            <div className="card" style={{ margin: 0, borderColor: 'rgba(251, 113, 133, 0.35)' }}>
              <div className="stat-title">Expenses</div>
              <div className="stat-value" style={{ color: 'var(--rose-400)' }}>{money(summary.expenses)}</div>
              <div className="stat-sub">Other business expenses</div>
            </div>
            <div className="card" style={{ margin: 0, borderColor: 'rgba(52, 211, 153, 0.35)' }}>
              <div className="stat-title">Accrued Profit</div>
              <div className="stat-value" style={{ color: summary.accruedProfit >= 0 ? 'var(--emerald-400)' : 'var(--rose-400)' }}>
                {money(summary.accruedProfit)}
              </div>
              <div className="stat-sub">Includes unpaid interest</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ marginBottom: '0.25rem' }}>Cash Available for Distribution</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  Only collected interest and other cash income are distributable.
                </p>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--emerald-400)' }}>
                {money(summary.availableToDistribute)}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <div className="stat-title">Cash Profit</div>
                <strong>{money(summary.cashProfit)}</strong>
              </div>
              <div>
                <div className="stat-title">Previously Distributed</div>
                <strong>{money(summary.previouslyDistributed)}</strong>
              </div>
              <div>
                <div className="stat-title">Savings Used for Ratio</div>
                <strong>{money(overview.totalSavings)}</strong>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ marginBottom: '0.25rem' }}>Member Profit Allocation</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  Each share equals the member’s savings divided by total member savings.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'end', flexWrap: 'wrap' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" htmlFor="profit-distribution-amount">
                    Amount to Distribute
                  </label>
                  <input
                    id="profit-distribution-amount"
                    type="number"
                    min="0"
                    max={summary.availableToDistribute}
                    step="0.01"
                    className="input-field"
                    value={distributionAmount}
                    onChange={(event) => setDistributionAmount(event.target.value)}
                  />
                </div>
                <button className="btn btn-secondary" onClick={calculateShares} disabled={calculating}>
                  {calculating ? 'Calculating...' : 'Calculate Shares'}
                </button>
              </div>
            </div>

            {allocations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">%</div>
                <div className="empty-state__text">
                  Enter a positive amount and calculate shares to preview member allocations.
                </div>
              </div>
            ) : (
              <>
                <div className="table-scroll report-table-scroll" tabIndex="0" aria-label="Scrollable member profit allocations">
                  <table className="data-table" style={{ minWidth: '760px' }}>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Savings Balance</th>
                        <th>Share</th>
                        <th>Profit Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAllocations.map((allocation) => (
                        <tr key={allocation.userId}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{allocation.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{allocation.email}</div>
                          </td>
                          <td>{money(allocation.savingsBalance)}</td>
                          <td>{Number(allocation.sharePercent).toFixed(2)}%</td>
                          <td style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>
                            {money(allocation.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={page}
                  totalItems={allocations.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setPage}
                />
                <div style={{ textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={recordDistribution}
                    disabled={!PROFIT_DISTRIBUTION_ENABLED || recording}
                    title={
                      PROFIT_DISTRIBUTION_ENABLED
                        ? 'Record this profit distribution'
                        : 'Profit distribution recording is currently disabled'
                    }
                  >
                    {recording
                      ? 'Recording...'
                      : `Distribute ${money(overview.distributionAmount)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '0.25rem' }}>Distribution History</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Recorded payouts are retained as snapshots of member savings and shares.
        </p>
        {history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No profit distributions recorded yet.</p>
        ) : (
          <>
            <div className="table-scroll report-table-scroll" tabIndex="0" aria-label="Scrollable profit distribution history">
              <table className="data-table" style={{ minWidth: '1050px' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Total Savings</th>
                    <th>Members</th>
                    <th>Recorded By</th>
                    <th>Details</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((distribution) => {
                    const isReversed = distribution.status === 'reversed';
                    const isLocked = distribution.unallocationLocked === true;
                    return (
                      <tr key={distribution._id} style={isReversed ? { opacity: 0.72 } : undefined}>
                        <td>{moment.utc(distribution.distributionDate).format('DD MMM YYYY')}</td>
                        <td
                          style={{
                            fontWeight: 800,
                            color: isReversed ? 'var(--text-muted)' : 'var(--emerald-400)',
                            textDecoration: isReversed ? 'line-through' : 'none',
                          }}
                        >
                          {money(distribution.amount)}
                        </td>
                        <td>
                          <span className={`badge ${isReversed ? 'badge-danger' : isLocked ? 'badge-warning' : 'badge-success'}`}>
                            {isReversed ? 'Un-allocated' : isLocked ? 'Active · Locked' : 'Active'}
                          </span>
                        </td>
                        <td>{money(distribution.totalSavings)}</td>
                        <td>{distribution.allocations?.length || 0}</td>
                        <td>{distribution.recordedBy?.name || 'Unknown'}</td>
                        <td>
                          <button
                            className="btn btn-ghost"
                            onClick={() =>
                              setExpandedHistoryId((current) =>
                                current === distribution._id ? null : distribution._id,
                              )
                            }
                          >
                            {expandedHistoryId === distribution._id ? 'Hide' : 'View'}
                          </button>
                          {expandedHistoryId === distribution._id && (
                            <div style={{ marginTop: '0.65rem', minWidth: '240px' }}>
                              {distribution.allocations.map((allocation) => (
                                <div key={String(allocation.user)} className="flex-between" style={{ gap: '1rem', padding: '0.25rem 0' }}>
                                  <span>{allocation.name}</span>
                                  <strong>{money(allocation.amount)}</strong>
                                </div>
                              ))}
                              {isReversed && (
                                <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.65rem', color: 'var(--rose-400)' }}>
                                  <strong>Un-allocated by {distribution.reversedBy?.name || 'Unknown admin'}</strong>
                                  {distribution.reversedAt && (
                                    <div>{moment(distribution.reversedAt).format('DD MMM YYYY, hh:mm A')}</div>
                                  )}
                                  {distribution.reversalReason && <div>{distribution.reversalReason}</div>}
                                </div>
                              )}
                              {isLocked && (
                                <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.65rem', color: 'var(--amber-400)' }}>
                                  <strong>Un-allocation disabled by {distribution.unallocationLockedBy?.name || 'Unknown admin'}</strong>
                                  {distribution.unallocationLockedAt && (
                                    <div>{moment(distribution.unallocationLockedAt).format('DD MMM YYYY, hh:mm A')}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {isReversed || isLocked ? (
                            <button
                              className="btn btn-danger"
                              disabled
                              title={isReversed ? 'This distribution was un-allocated' : 'Un-allocation is permanently disabled'}
                            >
                              {isReversed ? 'Un-allocated' : 'Un-allocate Disabled'}
                            </button>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-danger"
                                onClick={() => unallocateDistribution(distribution)}
                                disabled={unallocatingId === distribution._id || lockingId === distribution._id}
                              >
                                {unallocatingId === distribution._id ? 'Un-allocating...' : 'Un-allocate'}
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => lockUnallocation(distribution)}
                                disabled={lockingId === distribution._id || unallocatingId === distribution._id}
                                title="Permanently disable un-allocation after the payout is confirmed"
                              >
                                {lockingId === distribution._id ? 'Disabling...' : 'Disable Un-allocate'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={historyPage}
              totalItems={history.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setHistoryPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ProfitDistribution;
