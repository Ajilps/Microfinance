import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import moment from 'moment';
import Pagination from '../../components/Pagination';
import sortNewestFirst from '../../utils/sortNewestFirst';

const ITEMS_PER_PAGE = 10;

const MySavings = () => {
  const [savingsData, setSavingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchSavings = async () => {
      try {
        const response = await api.get('/users/savings/me');
        setSavingsData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch savings information');
      } finally {
        setLoading(false);
      }
    };

    fetchSavings();
  }, []);

  if (loading) return <div className="spinner"></div>;
  if (error) return <div className="card" style={{ color: 'var(--danger)' }}>{error}</div>;
  if (!savingsData) return <div className="card">No savings data available.</div>;

  const payments = sortNewestFirst(savingsData.transactions || [], 'transactionDate');
  const paginatedPayments = payments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div>
      <div className="flex-between mb-4">
        <h2>My Savings</h2>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-title">Total Savings</div>
          <div className="stat-value" style={{ color: 'var(--secondary-color)' }}>
            ₹{savingsData.totalSavings?.toFixed(2) || '0.00'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Deposited</div>
          <div className="stat-value" style={{ color: 'var(--secondary-color)' }}>
            ₹{savingsData.totalDeposits?.toFixed(2) || '0.00'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Withdrawn</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            ₹{savingsData.totalWithdrawals?.toFixed(2) || '0.00'}
          </div>
        </div>
        <div className="stat-card" style={{ background: savingsData.currentWeekPaid ? '#dcfce7' : '#fee2e2' }}>
          <div className="stat-title" style={{ color: savingsData.currentWeekPaid ? '#166534' : '#991b1b' }}>Current Week Status</div>
          <div className="stat-value" style={{ color: savingsData.currentWeekPaid ? '#15803d' : '#b91c1c' }}>
            {savingsData.currentWeekPaid ? 'Paid' : 'Unpaid'}
          </div>
        </div>
      </div>

      <div className="table-container mt-4">
        <h3 style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', margin: 0 }}>Savings Ledger</h3>
        {payments.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Week / Method</th>
                    <th>Amount</th>
                    <th>Reason / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((payment) => (
                    <tr key={`${payment.transactionType}-${payment._id}`}>
                      <td>{moment(payment.transactionDate).format('MMMM Do YYYY')}</td>
                      <td>
                        <span className={`savings-type-badge ${payment.transactionType}`}>
                          {payment.transactionType === 'withdrawal' ? 'Withdrawal' : 'Deposit'}
                        </span>
                      </td>
                      <td>{payment.transactionType === 'withdrawal' ? payment.paymentMethod : moment(payment.weekStartDate).format('MMMM Do YYYY')}</td>
                      <td style={{ color: payment.transactionType === 'withdrawal' ? 'var(--danger)' : 'var(--secondary-color)', fontWeight: 600 }}>
                        {payment.transactionType === 'withdrawal' ? '−' : '+'}₹{Number(payment.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ color: '#64748b' }}>{payment.reason || payment.note || '-'}{payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={payments.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </>
        ) : (
          <p style={{ padding: '1.5rem', color: '#64748b' }}>No savings transaction history found.</p>
        )}
      </div>
    </div>
  );
};

export default MySavings;
