import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import moment from 'moment';
import { useForm } from 'react-hook-form';
import Pagination from '../../components/Pagination';

const ITEMS_PER_PAGE = 10;

const ManageSavings = () => {
  const [users, setUsers] = useState([]);
  const [savingsOverview, setSavingsOverview] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [userSavingsDetail, setUserSavingsDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      paidOn: moment().format('YYYY-MM-DD'),
      weekStartDate: moment().startOf('isoWeek').format('YYYY-MM-DD'),
    }
  });
  const [submitLoading, setSubmitLoading] = useState(false);

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
    setHistoryPage(1);
    try {
      const response = await api.get(`/admin/savings/${userId}`);
      setUserSavingsDetail(response.data);
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
      await api.post(`/admin/savings/${selectedUserId}/payment`, {
        amount: parseFloat(data.amount),
        paidOn: data.paidOn,
        weekStartDate: data.weekStartDate,
        note: data.note || '',
      });
      toast.success('Savings payment recorded successfully');
      reset({
        amount: '',
        note: '',
        paidOn: moment().format('YYYY-MM-DD'),
        weekStartDate: moment().startOf('isoWeek').format('YYYY-MM-DD'),
      });
      // Refresh
      openUserDetail(selectedUserId, selectedUserName);
      fetchSavingsOverview();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record saving');
    } finally {
      setSubmitLoading(false);
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
      const res = await api.delete(
        `/admin/savings/${selectedUserId}/payment/${payment._id}`,
        { data: { reason: deleteReason.trim() } },
      );
      toast.success('Savings payment deleted successfully');
      setDeleteModal(null);
      setDeleteReason('');
      // Update detail view in place
      if (res.data?.summaryAfter) {
        setUserSavingsDetail(prev => prev ? {
          ...prev,
          totalSavings: res.data.summaryAfter.totalSavings,
          savingsInterest: res.data.summaryAfter.savingsInterest,
          payments: prev.payments.filter(p => p._id !== payment._id),
        } : null);
      }
      fetchSavingsOverview();
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
      lastPaidOn: null,
    };
  });

  const paginatedMembers = allMembers.slice(
    (overviewPage - 1) * ITEMS_PER_PAGE,
    overviewPage * ITEMS_PER_PAGE
  );

  const payments = userSavingsDetail?.payments || [];
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
                      <th>Interest (1%)</th>
                      <th>Payments</th>
                      <th>Last Paid</th>
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
                        <td style={{ color: 'var(--primary-color)' }}>
                          ₹{(member.savingsInterest || 0).toFixed(2)}
                        </td>
                        <td>{member.paymentsCount || 0}</td>
                        <td>{member.lastPaidOn ? moment(member.lastPaidOn).format('MMM Do YYYY') : <span style={{ color: '#94a3b8' }}>No payments yet</span>}</td>
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
                <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div className="stat-title">Total Savings</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--secondary-color)' }}>
                      ₹{(userSavingsDetail.totalSavings || 0).toFixed(2)}
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
                    Savings History — {selectedUserName}
                  </h3>
                  {payments.length === 0 ? (
                    <p style={{ padding: '1.5rem', color: '#64748b' }}>No payments yet. Record one using the form.</p>
                  ) : (
                    <>
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Week Of</th>
                              <th>Paid On</th>
                              <th>Amount</th>
                              <th>Recorded By</th>
                              <th>Note</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedPayments.map(payment => (
                              <tr key={payment._id}>
                                <td>{moment(payment.weekStartDate).format('MMM Do YYYY')}</td>
                                <td>{moment(payment.paidOn).format('MMM Do YYYY')}</td>
                                <td style={{ fontWeight: 600, color: 'var(--secondary-color)' }}>₹{(payment.amount || 0).toFixed(2)}</td>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{payment.recordedBy?.name || '—'}</td>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{payment.note || '—'}</td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteModal(payment)}
                                    aria-label={`Delete savings payment of ₹${payment.amount.toFixed(2)} on ${moment(payment.paidOn).format('MMM Do YYYY')}`}
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
            <h3 className="mb-4">Record Savings — {selectedUserName}</h3>
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
                />
                {errors.paidOn && <p className="error-text">{errors.paidOn.message}</p>}
              </div>

              <div className="input-group">
                <label className="input-label">Week Start Date *</label>
                <input
                  type="date"
                  className="input-field"
                  {...register('weekStartDate', { required: 'Week start date is required' })}
                />
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Monday of the savings week
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
                {submitLoading ? 'Recording...' : 'Record Payment'}
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
              Delete Savings Payment
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
                <span style={{ color: '#64748b' }}>Week Of</span>
                <span style={{ fontWeight: 600 }}>{moment(deleteModal.payment.weekStartDate).format('MMM Do YYYY')}</span>
                <span style={{ color: '#64748b' }}>Paid On</span>
                <span>{moment(deleteModal.payment.paidOn).format('MMM Do YYYY')}</span>
                <span style={{ color: '#64748b' }}>Amount</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>₹{deleteModal.payment.amount.toFixed(2)}</span>
                {deleteModal.payment.note && (
                  <>
                    <span style={{ color: '#64748b' }}>Note</span>
                    <span style={{ wordBreak: 'break-word' }}>{deleteModal.payment.note}</span>
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
