import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import moment from 'moment';
import { useForm } from 'react-hook-form';
import Pagination from '../../components/Pagination';

const ITEMS_PER_PAGE = 12;

const ManageSavings = () => {
  const [users, setUsers] = useState([]);
  const [savingsOverview, setSavingsOverview] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [userSavingsDetail, setUserSavingsDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);

  const { register, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm({
    defaultValues: {
      paidOn: moment().format('YYYY-MM-DD'),
      weekStartDate: moment().startOf('isoWeek').format('YYYY-MM-DD'),
    }
  });
  const loadPaymentForDate = (paidOn, detail = userSavingsDetail) => {
    const paymentDate = moment(paidOn, 'YYYY-MM-DD', true);
    if (!paymentDate.isValid()) return;

    const weekStartDate = paymentDate.startOf('isoWeek').format('YYYY-MM-DD');
    const payments = detail?.payments || [];
    const existingPayment = payments.find(payment => (
      moment(payment.weekStartDate).format('YYYY-MM-DD') === weekStartDate
    )) || payments.find(payment => (
      moment(payment.paidOn).startOf('isoWeek').format('YYYY-MM-DD') === weekStartDate
    ));

    setValue('weekStartDate', weekStartDate, {
      shouldValidate: true,
    });
    setValue('amount', existingPayment ? String(existingPayment.amount) : '');
    setValue('note', existingPayment?.note || '');
    setEditingPaymentId(existingPayment?._id || null);
  };

  const [submitLoading, setSubmitLoading] = useState(false);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    withdrawalDate: moment().format('YYYY-MM-DD'),
    reason: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    note: '',
  });

  // Delete-payment state
  const [deleteModal, setDeleteModal] = useState(null); // { payment } | null
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Pagination state
  const [overviewPage, setOverviewPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.log(err);
      // Non-critical
    }
  }, []);

  const fetchSavingsOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/savings');
      setSavingsOverview(response.data);
    } catch (error) {
      toast.error('Failed to load savings overview: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavingsOverview();
    fetchUsers();
  }, [fetchSavingsOverview, fetchUsers]);

  const openUserDetail = async (userId, name) => {
    setSelectedUserId(userId);
    setSelectedUserName(name);
    setDetailLoading(true);
    setUserSavingsDetail(null);
    setEditingPaymentId(null);
    setHistoryPage(1);
    try {
      const response = await api.get(`/admin/savings/${userId}`);
      setUserSavingsDetail(response.data);
      loadPaymentForDate(getValues('paidOn'), response.data);
    } catch (error) {
      toast.error('Failed to load savings details: ' + (error.response?.data?.message || error.message));
      setSelectedUserId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const onSubmitPayment = async (data) => {
    setSubmitLoading(true);
    try {
      const endpoint = editingPaymentId
        ? `/admin/savings/${selectedUserId}/payment/${editingPaymentId}`
        : `/admin/savings/${selectedUserId}/payment`;
      const payload = {
        amount: parseFloat(data.amount),
        paidOn: data.paidOn,
        note: data.note || '',
      };
      await (editingPaymentId
        ? api.put(endpoint, payload)
        : api.post(endpoint, payload));
      toast.success(editingPaymentId
        ? 'Savings payment updated successfully'
        : 'Savings payment recorded successfully');
      reset({
        amount: '',
        note: '',
        paidOn: moment().format('YYYY-MM-DD'),
        weekStartDate: moment().startOf('isoWeek').format('YYYY-MM-DD'),
      });
      // Refresh
      await Promise.all([
        openUserDetail(selectedUserId, selectedUserName),
        fetchSavingsOverview(),
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record saving');
    } finally {
      setSubmitLoading(false);
    }
  };

  const onSubmitWithdrawal = async (event) => {
    event.preventDefault();
    setWithdrawalLoading(true);
    try {
      await api.post(`/admin/savings/${selectedUserId}/withdrawal`, {
        ...withdrawalForm,
        amount: Number(withdrawalForm.amount),
      });
      toast.success('Savings withdrawal recorded successfully');
      setWithdrawalForm((current) => ({
        ...current,
        amount: '',
        reason: '',
        referenceNumber: '',
        note: '',
      }));
      await Promise.all([
        openUserDetail(selectedUserId, selectedUserName),
        fetchSavingsOverview(),
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record withdrawal');
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const openDeleteModal = (payment) => {
    setDeleteModal({ payment });
    setDeleteReason('');
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModal(null);
    setDeleteReason('');
  };

  const handleDeletePayment = async () => {
    if (!deleteModal || deleting) return;
    const { payment } = deleteModal;
    setDeleting(true);
    try {
      const endpoint = payment.transactionType === 'withdrawal'
        ? `/admin/savings/${selectedUserId}/withdrawal/${payment._id}`
        : `/admin/savings/${selectedUserId}/payment/${payment._id}`;
      const res = await api.delete(
        endpoint,
        { data: { reason: deleteReason.trim() } },
      );
      toast.success(`Savings ${payment.transactionType || 'deposit'} deleted successfully`);
      setDeleteModal(null);
      setDeleteReason('');
      // Update detail view in place
      if (res.data?.summaryAfter) {
        setUserSavingsDetail(prev => prev ? {
          ...prev,
          totalSavings: res.data.summaryAfter.totalSavings,
          savingsInterest: res.data.summaryAfter.savingsInterest,
          payments: prev.payments.filter(p => p._id !== payment._id),
          withdrawals: (prev.withdrawals || []).filter(item => item._id !== payment._id),
          transactions: (prev.transactions || []).filter(item => item._id !== payment._id),
        } : null);
      }
      await Promise.all([
        openUserDetail(selectedUserId, selectedUserName),
        fetchSavingsOverview(),
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete savings payment');
    } finally {
      setDeleting(false);
    }
  };

  const goBack = () => {
    setSelectedUserId(null);
    setUserSavingsDetail(null);
    setOverviewPage(1);
  };

  if (loading) return <div className="spinner"></div>;

  // Merge: show all users even those with no savings
  const allMembers = users.map(u => {
    const savRow = savingsOverview.find(s => String(s.userId) === String(u._id));
    return savRow || {
      userId: u._id,
      name: u.name,
      email: u.email,
      totalSavings: 0,
      savingsInterest: 0,
      paymentsCount: 0,
      withdrawalsCount: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      lastPaidOn: null,
      lastTransactionOn: null,
    };
  });

  const paginatedMembers = allMembers.slice(
    (overviewPage - 1) * ITEMS_PER_PAGE,
    overviewPage * ITEMS_PER_PAGE
  );

  const payments = userSavingsDetail?.transactions || [];
  const paginatedPayments = payments.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  return (
    <div>
      <div className="flex-between mb-4">
        <h2>Manage Savings</h2>
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
                      <th>Total Savings</th>
                      <th>Total Deposited</th>
                      <th>Total Withdrawn</th>
                      <th>Interest (1%)</th>
                      <th>Deposits / Withdrawals</th>
                      <th>Last Activity</th>
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
                        <td style={{ color: 'var(--secondary-color)', fontWeight: 600 }}>
                          ₹{(member.totalSavings || 0).toFixed(2)}
                        </td>
                        <td>₹{(member.totalDeposits || 0).toFixed(2)}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 600 }}>₹{(member.totalWithdrawals || 0).toFixed(2)}</td>
                        <td style={{ color: 'var(--primary-color)' }}>
                          ₹{(member.savingsInterest || 0).toFixed(2)}
                        </td>
                        <td>{member.paymentsCount || 0} / {member.withdrawalsCount || 0}</td>
                        <td>{member.lastTransactionOn ? moment(member.lastTransactionOn).format('MMM Do YYYY') : <span style={{ color: '#94a3b8' }}>No activity yet</span>}</td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem' }}
                            onClick={() => openUserDetail(member.userId, member.name)}
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
          {/* Detail View */}
          <div style={{ flex: 2, minWidth: '300px' }}>
            {detailLoading ? (
              <div className="spinner"></div>
            ) : userSavingsDetail ? (
              <>
                <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: '1.5rem' }}>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div className="stat-title">Total Savings</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--secondary-color)' }}>
                      ₹{(userSavingsDetail.totalSavings || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div className="stat-title">Total Deposited</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--secondary-color)' }}>
                      ₹{(userSavingsDetail.totalDeposits || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div className="stat-title">Total Withdrawn</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--danger)' }}>
                      ₹{(userSavingsDetail.totalWithdrawals || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div className="stat-title">Interest (1%)</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}>
                      ₹{(userSavingsDetail.savingsInterest || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="stat-card" style={{
                    padding: '1rem',
                    background: userSavingsDetail.currentWeekPaid ? '#dcfce7' : '#fff7ed'
                  }}>
                    <div className="stat-title" style={{ color: userSavingsDetail.currentWeekPaid ? '#166534' : '#c2410c' }}>
                      This Week
                    </div>
                    <div className="stat-value" style={{
                      fontSize: '1.2rem',
                      color: userSavingsDetail.currentWeekPaid ? '#15803d' : '#ea580c'
                    }}>
                      {userSavingsDetail.currentWeekPaid ? '✓ Paid' : '⚠ Due'}
                    </div>
                  </div>
                </div>

                <div className="table-container">
                  <h3 style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', margin: 0 }}>
                    Savings Ledger — {selectedUserName}
                  </h3>
                  {payments.length === 0 ? (
                    <p style={{ padding: '1.5rem', color: '#64748b' }}>No savings transactions yet.</p>
                  ) : (
                    <>
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Week / Method</th>
                              <th>Amount</th>
                              <th>Recorded By</th>
                              <th>Reason / Note</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedPayments.map(payment => (
                              <tr key={`${payment.transactionType}-${payment._id}`}>
                                <td>{moment(payment.transactionDate).format('MMM Do YYYY')}</td>
                                <td>
                                  <span className={`savings-type-badge ${payment.transactionType}`}>
                                    {payment.transactionType === 'withdrawal' ? 'Withdrawal' : 'Deposit'}
                                  </span>
                                </td>
                                <td>{payment.transactionType === 'withdrawal' ? payment.paymentMethod : moment(payment.weekStartDate).format('MMM Do YYYY')}</td>
                                <td style={{ fontWeight: 600, color: payment.transactionType === 'withdrawal' ? 'var(--danger)' : 'var(--secondary-color)' }}>
                                  {payment.transactionType === 'withdrawal' ? '−' : '+'}₹{(payment.amount || 0).toFixed(2)}
                                </td>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{payment.recordedBy?.name || '—'}</td>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{payment.reason || payment.note || '—'}{payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}</td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteModal(payment)}
                                    aria-label={`Delete savings ${payment.transactionType} of ₹${payment.amount.toFixed(2)} on ${moment(payment.transactionDate).format('MMM Do YYYY')}`}
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
                        currentPage={historyPage}
                        totalItems={payments.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setHistoryPage}
                      />
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="card"><p style={{ color: '#ef4444' }}>Could not load savings details. Please try again.</p></div>
            )}
          </div>

          {/* New Payment Form */}
          <div className="card" style={{ flex: 1, minWidth: '280px', alignSelf: 'flex-start' }}>
            <h3 className="mb-4">{editingPaymentId ? 'Update' : 'Record'} Savings — {selectedUserName}</h3>
            <form onSubmit={handleSubmit(onSubmitPayment)}>
              <div className="input-group">
                <label className="input-label">Amount (₹) *</label>
                <input
                  type="number"
                  className="input-field"
                  step="0.01"
                  min="1"
                  placeholder="e.g. 200"
                  {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Min ₹1' } })}
                />
                {errors.amount && <p className="error-text">{errors.amount.message}</p>}
              </div>

              <div className="input-group">
                <label className="input-label">Paid On *</label>
                <input
                  type="date"
                  className="input-field"
                  {...register('paidOn', { required: 'Date is required' })}
                  onInput={(event) => loadPaymentForDate(event.currentTarget.value)}
                />
                {errors.paidOn && <p className="error-text">{errors.paidOn.message}</p>}
              </div>

              <div className="input-group">
                <label className="input-label">Week Start Date *</label>
                <input
                  type="date"
                  className="input-field"
                  readOnly
                  {...register('weekStartDate', { required: 'Week start date is required' })}
                />
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Automatically derived from Paid On to prevent duplicate weekly payments.
                </p>
                {errors.weekStartDate && <p className="error-text">{errors.weekStartDate.message}</p>}
              </div>

              <div className="input-group">
                <label className="input-label">Note (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Paid cash at meeting"
                  {...register('note')}
                />
              </div>

              <button type="submit" className="btn btn-secondary" style={{ width: '100%' }} disabled={submitLoading}>
                {submitLoading ? 'Saving...' : editingPaymentId ? 'Update Payment' : 'Record Payment'}
              </button>
            </form>
          </div>

          <div className="card savings-withdrawal-form" style={{ flex: 1, minWidth: '300px', alignSelf: 'flex-start' }}>
            <h3 className="mb-4">Withdraw Savings — {selectedUserName}</h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
              Current available balance: ₹{(userSavingsDetail?.totalSavings || 0).toFixed(2)}
            </p>
            <form onSubmit={onSubmitWithdrawal}>
              <div className="input-group">
                <label className="input-label" htmlFor="savings-withdrawal-amount">Amount (₹) *</label>
                <input id="savings-withdrawal-amount" type="number" className="input-field" min="0.01" max={userSavingsDetail?.totalSavings || 0} step="0.01" required value={withdrawalForm.amount} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, amount: event.target.value })} placeholder="0.00" />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="savings-withdrawal-date">Withdrawal Date *</label>
                <input id="savings-withdrawal-date" type="date" className="input-field" max={moment().format('YYYY-MM-DD')} required value={withdrawalForm.withdrawalDate} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, withdrawalDate: event.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="savings-withdrawal-reason">Reason *</label>
                <input id="savings-withdrawal-reason" className="input-field" required maxLength="300" value={withdrawalForm.reason} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, reason: event.target.value })} placeholder="e.g. Medical expenses" />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="savings-withdrawal-method">Payment Method *</label>
                <select id="savings-withdrawal-method" className="input-field" value={withdrawalForm.paymentMethod} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, paymentMethod: event.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="savings-withdrawal-reference">Reference Number</label>
                <input id="savings-withdrawal-reference" className="input-field" maxLength="100" value={withdrawalForm.referenceNumber} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, referenceNumber: event.target.value })} placeholder="Receipt or bank reference" />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="savings-withdrawal-note">Note</label>
                <input id="savings-withdrawal-note" className="input-field" maxLength="1000" value={withdrawalForm.note} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, note: event.target.value })} placeholder="Optional additional details" />
              </div>
              <button type="submit" className="btn savings-withdrawal-button" style={{ width: '100%' }} disabled={withdrawalLoading || (userSavingsDetail?.totalSavings || 0) <= 0}>
                {withdrawalLoading ? 'Recording...' : 'Record Withdrawal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Savings Payment Confirmation Modal ── */}
      {deleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-savings-modal-title"
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
            maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 id="delete-savings-modal-title" style={{ margin: '0 0 0.25rem', color: '#dc2626', fontSize: '1.1rem' }}>
              Delete Savings {deleteModal.payment.transactionType === 'withdrawal' ? 'Withdrawal' : 'Deposit'}
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
              This action is permanent and cannot be undone. Savings total will be recalculated.
            </p>

            {/* Payment summary */}
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem',
              fontSize: '0.88rem',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Type</span>
                <span style={{ fontWeight: 600 }}>{deleteModal.payment.transactionType === 'withdrawal' ? 'Withdrawal' : 'Deposit'}</span>
                <span style={{ color: '#64748b' }}>Date</span>
                <span>{moment(deleteModal.payment.transactionDate).format('MMM Do YYYY')}</span>
                <span style={{ color: '#64748b' }}>Amount</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>₹{deleteModal.payment.amount.toFixed(2)}</span>
                {(deleteModal.payment.reason || deleteModal.payment.note) && (
                  <>
                    <span style={{ color: '#64748b' }}>Reason / Note</span>
                    <span style={{ wordBreak: 'break-word' }}>{deleteModal.payment.reason || deleteModal.payment.note}</span>
                  </>
                )}
              </div>
            </div>

            {/* Optional reason */}
            <div className="input-group" style={{ marginBottom: '1.25rem' }}>
              <label className="input-label" htmlFor="delete-savings-reason">Reason for deletion (optional)</label>
              <input
                id="delete-savings-reason"
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
                onClick={handleDeletePayment}
                disabled={deleting}
                aria-label="Confirm permanent deletion of savings payment"
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

export default ManageSavings;
