import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { toast } from 'react-toastify';

import Pagination from '../../components/Pagination';
import api from '../../services/api';

const ITEMS_PER_PAGE = 12;
const EMPTY_FORM = {
  type: 'expense',
  amount: '',
  transactionDate: moment().format('YYYY-MM-DD'),
  sourceOrReason: '',
  note: '',
};

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

const ManageIncomeExpenses = () => {
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ type: 'all', startDate: '', endDate: '' });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { type: filters.type };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const response = await api.get('/admin/finance/entries', { params });
      setEntries(response.data.entries || []);
      setTotals(response.data.totals || { income: 0, expense: 0, balance: 0 });
      setPage(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load income and expenses');
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
      type: entry.type,
      amount: entry.amount,
      transactionDate: moment(entry.transactionDate).format('YYYY-MM-DD'),
      sourceOrReason: entry.sourceOrReason,
      note: entry.note || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!form.sourceOrReason.trim()) {
      toast.warn('Money source or reason is required');
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount),
      sourceOrReason: form.sourceOrReason.trim(),
      note: form.note.trim(),
    };

    try {
      if (editingId) {
        await api.put(`/admin/finance/entries/${editingId}`, payload);
        toast.success('Transaction updated successfully');
      } else {
        await api.post('/admin/finance/entries', payload);
        toast.success('Transaction added successfully');
      }
      setShowForm(false);
      setEditingId(null);
      await fetchEntries();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ type: 'all', startDate: '', endDate: '' });
  };

  const paginatedEntries = entries.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  return (
    <div>
      <div className="page-header flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2>Income & Expenses</h2>
          <p>Add and edit additional cash income and business expenses.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>＋ Add Transaction</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-title">Other Income</div>
          <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>{money(totals.income)}</div>
          <div className="stat-sub">For the active filters</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Other Expenses</div>
          <div className="stat-value" style={{ color: 'var(--rose-400)' }}>{money(totals.expense)}</div>
          <div className="stat-sub">For the active filters</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Balance</div>
          <div className="stat-value" style={{ color: totals.balance >= 0 ? 'var(--sky-400)' : 'var(--rose-400)' }}>
            {money(totals.balance)}
          </div>
          <div className="stat-sub">Income minus expenses</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="finance-filter-type">Type</label>
            <select id="finance-filter-type" className="input-field" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
              <option value="all">All transactions</option>
              <option value="income">Income only</option>
              <option value="expense">Expenses only</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="finance-filter-start">From date</label>
            <input id="finance-filter-start" type="date" className="input-field" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="finance-filter-end">To date</label>
            <input id="finance-filter-end" type="date" className="input-field" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} />
          </div>
          <button className="btn btn-ghost" onClick={clearFilters}>Clear Filters</button>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : entries.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state__icon">↕</div>
          <div className="empty-state__text">No income or expense records match these filters.</div>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table" style={{ minWidth: '880px' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Source / Reason</th>
                <th>Note</th>
                <th>Recorded By</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.map((entry) => (
                <tr key={entry._id}>
                  <td>{moment(entry.transactionDate).format('DD MMM YYYY')}</td>
                  <td>
                    <span className={`badge ${entry.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                      {entry.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{entry.sourceOrReason}</td>
                  <td style={{ color: 'var(--text-muted)', maxWidth: '260px' }}>{entry.note || '—'}</td>
                  <td>{entry.updatedBy?.name || entry.recordedBy?.name || 'Unknown'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: entry.type === 'income' ? 'var(--emerald-400)' : 'var(--rose-400)' }}>
                    {money(entry.amount)}
                  </td>
                  <td>
                    <button className="btn btn-ghost" style={{ padding: '0.45rem 0.75rem' }} onClick={() => openEdit(entry)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination currentPage={page} totalItems={entries.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="finance-form-title">
            <div className="modal-header">
              <div>
                <h3 id="finance-form-title">{editingId ? 'Edit Transaction' : 'Add Transaction'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  All fields except the note are required.
                </p>
              </div>
              <button className="modal-close" onClick={closeForm} aria-label="Close">×</button>
            </div>

            <form onSubmit={submitForm}>
              <div className="input-group">
                <label className="input-label" htmlFor="finance-type">Transaction type</label>
                <select id="finance-type" className="input-field" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} required>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="finance-amount">Amount (₹)</label>
                <input id="finance-amount" type="number" min="0.01" step="0.01" className="input-field" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="finance-date">Transaction date</label>
                <input id="finance-date" type="date" className="input-field" value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="finance-reason">Money source or reason</label>
                <input id="finance-reason" type="text" maxLength="200" className="input-field" value={form.sourceOrReason} onChange={(event) => setForm((current) => ({ ...current, sourceOrReason: event.target.value }))} placeholder={form.type === 'income' ? 'e.g. Donation, membership fee' : 'e.g. Office rent, stationery'} required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="finance-note">Note (optional)</label>
                <textarea id="finance-note" maxLength="1000" rows="3" className="input-field" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Transaction'}
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

export default ManageIncomeExpenses;
