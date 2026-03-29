import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    const fetchAdminDashboard = async () => {
      const errs = [];

      const [usersRes, loansRes, savingsRes] = await Promise.allSettled([
        api.get('/admin/users'),
        api.get('/admin/loans'),
        api.get('/admin/savings'),
      ]);

      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data);
      else errs.push('Users: ' + (usersRes.reason?.response?.data?.message || usersRes.reason?.message));

      if (loansRes.status === 'fulfilled') setLoans(loansRes.value.data);
      else errs.push('Loans: ' + (loansRes.reason?.response?.data?.message || loansRes.reason?.message));

      if (savingsRes.status === 'fulfilled') setSavings(savingsRes.value.data);
      else errs.push('Savings: ' + (savingsRes.reason?.response?.data?.message || savingsRes.reason?.message));

      setErrors(errs);
      setLoading(false);
    };

    fetchAdminDashboard();
  }, []);

  if (loading) return <div className="spinner"></div>;

  const totalLoans = loans.reduce((acc, l) => acc + (l.totalDisbursed || 0), 0);
  const totalRepayments = loans.reduce((acc, l) => acc + (l.totalPrincipalRepaid || 0), 0);
  const totalCurrentBalance = loans.reduce((acc, l) => acc + (l.totalOutstanding || 0), 0);
  const totalSavingsAmount = savings.reduce((acc, s) => acc + (s.totalSavings || 0), 0);

  return (
    <div>
      <div className="flex-between mb-4">
        <h2>Admin Dashboard Overview</h2>
      </div>

      {errors.length > 0 && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <strong>Some data failed to load:</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            {errors.map((e, i) => <li key={i} style={{ color: '#991b1b', fontSize: '0.875rem' }}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-title">Total Members</div>
          <div className="stat-value" style={{ color: 'var(--primary-color)' }}>{users.length}</div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>Registered users</p>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Savings Pool</div>
          <div className="stat-value" style={{ color: 'var(--secondary-color)' }}>
            ₹{totalSavingsAmount.toFixed(2)}
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>{savings.length} active savers</p>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Loans Disbursed</div>
          <div className="stat-value">₹{totalLoans.toFixed(2)}</div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>Principal repaid: ₹{totalRepayments.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Outstanding (P + I)</div>
          <div className="stat-value" style={{ color: totalCurrentBalance > 0 ? 'var(--danger)' : '#10b981' }}>
            ₹{totalCurrentBalance.toFixed(2)}
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>{loans.length} members with loans</p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4">Quick Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/admin/users" className="btn btn-primary" style={{ flex: 1, minWidth: 150 }}>👥 Manage Users</Link>
          <Link to="/admin/loans" className="btn btn-primary" style={{ flex: 1, minWidth: 150, background: '#f59e0b' }}>💰 Loan Management</Link>
          <Link to="/admin/savings" className="btn btn-secondary" style={{ flex: 1, minWidth: 150 }}>🏦 Savings Management</Link>
          <Link to="/admin/attendance" className="btn btn-primary" style={{ flex: 1, minWidth: 150, background: '#10b981' }}>📋 Mark Attendance</Link>
        </div>
      </div>

      {users.length > 0 && (
        <div className="table-container" style={{ marginTop: '2rem' }}>
          <h3 style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', margin: 0 }}>Recent Members</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 5).map(user => (
                <tr key={user._id}>
                  <td style={{ fontWeight: 500 }}>{user.name}</td>
                  <td>{user.email}</td>
                  <td><span className="badge badge-success">{user.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
