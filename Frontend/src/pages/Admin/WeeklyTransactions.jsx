import { useCallback, useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import { toast } from 'react-toastify';

import Pagination from '../../components/Pagination';
import api from '../../services/api';

const ITEMS_PER_PAGE = 15;
const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

const WeeklyTransactions = () => {
  const [selectedDate, setSelectedDate] = useState(moment().startOf('isoWeek').format('YYYY-MM-DD'));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/finance/weekly', {
        params: { date: selectedDate },
      });
      setReport(response.data);
      setPage(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load weekly transactions');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const moveWeek = (amount) => {
    setSelectedDate(moment(selectedDate).add(amount, 'week').format('YYYY-MM-DD'));
  };

  const categoryRows = useMemo(
    () => Object.entries(report?.categoryTotals || {}).sort(([left], [right]) => left.localeCompare(right)),
    [report],
  );
  const transactions = report?.transactions || [];
  const totals = report?.totals || {};
  const paginatedTransactions = transactions.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const weekLabel = report
    ? `${moment.utc(report.weekStart).format('DD MMM')} – ${moment.utc(report.weekEnd).format('DD MMM YYYY')}`
    : '';

  return (
    <div>
      <div className="page-header">
        <h2>Weekly Transactions</h2>
        <p>Monday–Sunday cash in, cash out, and non-cash activity.</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => moveWeek(-1)} aria-label="Previous week">← Previous</button>
            <div className="input-group" style={{ marginBottom: 0, minWidth: '200px' }}>
              <label className="input-label" htmlFor="weekly-date">Select a date in the week</label>
              <input id="weekly-date" type="date" className="input-field" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </div>
            <button className="btn btn-ghost" onClick={() => moveWeek(1)} aria-label="Next week">Next →</button>
            <button className="btn btn-secondary" onClick={() => setSelectedDate(moment().format('YYYY-MM-DD'))}>Current Week</button>
          </div>
          {weekLabel && (
            <div style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{weekLabel}</div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : !report ? null : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-title">Total Cash In</div>
              <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>{money(totals.cashIncome)}</div>
              <div className="stat-sub">Repayments, savings, fines and other income</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Total Cash Out</div>
              <div className="stat-value" style={{ color: 'var(--rose-400)' }}>{money(totals.cashExpense)}</div>
              <div className="stat-sub">Loans disbursed and other expenses</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Total Non-Cash</div>
              <div className="stat-value" style={{ color: 'var(--amber-400)' }}>{money(totals.nonCashCharges)}</div>
              <div className="stat-sub">Interest and loan fines accrued</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
              <div>
                <h3>Category Totals</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Totals for all activity in the selected week.</p>
              </div>
            </div>
            {categoryRows.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem' }}>No category activity this week.</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '650px' }}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Cash In</th>
                      <th style={{ textAlign: 'right' }}>Cash Out</th>
                      <th style={{ textAlign: 'right' }}>Non-cash</th>
                      <th style={{ textAlign: 'right' }}>Activity Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map(([category, values]) => (
                      <tr key={category}>
                        <td style={{ fontWeight: 600 }}>{category}</td>
                        <td style={{ textAlign: 'right', color: values.income ? 'var(--emerald-400)' : 'var(--text-muted)' }}>{money(values.income)}</td>
                        <td style={{ textAlign: 'right', color: values.expense ? 'var(--rose-400)' : 'var(--text-muted)' }}>{money(values.expense)}</td>
                        <td style={{ textAlign: 'right', color: values.nonCash ? 'var(--amber-400)' : 'var(--text-muted)' }}>{money(values.nonCash)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(values.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <th style={{ textAlign: 'right', color: 'var(--emerald-400)' }}>{money(totals.cashIncome)}</th>
                      <th style={{ textAlign: 'right', color: 'var(--rose-400)' }}>{money(totals.cashExpense)}</th>
                      <th style={{ textAlign: 'right', color: 'var(--amber-400)' }}>{money(totals.nonCashCharges)}</th>
                      <th aria-label={`${totals.transactionCount || 0} transaction records`} style={{ textAlign: 'right' }}>—</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem' }}>
            <div>
              <h3>Transaction Detail</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Newest transactions appear first.</p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state__icon">📅</div>
              <div className="empty-state__text">No transactions were recorded in this week.</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table" style={{ minWidth: '1050px' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Member / Source</th>
                    <th>Reason / Note</th>
                    <th>Recorded By</th>
                    <th style={{ textAlign: 'right' }}>Cash In</th>
                    <th style={{ textAlign: 'right' }}>Cash Out</th>
                    <th style={{ textAlign: 'right' }}>Non-cash</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((transaction) => (
                    <tr key={`${transaction.sourceType}-${transaction.id}`}>
                      <td>{moment(transaction.date).format('DD MMM YYYY')}</td>
                      <td>
                        <span className={`badge ${transaction.isCash ? 'badge-info' : 'badge-warning'}`}>
                          {transaction.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{transaction.memberOrSource}</td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: '260px' }}>{transaction.reason || '—'}</td>
                      <td>{transaction.recordedBy}</td>
                      <td style={{ textAlign: 'right', color: transaction.income ? 'var(--emerald-400)' : 'var(--text-muted)', fontWeight: transaction.income ? 700 : 400 }}>
                        {transaction.income ? money(transaction.income) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: transaction.expense ? 'var(--rose-400)' : 'var(--text-muted)', fontWeight: transaction.expense ? 700 : 400 }}>
                        {transaction.expense ? money(transaction.expense) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: transaction.nonCash ? 'var(--amber-400)' : 'var(--text-muted)', fontWeight: transaction.nonCash ? 700 : 400 }}>
                        {transaction.nonCash ? money(transaction.nonCash) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination currentPage={page} totalItems={transactions.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
            </div>
          )}

          <div className="alert" style={{ borderColor: 'rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.08)', color: 'var(--text-secondary)' }}>
            <span>ℹ️</span>
            <span>Savings and repayments are shown as cash inflows, but they are not business revenue. Accrued interest and loan fines are shown separately because no cash moved when they were charged.</span>
          </div>
        </>
      )}
    </div>
  );
};

export default WeeklyTransactions;
