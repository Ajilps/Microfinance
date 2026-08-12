import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import moment from 'moment';
import Pagination from '../../components/Pagination';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];
const STATUS_LABELS = { present: '✓ Present', absent: '✗ Absent', late: '⏰ Late', leave: '🌿 Leave' };
const STATUS_COLORS = {
  present: { bg: '#dcfce7', color: '#166534' },
  absent: { bg: '#fee2e2', color: '#991b1b' },
  late: { bg: '#fef3c7', color: '#92400e' },
  leave: { bg: '#e0e7ff', color: '#3730a3' },
};

const ITEMS_PER_PAGE = 12;

const ManageAttendance = () => {
  const [activeTab, setActiveTab] = useState('mark');

  // ─── Mark tab state ───────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(moment().format('YYYY-MM-DD'));
  const [records, setRecords] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Monthly + Fines tab state ────────────────────────────────────────────────
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyReport, setMonthlyReport] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // ─── All-time report state ───────────────────────────────────────────────────
  const [allReport, setAllReport] = useState([]);
 

  // ─── Fine form state ──────────────────────────────────────────────────────────
  const [fineUserId, setFineUserId] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [finePaidOn, setFinePaidOn] = useState(moment().format('YYYY-MM-DD'));
  const [fineNote, setFineNote] = useState('');
  const [submittingFine, setSubmittingFine] = useState(false);

  // ─── Pagination state ─────────────────────────────────────────────────────────
  const [markPage, setMarkPage] = useState(1);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [finesPage, setFinesPage] = useState(1);

  // ─── Fetch users ──────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/admin/users');
      const memberUsers = res.data; // already filtered to role: "user" by backend
      setUsers(memberUsers);
      // Initialize records object
      const init = {};
      memberUsers.forEach(u => { init[u._id] = { status: 'present', note: '' }; });
      setRecords(init);
    } catch (err) {
      toast.error('Failed to load users: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // ─── Fetch monthly report ─────────────────────────────────────────────────────
  const fetchMonthlyReport = useCallback(async (m, y) => {
    setLoadingReport(true);
    setMonthlyReport([]);
    try {
      const res = await api.get(`/admin/attendance/monthly?month=${m}&year=${y}`);
      setMonthlyReport(res.data.summary || []);
    } catch (err) {
      toast.error('Failed to load monthly report: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingReport(false);
    }
  }, []);

  // ─── Fetch All Time report ───────────────────────────────────────────────────
  const fetchAllReport = useCallback(async () => {
    setLoadingReport(true);
    setAllReport([]);
    setAllPage(1);
    try {
      const res = await api.get('/admin/attendance/all');
      setAllReport(res.data.summary || []);
    } catch (err) {
      toast.error('Failed to load all-time report: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingReport(false);
    }
  }, []);
  // ─── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'mark') {
      fetchUsers();
    } else if (activeTab === 'all') {
      fetchAllReport();
    } else {
      fetchMonthlyReport(month, year);
      if (activeTab === 'fines' && users.length === 0) fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Refresh monthly report when month/year changes (only on those tabs)
  useEffect(() => {
    if (activeTab === 'monthly' || activeTab === 'fines') {
      fetchMonthlyReport(month, year);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  // ─── Attendance handlers ──────────────────────────────────────────────────────
  const handleStatusChange = (userId, status) => {
    setRecords(prev => ({ ...prev, [userId]: { ...prev[userId], status } }));
  };
  const handleNoteChange = (userId, note) => {
    setRecords(prev => ({ ...prev, [userId]: { ...prev[userId], note } }));
  };

  const submitAttendance = async () => {
    if (users.length === 0) {
      toast.warn('No users to mark attendance for.');
      return;
    }
    setSubmitting(true);
    try {
      const formattedRecords = users.map(u => ({
        userId: u._id,
        status: records[u._id]?.status || 'present',
        note: records[u._id]?.note || '',
      }));

      await api.post('/admin/attendance', {
        attendanceDate: moment(attendanceDate).toISOString(),
        weekStartDay: 1,  // 1 = Monday
        records: formattedRecords,
      });
      toast.success('Attendance marked successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── CSV Download ─────────────────────────────────────────────────────────────
  const downloadCSV = async (scope = 'monthly') => {
    setDownloadingReport(true);
    try {
      const isAllTime = scope === 'all';
      const response = await api.get(
        isAllTime ? '/admin/attendance/download/all' : '/admin/attendance/download',
        {
          params: isAllTime ? undefined : { month, year },
          responseType: 'blob',
        },
      );
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = isAllTime
        ? 'attendance-all-time.csv'
        : `attendance-${month}-${year}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download attendance report');
    } finally {
      setDownloadingReport(false);
    }
  };

  // ─── Fine submit ──────────────────────────────────────────────────────────────
  const submitFine = async (e) => {
    e.preventDefault();
    if (!fineUserId) { toast.warn('Please select a user'); return; }
    if (!fineAmount || Number(fineAmount) < 1) { toast.warn('Enter a valid amount'); return; }

    setSubmittingFine(true);
    try {
      await api.post('/admin/attendance/fine/payment', {
        userId: fineUserId,
        amount: parseFloat(fineAmount),
        month: parseInt(month),
        year: parseInt(year),
        paidOn: moment(finePaidOn).toISOString(),
        note: fineNote,
      });
      toast.success('Fine payment recorded');
      setFineAmount('');
      setFineNote('');
      setFineUserId('');
      fetchMonthlyReport(month, year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record fine payment');
    } finally {
      setSubmittingFine(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const tabStyle = (tab) => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    cursor: 'pointer',
    background: activeTab === tab ? 'var(--primary-color)' : '#e2e8f0',
    color: activeTab === tab ? 'white' : '#475569',
    transition: 'all 0.2s',
  });

  // Paginated slices
  const paginatedUsers = users.slice((markPage - 1) * ITEMS_PER_PAGE, markPage * ITEMS_PER_PAGE);
  const paginatedMonthly = monthlyReport.slice((monthlyPage - 1) * ITEMS_PER_PAGE, monthlyPage * ITEMS_PER_PAGE);
  const paginatedAll = allReport.slice((allPage - 1) * ITEMS_PER_PAGE, allPage * ITEMS_PER_PAGE);
  const finesData = monthlyReport.filter(r => r.fineOwed > 0 || r.totalPaid > 0);
  const paginatedFines = finesData.slice((finesPage - 1) * ITEMS_PER_PAGE, finesPage * ITEMS_PER_PAGE);

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex-between mb-4">
        <h2>Attendance Management</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button style={tabStyle('mark')} onClick={() => setActiveTab('mark')}>📋 Mark Weekly</button>
          <button style={tabStyle('monthly')} onClick={() => setActiveTab('monthly')}>📅 Monthly Report</button>
          <button style={tabStyle('all')} onClick={() => setActiveTab('all')}>📈 All Time Report</button>
          <button style={{ ...tabStyle('fines'), background: activeTab === 'fines' ? '#ef4444' : '#e2e8f0', color: activeTab === 'fines' ? 'white' : '#475569' }}
            onClick={() => setActiveTab('fines')}>💸 Manage Fines</button>
        </div>
      </div>

      {/* ─── MARK TAB ──────────────────────────────────────────────────────────── */}
      {activeTab === 'mark' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <h3 style={{ margin: 0 }}>Mark Weekly Attendance</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                System uses the selected date to determine the week
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontWeight: 600, color: '#475569' }}>Meeting Date:</label>
              <input
                type="date"
                className="input-field"
                style={{ padding: '0.5rem' }}
                value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
              />
            </div>
          </div>

          {loadingUsers ? <div className="spinner"></div> : users.length === 0 ? (
            <p style={{ color: '#64748b' }}>No members found. Register users first.</p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table" style={{ marginBottom: '1.5rem' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Member</th>
                      <th>Status</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user, idx) => (
                      <tr key={user._id}>
                        <td style={{ color: '#94a3b8' }}>{(markPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{user.name}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {STATUS_OPTIONS.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleStatusChange(user._id, s)}
                                style={{
                                  padding: '0.3rem 0.7rem',
                                  border: '2px solid',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  borderColor: records[user._id]?.status === s ? STATUS_COLORS[s].color : '#cbd5e1',
                                  background: records[user._id]?.status === s ? STATUS_COLORS[s].bg : 'transparent',
                                  color: records[user._id]?.status === s ? STATUS_COLORS[s].color : '#94a3b8',
                                }}
                              >
                                {STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Optional note"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
                            value={records[user._id]?.note || ''}
                            onChange={e => handleNoteChange(user._id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={markPage}
                totalItems={users.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setMarkPage}
              />
              <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={submitAttendance} disabled={submitting}>
                  {submitting ? 'Saving...' : `✓ Save Attendance for ${moment(attendanceDate).format('MMM Do YYYY')}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── MONTHLY REPORT TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'monthly' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                value={month}
                onChange={e => { setMonth(Number(e.target.value)); setMonthlyPage(1); }}
                className="input-field"
                style={{ padding: '0.5rem' }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{moment().month(m - 1).format('MMMM')}</option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={e => { setYear(Number(e.target.value)); setMonthlyPage(1); }}
                className="input-field"
                style={{ width: '90px', padding: '0.5rem' }}
              />
            </div>
            <button
              className="btn"
              style={{ background: '#1c2833', color: 'white' }}
              onClick={() => downloadCSV('monthly')}
              disabled={downloadingReport}
            >
              {downloadingReport ? 'Preparing...' : '⬇ Download CSV'}
            </button>
          </div>

          {loadingReport ? <div className="spinner"></div> : monthlyReport.length === 0 ? (
            <p style={{ color: '#64748b' }}>No attendance records found for {moment().month(month - 1).format('MMMM')} {year}.</p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Weeks</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late / Leave</th>
                      <th>Fine Owed</th>
                      <th>Fine Paid</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMonthly.map(r => (
                      <tr key={r.userId}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.email}</div>
                        </td>
                        <td>{r.totalWeeks}</td>
                        <td style={{ color: 'var(--secondary-color)', fontWeight: 600 }}>{r.present}</td>
                        <td style={{ color: r.absent > 0 ? 'var(--danger)' : 'inherit' }}>{r.absent}</td>
                        <td>{r.late} / {r.leave}</td>
                        <td>₹{(r.fineOwed || 0).toFixed(2)}</td>
                        <td style={{ color: 'var(--primary-color)' }}>₹{(r.totalPaid || 0).toFixed(2)}</td>
                        <td style={{ color: r.balance > 0 ? 'var(--danger)' : '#10b981', fontWeight: 600 }}>
                          ₹{(r.balance || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={monthlyPage}
                totalItems={monthlyReport.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setMonthlyPage}
              />
            </>
          )}
        </div>
      )}
  {/* ─── ALL time REPORT TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'all' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <h3 style={{ margin: 0 }}>All-Time Attendance Summary</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Attendance and fine totals from the first recorded meeting through today.
              </p>
            </div>
            <button
              className="btn"
              style={{ background: '#1c2833', color: 'white' }}
              onClick={() => downloadCSV('all')}
              disabled={downloadingReport}
            >
              {downloadingReport ? 'Preparing...' : '⬇ Download All-Time CSV'}
            </button>
          </div>

          {loadingReport ? <div className="spinner"></div> : allReport.length === 0 ? (
            <p style={{ color: '#64748b' }}>No attendance records found.</p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Weeks</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late / Leave</th>
                      <th>Fine Owed</th>
                      <th>Fine Paid</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAll.map(r => (
                      <tr key={r.userId}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.email}</div>
                        </td>
                        <td>{r.totalWeeks}</td>
                        <td style={{ color: 'var(--secondary-color)', fontWeight: 600 }}>{r.present}</td>
                        <td style={{ color: r.absent > 0 ? 'var(--danger)' : 'inherit' }}>{r.absent}</td>
                        <td>{r.late} / {r.leave}</td>
                        <td>₹{(r.fineOwed || 0).toFixed(2)}</td>
                        <td style={{ color: 'var(--primary-color)' }}>₹{(r.totalPaid || 0).toFixed(2)}</td>
                        <td style={{ color: r.balance > 0 ? 'var(--danger)' : '#10b981', fontWeight: 600 }}>
                          ₹{(r.balance || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={allPage}
                totalItems={allReport.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setAllPage}
              />
            </>
          )}
        </div>
      )}
      {/* ─── FINES TAB ───────────────────────────────────────────────────────────── */}
      {activeTab === 'fines' && (
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Record Fine Form */}
          <div className="card" style={{ flex: 1, minWidth: '280px' }}>
            <h3 className="mb-4">Record Fine Payment</h3>
            <form onSubmit={submitFine}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Month</label>
                  <select value={month} onChange={e => { setMonth(Number(e.target.value)); setFinesPage(1); }} className="input-field" style={{ padding: '0.5rem' }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{moment().month(m - 1).format('MMMM')}</option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 90 }}>
                  <label className="input-label">Year</label>
                  <input type="number" value={year} onChange={e => { setYear(Number(e.target.value)); setFinesPage(1); }} className="input-field" style={{ padding: '0.5rem' }} />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Select Member *</label>
                <select
                  className="input-field"
                  value={fineUserId}
                  onChange={e => setFineUserId(e.target.value)}
                  required
                >
                  <option value="">— Choose Member —</option>
                  {(monthlyReport.length > 0 ? monthlyReport : users.map(u => ({ userId: u._id, name: u.name, balance: null }))).map(u => (
                    <option key={u.userId} value={u.userId}>
                      {u.name}{u.balance != null ? ` (Bal: ₹${(u.balance).toFixed(2)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Amount Paid (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="input-field"
                  placeholder="e.g. 20"
                  value={fineAmount}
                  onChange={e => setFineAmount(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Paid On *</label>
                <input
                  type="date"
                  className="input-field"
                  value={finePaidOn}
                  onChange={e => setFinePaidOn(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Note</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Paid cash at meeting"
                  value={fineNote}
                  onChange={e => setFineNote(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-danger" style={{ width: '100%' }} disabled={submittingFine}>
                {submittingFine ? 'Recording...' : '💸 Record Fine Payment'}
              </button>
            </form>
          </div>

          {/* Outstanding Fines Table */}
          <div className="card" style={{ flex: 2, minWidth: '300px' }}>
            <div className="flex-between mb-4">
              <h3 style={{ margin: 0 }}>
                Fine Summary — {moment().month(month - 1).format('MMMM')} {year}
              </h3>
            </div>

            {loadingReport ? <div className="spinner"></div> : (
              <>
                {finesData.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No fine data for this month. Mark attendance first to generate fines.</p>
                ) : (
                  <>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Member</th>
                            <th>Fine Owed</th>
                            <th>Paid</th>
                            <th>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedFines.map(r => (
                            <tr key={r.userId}>
                              <td style={{ fontWeight: 500 }}>{r.name}</td>
                              <td>₹{(r.fineOwed || 0).toFixed(2)}</td>
                              <td style={{ color: 'var(--primary-color)' }}>₹{(r.totalPaid || 0).toFixed(2)}</td>
                              <td>
                                <span className={`badge badge-${r.balance > 0 ? 'danger' : 'success'}`}>
                                  ₹{(r.balance || 0).toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      currentPage={finesPage}
                      totalItems={finesData.length}
                      itemsPerPage={ITEMS_PER_PAGE}
                      onPageChange={setFinesPage}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAttendance;
