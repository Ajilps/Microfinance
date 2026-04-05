import React from 'react';
import { Link } from 'react-router-dom';

const ManageReports = () => {
  return (
    <div>
      <div className="flex-between mb-4">
        <h2>System Reports</h2>
      </div>

      <div className="card">
        <h3>Available Reports</h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
          More comprehensive reporting features can be added here. Currently, you can use the Attendance tab to generate monthly CSV reports.
        </p>

        <div style={{
          "display": "flex",
          "gap": "1rem",
          "flex-wrap": "wrap",
          "flex-direction": "column"
        }}>
          <Link to="/admin/attendance" className="btn btn-primary" style={{ flex: 1 }}>Go to Attendance Reports (CSV)</Link>
          <Link to="/admin/loans" className="btn btn-secondary" style={{ flex: 1 }}>View Loan Ledgers</Link>
          <Link to="/admin/savings" className="btn btn-secondary" style={{ flex: 1 }}>View Savings Summaries</Link>
        </div>
      </div>
    </div >
  );
}

export default ManageReports;
