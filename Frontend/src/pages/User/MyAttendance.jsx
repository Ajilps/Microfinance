import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import moment from 'moment';
import Pagination from '../../components/Pagination';
import sortNewestFirst from '../../utils/sortNewestFirst';

const ITEMS_PER_PAGE = 10;

const MyAttendance = () => {
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [weeklyPage, setWeeklyPage] = useState(1);
  const [finePage, setFinePage] = useState(1);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/attendance/me?month=${month}&year=${year}`);
      setAttendanceData(response.data);
      setError(null);
      setWeeklyPage(1);
      setFinePage(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch attendance information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const handleMonthChange = (e) => setMonth(e.target.value);
  const handleYearChange = (e) => setYear(e.target.value);

  const weeklyRecords = sortNewestFirst(attendanceData?.weeklyRecords || [], 'attendanceDate');
  const finePayments = sortNewestFirst(attendanceData?.finePayments || [], 'paidOn');

  const paginatedWeekly = weeklyRecords.slice(
    (weeklyPage - 1) * ITEMS_PER_PAGE,
    weeklyPage * ITEMS_PER_PAGE
  );
  const paginatedFines = finePayments.slice(
    (finePage - 1) * ITEMS_PER_PAGE,
    finePage * ITEMS_PER_PAGE
  );

  return (
    <div>
      <div className="flex-between mb-4">
        <h2>My Attendance</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select value={month} onChange={handleMonthChange} className="input-field" style={{ padding: '0.5rem' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{moment().month(m - 1).format('MMMM')}</option>
            ))}
          </select>
          <input 
            type="number" 
            value={year} 
            onChange={handleYearChange} 
            className="input-field" 
            style={{ width: '100px', padding: '0.5rem' }} 
            min="2020" max="2100" 
          />
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : error ? (
        <div className="card" style={{ color: 'var(--danger)' }}>{error}</div>
      ) : !attendanceData ? (
        <div className="card">No attendance data available for this month.</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-title">Present</div>
              <div className="stat-value" style={{ color: 'var(--secondary-color)' }}>
                {attendanceData.present}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Absent</div>
              <div className="stat-value" style={{ color: attendanceData.absent > 0 ? 'var(--danger)' : '#0f172a' }}>
                {attendanceData.absent}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Late / Leave</div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>
                {attendanceData.late} / {attendanceData.leave}
              </div>
            </div>
            <div className="stat-card" style={attendanceData.fineBalance > 0 ? { borderColor: 'rgba(251, 113, 133, 0.42)' } : undefined}>
              <div className="stat-title" style={{ color: attendanceData.fineBalance > 0 ? '#991b1b' : '#64748b' }}>All-Time Fine Balance</div>
              <div className="stat-value" style={{ color: attendanceData.fineBalance > 0 ? 'var(--danger)' : '#0f172a' }}>
                ₹{attendanceData.fineBalance?.toFixed(2) || '0.00'}
              </div>
              <div className="stat-sub">
                ₹{attendanceData.allTimeFineOwed?.toFixed(2) || '0.00'} generated · ₹{attendanceData.allTimeFinePaid?.toFixed(2) || '0.00'} paid
              </div>
            </div>
          </div>

          <div className="table-container mt-4">
            <h3 style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', margin: 0 }}>Weekly Attendance Records</h3>
            {weeklyRecords.length > 0 ? (
              <>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Week Start Date</th>
                        <th>Attendance Date</th>
                        <th>Status</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedWeekly.map((record, index) => (
                        <tr key={index}>
                          <td>{moment(record.weekStartDate).format('MMMM Do YYYY')}</td>
                          <td>{moment(record.attendanceDate).format('MMMM Do YYYY')}</td>
                          <td>
                            <span className={`badge badge-${
                              record.status === 'present' ? 'success' : 
                              record.status === 'absent' ? 'danger' : 
                              record.status === 'late' ? 'warning' : 'info'
                            }`}>
                              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </span>
                          </td>
                          <td style={{ color: '#64748b' }}>{record.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={weeklyPage}
                  totalItems={weeklyRecords.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setWeeklyPage}
                />
              </>
            ) : (
              <p style={{ padding: '1.5rem', color: '#64748b' }}>No weekly records found.</p>
            )}
          </div>

          {finePayments.length > 0 && (
            <div className="table-container mt-4">
              <h3 style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', margin: 0 }}>Fine Payments</h3>
              <>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Paid On</th>
                        <th>Amount</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFines.map((payment, index) => (
                        <tr key={index}>
                          <td>{moment(payment.paidOn).format('MMMM Do YYYY h:mm A')}</td>
                          <td style={{ color: 'var(--secondary-color)', fontWeight: 500 }}>
                            ₹{payment.amount}
                          </td>
                          <td style={{ color: '#64748b' }}>{payment.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={finePage}
                  totalItems={finePayments.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setFinePage}
                />
              </>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyAttendance;
