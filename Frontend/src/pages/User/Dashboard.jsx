import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const Dashboard = () => {
  const [loanSummary, setLoanSummary] = useState(null);
  const [savingsSummary, setSavingsSummary] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const currentDate = new Date();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();

        const [loanRes, savingsRes, attendanceRes] = await Promise.all([
          api.get('/users/loans/me').catch(() => ({ data: { totalDisbursed: 0, totalOutstanding: 0, principalBalance: 0, interestBalance: 0 } })),
          api.get('/users/savings/me').catch(() => ({ data: { totalSavings: 0 } })),
          api.get(`/users/attendance/me?month=${month}&year=${year}`).catch(() => ({ data: { present: 0, absent: 0, fineOwed: 0, fineBalance: 0 } })),
        ]);

        setLoanSummary(loanRes.data);
        setSavingsSummary(savingsRes.data);
        setAttendanceSummary(attendanceRes.data);
      } catch {
        console.error("Failed to load dashboard data");
        toast.error("Error loading dashboard data. You might need to check your connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', color: '#0f172a' }}>Overview</h2>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-title">Total Outstanding</div>
          <div className="stat-value" style={{ color: (loanSummary?.totalOutstanding || 0) > 0 ? 'var(--danger)' : '#10b981' }}>
            ₹{loanSummary?.totalOutstanding?.toFixed(2) || '0.00'}
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
            Principal: ₹{loanSummary?.principalBalance?.toFixed(2) || '0.00'} · Interest: ₹{loanSummary?.interestBalance?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-title">Total Savings</div>
          <div className="stat-value" style={{ color: 'var(--secondary-color)' }}>
            ₹{savingsSummary?.totalSavings?.toFixed(2) || '0.00'}
          </div>
          <p style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '0.5rem' }}>
            {savingsSummary?.currentWeekPaid ? '✓ Paid for this week' : '⚠ Action required for this week'}
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-title">Attendance (This Month)</div>
          <div className="stat-value" style={{ color: '#0f172a' }}>
            {attendanceSummary?.present || 0} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 'normal' }}>present</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
            {attendanceSummary?.absent || 0} absent
          </p>
        </div>

        <div className="stat-card" style={{ background: attendanceSummary?.fineBalance > 0 ? '#fef2f2' : 'white' }}>
          <div className="stat-title" style={{ color: attendanceSummary?.fineBalance > 0 ? '#991b1b' : '#64748b' }}>Fine Balance</div>
          <div className="stat-value" style={{ color: attendanceSummary?.fineBalance > 0 ? 'var(--danger)' : '#0f172a' }}>
            ₹{attendanceSummary?.fineBalance?.toFixed(2) || '0.00'}
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
            Total fines this month: ₹{attendanceSummary?.fineOwed || 0}
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4">Recent Activity</h3>
        <p style={{ color: '#64748b' }}>Welcome back to the Microfinance Management System. Keep up the good work on your savings and loan repayments!</p>
      </div>
    </div>
  );
};

export default Dashboard;
