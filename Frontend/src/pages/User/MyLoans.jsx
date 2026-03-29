import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import moment from 'moment';
import Pagination from '../../components/Pagination';

const ITEMS_PER_PAGE = 10;

const MyLoans = () => {
  const [loanData, setLoanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'principal' | 'interest'

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const response = await api.get('/users/loans/me');
        setLoanData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch loan information');
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, []);

  if (loading) return <div className="spinner"></div>;
  if (error) return <div className="card" style={{ color: 'var(--danger)' }}>{error}</div>;
  if (!loanData) return <div className="card">No loan data available.</div>;

  const history = loanData.history || [];

  // Filter transactions by tab
  const filteredHistory = history.filter(tx => {
    if (activeTab === 'principal') return tx.type === 'loan' || (tx.type === 'repayment' && tx.paymentTarget === 'principal');
    if (activeTab === 'interest') return tx.type === 'interest' || tx.type === 'fine' || (tx.type === 'repayment' && tx.paymentTarget === 'interest');
    return true;
  });

  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const txTypeBadge = (tx) => {
    if (tx.type === 'loan') {
      return (
        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>
          Loan Disbursement
        </span>
      );
    }
    if (tx.type === 'interest') {
      return (
        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
          Interest Charged
        </span>
      );
    }
    if (tx.type === 'fine') {
      return (
        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, background: '#e0e7ff', color: '#3730a3' }}>
          Fine / Penalty
        </span>
      );
    }
    if (tx.type === 'repayment') {
      if (tx.paymentTarget === 'interest') {
        return (
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>
            Payment → Interest
          </span>
        );
      }
      if (tx.paymentTarget === 'principal') {
        return (
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, background: '#dcfce7', color: '#166534' }}>
            Payment → Principal
          </span>
        );
      }
      return (
        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, background: '#dcfce7', color: '#166534' }}>
          Payment
        </span>
      );
    }
    return <span>{tx.type}</span>;
  };

  const hasActiveLoan = loanData.totalDisbursed > 0;

  return (
    <div>
      <div className="flex-between mb-4">
        <h2>My Loan Account</h2>
      </div>

      {!hasActiveLoan ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏦</div>
          <p>You have no active loan. Contact your administrator for more information.</p>
        </div>
      ) : (
        <>
          {/* ── Two Separate Balance Sections ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

            {/* Principal Section */}
            <div className="card" style={{ padding: '1.5rem', borderTop: '4px solid var(--danger)', background: 'linear-gradient(135deg, #fff5f5 0%, #fff 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🏛️</span>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Principal Balance</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Original loan amount outstanding</div>
                </div>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: loanData.principalBalance > 0 ? 'var(--danger)' : '#10b981', marginBottom: '1rem' }}>
                ₹{loanData.principalBalance?.toFixed(2) || '0.00'}
              </div>
              <div style={{ borderTop: '1px solid #fee2e2', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Total Disbursed</span>
                  <span style={{ fontWeight: 600 }}>₹{loanData.totalDisbursed?.toFixed(2) || '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Principal Repaid</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>₹{loanData.totalPrincipalRepaid?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>

            {/* Interest Section */}
            <div className="card" style={{ padding: '1.5rem', borderTop: '4px solid #f59e0b', background: 'linear-gradient(135deg, #fffbeb 0%, #fff 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📈</span>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Interest Balance</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Accrued interest outstanding</div>
                </div>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: loanData.interestBalance > 0 ? '#d97706' : '#10b981', marginBottom: '1rem' }}>
                ₹{loanData.interestBalance?.toFixed(2) || '0.00'}
              </div>
              <div style={{ borderTop: '1px solid #fde68a', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Total Interest Charged</span>
                  <span style={{ fontWeight: 600, color: '#d97706' }}>₹{loanData.totalInterestAccrued?.toFixed(2) || '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Interest Paid</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>₹{loanData.totalInterestRepaid?.toFixed(2) || '0.00'}</span>
                </div>
                {(loanData.totalFines || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Fines Added</span>
                    <span style={{ fontWeight: 600, color: '#7c3aed' }}>₹{loanData.totalFines?.toFixed(2) || '0.00'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Total Outstanding Banner */}
          <div className="card" style={{
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            background: loanData.totalOutstanding > 0 ? 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)',
            borderLeft: `5px solid ${loanData.totalOutstanding > 0 ? 'var(--danger)' : '#10b981'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#374151', fontSize: '1rem' }}>Total Outstanding Balance</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Principal + Interest combined</div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: loanData.totalOutstanding > 0 ? 'var(--danger)' : '#10b981' }}>
                ₹{loanData.totalOutstanding?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>

          {/* ── Transaction History ── */}
          <div className="table-container">
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Transaction History</h3>
              {/* Tab filters */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'principal', label: '🏛️ Principal' },
                  { key: 'interest', label: '📈 Interest' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    style={{
                      padding: '0.35rem 0.9rem',
                      borderRadius: '9999px',
                      border: '1px solid',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      borderColor: activeTab === tab.key ? 'var(--primary-color)' : '#e2e8f0',
                      background: activeTab === tab.key ? 'var(--primary-color)' : '#fff',
                      color: activeTab === tab.key ? '#fff' : '#475569',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistory.length > 0 ? (
              <>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((tx) => (
                        <tr key={tx._id}>
                          <td>{moment(tx.date).format('MMMM Do YYYY')}</td>
                          <td>{txTypeBadge(tx)}</td>
                          <td style={{
                            fontWeight: 700,
                            color: tx.type === 'repayment' ? '#10b981' : tx.type === 'interest' ? '#d97706' : tx.type === 'fine' ? '#7c3aed' : 'var(--danger)',
                          }}>
                            {tx.type === 'repayment' ? '−' : '+'}₹{tx.amount.toFixed(2)}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            {tx.type === 'interest' && tx.interestPeriod?.periodStart ? (
                              <span>
                                Period: {moment(tx.interestPeriod.periodStart).format('MMM D')} – {moment(tx.interestPeriod.periodEnd).format('MMM D, YYYY')}
                                {' '}· {((tx.interestPeriod.interestRate || 0.01) * 100).toFixed(1)}% on ₹{(tx.interestPeriod.principalBalance || 0).toFixed(2)}
                              </span>
                            ) : (
                              tx.note || '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredHistory.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              </>
            ) : (
              <p style={{ padding: '1.5rem', color: '#64748b' }}>
                {activeTab === 'all' ? 'No transactions found.' : `No ${activeTab} transactions found.`}
              </p>
            )}
          </div>

          {/* Interest Policy Note */}
          <div className="card" style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: '#f8fafc', fontSize: '0.82rem', color: '#475569', lineHeight: 1.7 }}>
            <strong>ℹ️ How your loan works:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
              <li>Your <strong>principal balance</strong> only decreases when you make a principal repayment.</li>
              <li>Interest is charged at <strong>1% of your principal balance</strong> every 4 weeks — it is never added to your principal.</li>
              <li>Payments are applied to either <strong>interest</strong> or <strong>principal</strong> as specified by your administrator.</li>
              <li>Your interest balance decreases immediately when an interest payment is recorded.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default MyLoans;
