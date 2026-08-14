import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { toast } from 'react-toastify';

import Pagination from '../../components/Pagination';
import api from '../../services/api';

const ITEMS_PER_PAGE = 15;
const EMPTY_FORM = {
  transactionDate: moment().format('YYYY-MM-DD'),
  particulars: '',
  chequeNumber: '',
  chequeName: '',
  withdrawal: '',
  deposit: '',
};

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const BankTransactions = () => {
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    currentBalance: 0,
    filteredDeposits: 0,
    filteredWithdrawals: 0,
  });
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [page, setPage] = useState(1);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const response = await api.get('/admin/finance/bank-transactions', { params });
      setEntries(response.data.entries || []);
      setTotals(response.data.totals || {});
      setPage(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load bank transactions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, transactionDate: moment().format('YYYY-MM-DD') });
    setShowForm(true);
  };

  const openEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      transactionDate: moment.utc(entry.transactionDate).format('YYYY-MM-DD'),
      particulars: entry.particulars,
      chequeNumber: entry.chequeNumber || '',
      chequeName: entry.chequeName || '',
      withdrawal: entry.withdrawal || '',
      deposit: entry.deposit || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
  };

  const updateMoney = (field, value) => {
    const otherField = field === 'deposit' ? 'withdrawal' : 'deposit';
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(Number(value) > 0 ? { [otherField]: '' } : {}),
    }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const deposit = Number(form.deposit || 0);
    const withdrawal = Number(form.withdrawal || 0);
    if ((deposit > 0 && withdrawal > 0) || (deposit <= 0 && withdrawal <= 0)) {
      toast.warn('Enter either a withdrawal or a deposit, but not both');
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      particulars: form.particulars.trim(),
      chequeNumber: form.chequeNumber.trim(),
      chequeName: form.chequeName.trim(),
      withdrawal,
      deposit,
    };

    try {
      if (editingId) {
        await api.put(`/admin/finance/bank-transactions/${editingId}`, payload);
        toast.success('Bank transaction updated');
      } else {
        await api.post('/admin/finance/bank-transactions', payload);
        toast.success('Bank transaction added');
      }
      setShowForm(false);
      setEditingId(null);
      await fetchEntries();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save bank transaction');
    } finally {
      setSaving(false);
    }
  };

  const paginatedEntries = entries.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  return (
    <div>
      <div className="page-header flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2>Bank Transactions</h2>
          <p>Track bank deposits, withdrawals, cheque details, and the running balance.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>＋ Add Bank Transaction</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-title">Current Bank Balance</div>
          <div
            className="stat-value"
            style={{ color: totals.currentBalance >= 0 ? 'var(--sky-400)' : 'var(--rose-400)' }}
          >
            {money(totals.currentBalance)}
          </div>
          <div className="stat-sub">Across all recorded transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Deposits</div>
          <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>
            {money(totals.filteredDeposits)}
          </div>
          <div className="stat-sub">For the selected date range</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Withdrawals</div>
          <div className="stat-value" style={{ color: 'var(--rose-400)' }}>
            {money(totals.filteredWithdrawals)}
          </div>
          <div className="stat-sub">For the selected date range</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="bank-filter-start">From date</label>
            <input
              id="bank-filter-start"
              type="date"
              className="input-field"
              value={filters.startDate}
              onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="bank-filter-end">To date</label>
            <input
              id="bank-filter-end"
              type="date"
              className="input-field"
              value={filters.endDate}
              onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
            />
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => setFilters({ startDate: '', endDate: '' })}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : entries.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state__icon">🏦</div>
          <div className="empty-state__text">No bank transactions match this date range.</div>
        </div>
      ) : (
        <div className="table-container report-table-scroll" tabIndex="0" aria-label="Scrollable bank transaction ledger">
          <table className="data-table" style={{ minWidth: '1100px' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Particulars</th>
                <th>Cheque Number</th>
                <th>Cheque Name</th>
                <th style={{ textAlign: 'right' }}>Withdrawal (₹)</th>
                <th style={{ textAlign: 'right' }}>Deposit (₹)</th>
                <th style={{ textAlign: 'right' }}>Balance (₹)</th>
                <th>Recorded By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.map((entry) => (
                <tr key={entry._id}>
                  <td>{moment.utc(entry.transactionDate).format('DD MMM YYYY')}</td>
                  <td style={{ fontWeight: 700, maxWidth: '280px' }}>{entry.particulars}</td>
                  <td>{entry.chequeNumber || '—'}</td>
                  <td>{entry.chequeName || '—'}</td>
                  <td style={{ textAlign: 'right', color: entry.withdrawal ? 'var(--rose-400)' : 'var(--text-muted)', fontWeight: entry.withdrawal ? 700 : 400 }}>
                    {entry.withdrawal ? money(entry.withdrawal) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: entry.deposit ? 'var(--emerald-400)' : 'var(--text-muted)', fontWeight: entry.deposit ? 700 : 400 }}>
                    {entry.deposit ? money(entry.deposit) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: entry.balance >= 0 ? 'var(--sky-400)' : 'var(--rose-400)', fontWeight: 800 }}>
                    {money(entry.balance)}
                  </td>
                  <td>{entry.updatedBy?.name || entry.recordedBy?.name || 'Unknown'}</td>
                  <td>
                    <button className="btn btn-ghost" style={{ padding: '0.45rem 0.75rem' }} onClick={() => openEdit(entry)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalItems={entries.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bank-form-title">
            <div className="modal-header">
              <div>
                <h3 id="bank-form-title">{editingId ? 'Edit Bank Transaction' : 'Add Bank Transaction'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Enter a deposit or withdrawal. The running balance is calculated automatically.
                </p>
              </div>
              <button className="modal-close" onClick={closeForm} aria-label="Close">×</button>
            </div>

            <form onSubmit={submitForm}>
              <div className="input-group">
                <label className="input-label" htmlFor="bank-date">Date *</label>
                <input
                  id="bank-date"
                  type="date"
                  className="input-field"
                  value={form.transactionDate}
                  onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="bank-particulars">Particulars *</label>
                <input
                  id="bank-particulars"
                  type="text"
                  maxLength="300"
                  className="input-field"
                  value={form.particulars}
                  onChange={(event) => setForm((current) => ({ ...current, particulars: event.target.value }))}
                  placeholder="e.g. Profit payout, loan transfer, cash deposit"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="bank-cheque-number">Cheque Number (optional)</label>
                  <input
                    id="bank-cheque-number"
                    type="text"
                    maxLength="100"
                    className="input-field"
                    value={form.chequeNumber}
                    onChange={(event) => setForm((current) => ({ ...current, chequeNumber: event.target.value }))}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="bank-cheque-name">Cheque Name (optional)</label>
                  <input
                    id="bank-cheque-name"
                    type="text"
                    maxLength="200"
                    className="input-field"
                    value={form.chequeName}
                    onChange={(event) => setForm((current) => ({ ...current, chequeName: event.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="bank-withdrawal">Withdrawal (₹)</label>
                  <input
                    id="bank-withdrawal"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field"
                    value={form.withdrawal}
                    onChange={(event) => updateMoney('withdrawal', event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="bank-deposit">Deposit (₹)</label>
                  <input
                    id="bank-deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field"
                    value={form.deposit}
                    onChange={(event) => updateMoney('deposit', event.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update Transaction' : 'Add Transaction'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeForm} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankTransactions;
