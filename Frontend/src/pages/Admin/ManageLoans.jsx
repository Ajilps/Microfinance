import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import moment from 'moment';
import { useForm } from 'react-hook-form';
import Pagination from '../../components/Pagination';

const ITEMS_PER_PAGE = 12;

const ManageLoans = () => {
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userLedger, setUserLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Interest calculator state
  const [interestCalc, setInterestCalc] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcToDate, setCalcToDate] = useState(moment().format('YYYY-MM-DD'));
  const [showCalcPanel, setShowCalcPanel] = useState(false);
  const [recordingPeriod, setRecordingPeriod] = useState(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const [txSubmitting, setTxSubmitting] = useState(false);

  const watchType = watch('type');

  // Pagination state
  const [overviewPage, setOverviewPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchLoansOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/loans');
      setLoans(response.data);
    } catch (error) {
      toast.error('Failed to load loans overview: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoansOverview();
    fetchUsers();
  }, [fetchLoansOverview, fetchUsers]);

  const fetchUserLedger = async (userId) => {
    setLedgerLoading(true);
    setSelectedUserId(userId);
    setUserLedger(null);
    setLedgerPage(1);
    setInterestCalc(null);
    setShowCalcPanel(false);
    try {
      const response = await api.get(`/admin/loans/${userId}`);
      setUserLedger(response.data);
    } catch (error) {
      toast.error('Failed to fetch user ledger: ' + (error.response?.data?.message || error.message));
      setSelectedUserId(null);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleCalculateInterest = async () => {
    setCalcLoading(true);
    try {
      const response = await api.get(`/admin/loans/${selectedUserId}/interest/calculate`, {
        params: { toDate: calcToDate },
      });
      setInterestCalc(response.data);
      setShowCalcPanel(true);
    } catch (error) {
      toast.error('Failed to calculate interest: ' + (error.response?.data?.message || error.message));
    } finally {
      setCalcLoading(false);
    }
  };

  const handleRecordInterestPeriod = async (period) => {
    const periodKey = period.periodStart.toString();
    setRecordingPeriod(periodKey);
    try {
      await api.post(`/admin/loans/${selectedUserId}/interest`, {
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        principalBalance: period.principalBalance,
        interestRate: period.interestRate,
        interestAmount: period.interestAmount,
        date: period.isPartial ? calcToDate : moment(period.periodEnd).format('YYYY-MM-DD'),
        note: `Interest: 1% of ₹${period.principalBalance.toFixed(2)} for ${moment(period.periodStart).format('MMM D')} – ${moment(period.periodEnd).format('MMM D, YYYY')}${period.isPartial ? ' (partial)' : ''}`,
      });
      toast.success('Interest period recorded successfully');
      // Refresh ledger and recalculate
      await fetchUserLedger(selectedUserId);
      await handleCalculateInterest();
    } catch (error) {
      // 409 = already recorded (idempotency guard fired) — refresh so UI reflects reality
      if (error.response?.status === 409) {
        toast.info('This period was already recorded — refreshing.');
        await fetchUserLedger(selectedUserId);
        await handleCalculateInterest();
      } else {
        toast.error(error.response?.data?.message || 'Failed to record interest period');
      }
    } finally {
      setRecordingPeriod(null);
    }
  };

  const [applyingUnrecorded, setApplyingUnrecorded] = useState(false);

  // Delete-transaction state
  const [deleteModal, setDeleteModal] = useState(null); // { tx } | null
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleApplyUnrecordedInterest = async () => {
    if (!interestCalc || interestCalc.totalUnrecorded <= 0 || applyingUnrecorded) return;
    setApplyingUnrecorded(true);

    // NOTE: we intentionally do NOT do an optimistic state update here.
    // The backend re-derives all unrecorded periods from the live ledger, so
    // the only safe way to refresh is to call handleCalculateInterest() after
    // the request completes. Any optimistic mutation risks showing stale data
    // if a concurrent request or navigation happens in between.
    try {
      const response = await api.post(
        `/admin/loans/${selectedUserId}/interest/apply-unrecorded`,
        { toDate: calcToDate }, // let backend re-derive the amount from live ledger
      );

      // Update the balance summary cards with server-authoritative values
      if (response.data && response.data.updatedInterestBalance !== undefined) {
        setUserLedger(prev => prev ? ({
          ...prev,
          summary: {
            ...prev.summary,
            interestBalance: response.data.updatedInterestBalance,
            totalInterestAccrued: response.data.updatedInterestAccrued ?? prev.summary.totalInterestAccrued,
            totalInterestRepaid: response.data.updatedInterestRepaid ?? prev.summary.totalInterestRepaid,
            totalOutstanding: response.data.updatedTotalOutstanding ?? prev.summary.totalOutstanding,
          },
        }) : null);
      }

      const periodsApplied = response.data?.periodsApplied ?? 0;
      if (periodsApplied === 0) {
        toast.info('No new unrecorded interest periods to apply.');
      } else {
        toast.success(`Applied ${periodsApplied} interest period${periodsApplied !== 1 ? 's' : ''} successfully`);
      }

      // Always re-fetch the ledger and recalculate so the UI is fully in sync
      await fetchUserLedger(selectedUserId);
      await handleCalculateInterest();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply unrecorded interest');
    } finally {
      setApplyingUnrecorded(false);
    }
  };

  const openDeleteModal = (tx) => {
    setDeleteModal({ tx });
    setDeleteReason('');
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModal(null);
    setDeleteReason('');
  };

  const handleDeleteTransaction = async () => {
    if (!deleteModal || deleting) return;
    const { tx } = deleteModal;
    setDeleting(true);
    try {
      const res = await api.delete(
        `/admin/loans/${selectedUserId}/transaction/${tx._id}`,
        { data: { reason: deleteReason.trim() } },
      );
      toast.success('Transaction deleted successfully');
      setDeleteModal(null);
      setDeleteReason('');
      // Update ledger summary optimistically with server-returned values
      if (res.data?.summaryAfter) {
        setUserLedger(prev => prev ? { ...prev, summary: res.data.summaryAfter } : null);
      }
      // Remove the tx from local transactions list without a full refetch
      setUserLedger(prev => {
        if (!prev) return null;
        return {
          ...prev,
          transactions: prev.transactions.filter(t => t._id !== tx._id),
        };
      });
      // Refresh overview row and recalculate interest if panel is open
      fetchLoansOverview();
      if (showCalcPanel) handleCalculateInterest();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  const handleTxSubmit = async (data) => {
    setTxSubmitting(true);
    try {
      const payload = {
        type: data.type,
        amount: parseFloat(data.amount),
        date: data.date,
        note: data.note || '',
      };

      if (data.type === 'repayment') {
        payload.paymentTarget = data.paymentTarget;
      }

      await api.post(`/admin/loans/${selectedUserId}/transaction`, payload);
      toast.success('Transaction recorded successfully');
      reset();
      fetchUserLedger(selectedUserId);
      fetchLoansOverview();
      // Refresh interest calc if panel is open
      if (showCalcPanel) {
        handleCalculateInterest();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add transaction');
    } finally {
      setTxSubmitting(false);
    }
  };

  const goBack = () => {
    setSelectedUserId(null);
    setUserLedger(null);
    setInterestCalc(null);
    setShowCalcPanel(false);
    setOverviewPage(1);
  };

  if (loading) return <div className="spinner"></div>;

  // Merge: show all users even those with no loan transactions
  const allMembers = users.map(u => {
    const loanRow = loans.find(l => String(l.userId) === String(u._id));
    return loanRow || {
      userId: u._id,
      name: u.name,
      email: u.email,
      totalDisbursed: 0,
      totalPrincipalRepaid: 0,
      totalInterestAccrued: 0,
      totalFines: 0,
      totalInterestRepaid: 0,
      principalBalance: 0,
      interestBalance: 0,
      totalOutstanding: 0,
    };
  });

  const paginatedMembers = allMembers.slice(
    (overviewPage - 1) * ITEMS_PER_PAGE,
    overviewPage * ITEMS_PER_PAGE
  );

  const transactions = userLedger?.transactions || [];
  const paginatedTx = transactions.slice(
    (ledgerPage - 1) * ITEMS_PER_PAGE,
    ledgerPage * ITEMS_PER_PAGE
  );

  const summary = userLedger?.summary;

  const txTypeBadge = (tx) => {
    const styles = {
      loan: { bg: '#fee2e2', color: '#991b1b', label: 'Loan' },
      repayment: {
        bg: tx.paymentTarget === 'interest' ? '#d1fae5' : '#dcfce7',
        color: tx.paymentTarget === 'interest' ? '#065f46' : '#166534',
        label: tx.paymentTarget === 'interest' ? 'Repayment (Interest)' : tx.paymentTarget === 'principal' ? 'Repayment (Principal)' : 'Repayment',
      },
      interest: { bg: '#fef3c7', color: '#92400e', label: 'Interest' },
      fine: { bg: '#e0e7ff', color: '#3730a3', label: 'Fine' },
    };
    const s = styles[tx.type] || { bg: '#f1f5f9', color: '#475569', label: tx.type };
    return (
      <span style={{
        padding: '0.2rem 0.6rem',
        borderRadius: '9999px',
        fontSize: '0.78rem',
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}>
        {s.label}
      </span>
    );
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h2>Manage Loans</h2>
        {selectedUserId && (
          <button className="btn btn-secondary" onClick={goBack}>
            ← Back to Overview
          </button>
        )}
      </div>

      {!selectedUserId ? (
        <>
          {allMembers.length === 0 ? (
            <div className="card">
              <p style={{ color: '#64748b' }}>No members found. Add users first via User Management.</p>
            </div>
          ) : (
            <div className="table-container">
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Principal Balance</th>
                      <th>Interest Balance</th>
                      <th>Total Outstanding</th>
                      <th>Total Disbursed</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMembers.map(member => (
                      <tr key={member.userId}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{member.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{member.email}</div>
                        </td>
                        <td style={{ color: (member.principalBalance || 0) > 0 ? 'var(--danger)' : '#10b981', fontWeight: 600 }}>
                          ₹{(member.principalBalance || 0).toFixed(2)}
                        </td>
                        <td style={{ color: (member.interestBalance || 0) > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                          ₹{(member.interestBalance || 0).toFixed(2)}
                        </td>
                        <td style={{ color: (member.totalOutstanding || 0) > 0 ? 'var(--danger)' : '#10b981', fontWeight: 700 }}>
                          ₹{(member.totalOutstanding || 0).toFixed(2)}
                        </td>
                        <td>₹{(member.totalDisbursed || 0).toFixed(2)}</td>
                        <td>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem' }}
                            onClick={() => fetchUserLedger(member.userId)}
                          >
                            View / Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={overviewPage}
                totalItems={allMembers.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setOverviewPage}
              />
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Ledger Section */}
          <div style={{ flex: 2, minWidth: '300px' }}>
            {ledgerLoading ? (
              <div className="spinner"></div>
            ) : userLedger ? (
              <>
                {/* ── Separated Balance Summary ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Principal Section */}
                  <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)', background: '#fff5f5' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Principal Balance
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: summary.principalBalance > 0 ? 'var(--danger)' : '#10b981' }}>
                      ₹{summary.principalBalance.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                      Disbursed: ₹{summary.totalDisbursed.toFixed(2)} · Repaid: ₹{summary.totalPrincipalRepaid.toFixed(2)}
                    </div>
                  </div>

                  {/* Interest Section */}
                  <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Interest Balance
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: summary.interestBalance > 0 ? '#d97706' : '#10b981' }}>
                      ₹{summary.interestBalance.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                      Accrued: ₹{summary.totalInterestAccrued.toFixed(2)} · Fines: ₹{summary.totalFines.toFixed(2)} · Paid: ₹{summary.totalInterestRepaid.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Total Outstanding */}
                <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', background: summary.totalOutstanding > 0 ? '#fef2f2' : '#f0fdf4', borderLeft: `4px solid ${summary.totalOutstanding > 0 ? 'var(--danger)' : '#10b981'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>Total Outstanding (Principal + Interest)</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: summary.totalOutstanding > 0 ? 'var(--danger)' : '#10b981' }}>
                      ₹{summary.totalOutstanding.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* ── Calculate Interest to Date Panel ── */}
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600, color: '#374151', flex: 1 }}>
                      📊 Calculate Interest to Date
                    </div>
                    <input
                      type="date"
                      className="input-field"
                      style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
                      value={calcToDate}
                      onChange={(e) => setCalcToDate(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 1.25rem', whiteSpace: 'nowrap' }}
                      onClick={handleCalculateInterest}
                      disabled={calcLoading}
                    >
                      {calcLoading ? 'Calculating...' : '🔢 Calculate Interest to Date'}
                    </button>
                  </div>

                  {showCalcPanel && interestCalc && (
                    <div style={{ marginTop: '1.25rem' }}>
                      {/* Summary row */}
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <div style={{ flex: 1, background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Interest to Date</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>₹{interestCalc.totalInterestToDate.toFixed(2)}</div>
                        </div>
                        <div style={{ flex: 1, background: '#f0fdf4', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Already Recorded</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>₹{interestCalc.totalAlreadyRecorded.toFixed(2)}</div>
                        </div>
                        <div style={{ flex: 1, background: '#fef3c7', borderRadius: '8px', padding: '0.75rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Unrecorded</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#92400e' }}>₹{interestCalc.totalUnrecorded.toFixed(2)}</div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            onClick={handleApplyUnrecordedInterest}
                            disabled={interestCalc.totalUnrecorded <= 0 || applyingUnrecorded}
                            aria-label="Apply unrecorded interest to loan balance"
                            title={interestCalc.totalUnrecorded <= 0 ? 'No unrecorded interest to apply' : 'Apply unrecorded interest to interest balance'}
                          >
                            {applyingUnrecorded ? 'Applying...' : 'Apply Interest'}
                          </button>
                        </div>
                      </div>

                      {/* Period breakdown table */}
                      {interestCalc.periods.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No interest periods found. Ensure a loan disbursement exists.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ background: '#72afecc7' }}>
                                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Period</th>
                                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Days</th>
                                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Principal</th>
                                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Rate</th>
                                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Interest</th>
                                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Status</th>
                                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {interestCalc.periods.map((period, idx) => (
                                <tr key={idx} style={{ background: period.alreadyRecorded ? '#616562' : period.isPartial ? '#fffbeb' : '#fff' }}>
                                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                                    {moment(period.periodStart).format('MMM D')} – {moment(period.periodEnd).format('MMM D, YYYY')}
                                    {period.isPartial && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>(partial)</span>}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{period.daysInPeriod}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 500 }}>₹{period.principalBalance.toFixed(2)}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{(period.interestRate * 100).toFixed(1)}%{period.isPartial ? '*' : ''}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#d97706' }}>₹{period.interestAmount.toFixed(2)}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                    {period.alreadyRecorded ? (
                                      <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.8rem' }}>✓ Recorded</span>
                                    ) : (
                                      <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.8rem' }}>Pending</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                    {!period.alreadyRecorded && (
                                      <button
                                        className="btn btn-primary"
                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.78rem' }}
                                        onClick={() => handleRecordInterestPeriod(period)}
                                        disabled={recordingPeriod === period.periodStart.toString()}
                                      >
                                        {recordingPeriod === period.periodStart.toString() ? '...' : 'Record'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {interestCalc.periods.some(p => p.isPartial) && (
                            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.5rem' }}>
                              * Partial period interest is pro-rated: (principal × 1% × days) ÷ 28
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Transaction Ledger ── */}
                <div className="table-container">
                  <h3 style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', margin: 0 }}>
                    Full Ledger — {userLedger.user.name}
                  </h3>
                  {transactions.length === 0 ? (
                    <p style={{ padding: '1.5rem', color: '#64748b' }}>No transactions yet. Add one using the form.</p>
                  ) : (
                    <>
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Amount</th>
                              <th>Recorded By</th>
                              <th>Note / Period</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTx.map(tx => (
                              <tr key={tx._id}>
                                <td>{moment(tx.date).format('MMM Do YYYY')}</td>
                                <td>{txTypeBadge(tx)}</td>
                                <td style={{ fontWeight: 600, color: tx.type === 'repayment' ? '#10b981' : tx.type === 'interest' ? '#d97706' : 'inherit' }}>
                                  {tx.type === 'repayment' ? '-' : '+'}₹{tx.amount.toFixed(2)}
                                </td>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{tx.recordedBy?.name || 'Auto'}</td>
                                <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                  {tx.type === 'interest' && tx.interestPeriod?.periodStart ? (
                                    <span>
                                      {moment(tx.interestPeriod.periodStart).format('MMM D')} – {moment(tx.interestPeriod.periodEnd).format('MMM D, YYYY')}
                                      {' '}@ {((tx.interestPeriod.interestRate || 0.01) * 100).toFixed(1)}% on ₹{(tx.interestPeriod.principalBalance || 0).toFixed(2)}
                                    </span>
                                  ) : (
                                    tx.note || '—'
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteModal(tx)}
                                    aria-label={`Delete transaction of ₹${tx.amount.toFixed(2)} on ${moment(tx.date).format('MMM Do YYYY')}`}
                                    style={{
                                      background: 'none',
                                      border: '1px solid #fca5a5',
                                      borderRadius: '6px',
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      padding: '0.25rem 0.6rem',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pagination
                        currentPage={ledgerPage}
                        totalItems={transactions.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setLedgerPage}
                      />
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="card"><p style={{ color: '#ef4444' }}>Could not load ledger. Please try again.</p></div>
            )}
          </div>

          {/* ── Add Transaction Form ── */}
          <div className="card" style={{ flex: 1, minWidth: '280px', alignSelf: 'flex-start' }}>
            <h3 className="mb-4">Add Transaction</h3>
            <form onSubmit={handleSubmit(handleTxSubmit)}>
              <div className="input-group">
                <label className="input-label">Transaction Type</label>
                <select className="input-field" {...register('type', { required: true })}>
                  <option value="">— Select Type —</option>
                  <option value="loan">New Loan (Disbursement)</option>
                  <option value="repayment">Repayment</option>
                  <option value="fine">Fine / Penalty</option>
                </select>
                {errors.type && <p className="error-text">Please select a type</p>}
              </div>

              {/* Payment Target — only shown for repayments */}
              {watchType === 'repayment' && (
                <div className="input-group">
                  <label className="input-label">Apply Payment To</label>
                  <select className="input-field" {...register('paymentTarget', { required: watchType === 'repayment' })}>
                    <option value="">— Select Target —</option>
                    <option value="interest">Interest Balance</option>
                    <option value="principal">Principal Balance</option>
                  </select>
                  {errors.paymentTarget && <p className="error-text">Please select where to apply this payment</p>}
                  <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                    {watch('paymentTarget') === 'interest'
                      ? '💡 This payment will reduce the outstanding interest balance.'
                      : watch('paymentTarget') === 'principal'
                        ? '💡 This payment will reduce the outstanding principal balance.'
                        : ''}
                  </p>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-field"
                  placeholder="0.00"
                  {...register('amount', { required: true, min: 0.01 })}
                />
                {errors.amount && <p className="error-text">Enter a valid amount</p>}
              </div>

              <div className="input-group">
                <label className="input-label">Date</label>
                <input
                  type="date"
                  className="input-field"
                  defaultValue={moment().format('YYYY-MM-DD')}
                  {...register('date', { required: true })}
                />
                {errors.date && <p className="error-text">Date is required</p>}
              </div>

              <div className="input-group">
                <label className="input-label">Note (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Initial loan disbursement"
                  {...register('note')}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={txSubmitting}>
                {txSubmitting ? 'Recording...' : 'Record Transaction'}
              </button>
            </form>

            {/* Info box */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
              <strong>ℹ️ Interest Policy</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
                <li>Interest is calculated on the <strong>principal balance only</strong></li>
                <li>Interest is <strong>never added</strong> to the principal</li>
                <li>Use <strong>"Calculate Interest to Date"</strong> to generate and record 4-week interest periods</li>
                <li>Repayments must specify whether they apply to <strong>interest</strong> or <strong>principal</strong></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Transaction Confirmation Modal ── */}
      {deleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '1.75rem',
            maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 id="delete-modal-title" style={{ margin: '0 0 0.25rem', color: '#dc2626', fontSize: '1.1rem' }}>
              Delete Transaction
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
              This action is permanent and cannot be undone. Balances will be recalculated automatically.
            </p>

            {/* Transaction summary */}
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem',
              fontSize: '0.88rem',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Type</span>
                <span style={{ fontWeight: 600 }}>{deleteModal.tx.type}{deleteModal.tx.paymentTarget ? ` (${deleteModal.tx.paymentTarget})` : ''}</span>
                <span style={{ color: '#64748b' }}>Amount</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>₹{deleteModal.tx.amount.toFixed(2)}</span>
                <span style={{ color: '#64748b' }}>Date</span>
                <span>{moment(deleteModal.tx.date).format('MMM Do YYYY')}</span>
                {deleteModal.tx.note && (
                  <>
                    <span style={{ color: '#64748b' }}>Note</span>
                    <span style={{ wordBreak: 'break-word' }}>{deleteModal.tx.note}</span>
                  </>
                )}
              </div>
            </div>

            {/* Optional reason */}
            <div className="input-group" style={{ marginBottom: '1.25rem' }}>
              <label className="input-label" htmlFor="delete-reason">Reason for deletion (optional)</label>
              <input
                id="delete-reason"
                type="text"
                className="input-field"
                placeholder="e.g. Entered in error"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                disabled={deleting}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTransaction}
                disabled={deleting}
                aria-label="Confirm permanent deletion of transaction"
                style={{
                  background: deleting ? '#fca5a5' : '#dc2626',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '0.55rem 1.25rem', fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageLoans;
