import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { toast } from 'react-toastify';

import Pagination from '../../components/Pagination';
import api from '../../services/api';

const ITEMS_PER_PAGE = 12;

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const ManageReports = () => {
  const [reportType, setReportType] = useState('loans');
  const [scope, setScope] = useState('monthly');
  const [month, setMonth] = useState(moment().month() + 1);
  const [year, setYear] = useState(moment().year());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(1);

  const requestParams = useMemo(
    () => ({
      scope,
      ...(scope === 'monthly' ? { month, year } : {}),
    }),
    [month, scope, year],
  );

  const fetchReport = useCallback(async () => {
    if (scope === 'monthly' && (!month || !year)) return;

    setLoading(true);
    try {
      const response = await api.get(`/admin/reports/${reportType}`, {
        params: requestParams,
      });
      setReport(response.data);
      setPage(1);
    } catch (error) {
      setReport(null);
      toast.error(
        error.response?.data?.message ||
          `Failed to load the ${reportType} report`,
      );
    } finally {
      setLoading(false);
    }
  }, [month, reportType, requestParams, scope, year]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const response = await api.get(
        `/admin/reports/${reportType}/download`,
        {
          params: requestParams,
          responseType: 'blob',
        },
      );
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      const periodName =
        scope === 'all'
          ? 'all-time'
          : `${moment().month(month - 1).format('MMMM').toLowerCase()}-${year}`;

      link.href = url;
      link.download = `${reportType}-${periodName}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          `Failed to download the ${reportType} report`,
      );
    } finally {
      setDownloading(false);
    }
  };

  const rows = report?.rows || [];
  const totals = report?.totals || {};
  const paginatedRows = rows.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const selectionStyle = (selected) => ({
    border: selected ? '2px solid var(--primary-color)' : '1px solid #cbd5e1',
    background: selected ? '#ecfdf5' : 'white',
    color: selected ? '#047857' : '#475569',
  });

  const summaryCards =
    reportType === 'loans'
      ? [
          ['Distributed — Active Loans', totals.activeLoanDisbursed],
          [
            scope === 'monthly' ? 'Principal Paid in Period' : 'Total Principal Paid',
            totals.principalRepaid,
          ],
          [
            scope === 'monthly' ? 'Interest Paid in Period' : 'Total Interest Paid',
            totals.interestRepaid,
          ],
          [
            scope === 'monthly' ? 'Interest Generated in Period' : 'Total Interest Generated',
            totals.interestCharged,
          ],
          ['Unpaid Principal', totals.principalBalance],
          ['Total Outstanding', totals.totalOutstanding],
        ]
      : [
          ['Saved in Period', totals.amountSaved],
          ['Savings Balance', totals.savingsBalance],
          ['Savings Interest (1%)', totals.savingsInterest],
          ['Payments in Period', totals.paymentCount, false],
        ];

  return (
    <div>
      <div className="flex-between mb-4" style={{ alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.35rem' }}>Financial Reports</h2>
          <p style={{ color: '#64748b', margin: 0 }}>
            Review member-level activity and download complete CSV reports.
          </p>
        </div>
        <Link to="/admin/attendance" className="btn btn-secondary">
          Attendance Reports
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className="btn"
            style={selectionStyle(reportType === 'loans')}
            onClick={() => setReportType('loans')}
          >
            💳 Loan Report
          </button>
          <button
            type="button"
            className="btn"
            style={selectionStyle(reportType === 'savings')}
            onClick={() => setReportType('savings')}
          >
            🏦 Savings Report
          </button>
        </div>

        <div
          className="flex-between"
          style={{
            gap: '1rem',
            flexWrap: 'wrap',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              style={selectionStyle(scope === 'monthly')}
              onClick={() => setScope('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className="btn"
              style={selectionStyle(scope === 'all')}
              onClick={() => setScope('all')}
            >
              Till Now (All Time)
            </button>

            {scope === 'monthly' && (
              <>
                <select
                  aria-label="Report month"
                  className="input-field"
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  style={{ width: '150px', padding: '0.55rem' }}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {moment().month(value - 1).format('MMMM')}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Report year"
                  type="number"
                  min="2000"
                  max="2100"
                  className="input-field"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  style={{ width: '105px', padding: '0.55rem' }}
                />
              </>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={downloadReport}
            disabled={downloading || loading || !report}
          >
            {downloading ? 'Preparing...' : '⬇ Download CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="spinner" />
        </div>
      ) : !report ? null : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.25rem' }}>
              {reportType === 'loans' ? 'Loan' : 'Savings'} Report — {report.periodLabel}
            </h3>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>
              Balances include all activity through the end of the selected period.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            {summaryCards.map(([label, value, isMoney = true]) => (
              <div className="card" key={label} style={{ margin: 0 }}>
                <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  {label}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                  {isMoney ? formatMoney(value) : Number(value || 0)}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            {rows.length === 0 ? (
              <p style={{ color: '#64748b', margin: 0 }}>No members found.</p>
            ) : (
              <>
                <p className="report-scroll-hint">
                  ↔ Scroll horizontally to view all report columns.
                </p>
                <div
                  className="table-scroll report-table-scroll"
                  tabIndex="0"
                  aria-label="Scrollable financial report table"
                >
                  {reportType === 'loans' ? (
                    <table className="data-table report-table report-table--loans">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Transactions</th>
                          <th>Disbursed</th>
                          <th>Principal Repaid</th>
                          <th>Interest Charged</th>
                          <th>Interest Repaid</th>
                          <th>Loan Fines</th>
                          <th>Principal Balance</th>
                          <th>Interest Balance</th>
                          <th>Total Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row) => (
                          <tr key={row.userId}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{row.name}</div>
                              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{row.email}</div>
                            </td>
                            <td>{row.transactionCount}</td>
                            <td>{formatMoney(row.disbursed)}</td>
                            <td>{formatMoney(row.principalRepaid)}</td>
                            <td>{formatMoney(row.interestCharged)}</td>
                            <td>{formatMoney(row.interestRepaid)}</td>
                            <td>{formatMoney(row.finesCharged)}</td>
                            <td>{formatMoney(row.principalBalance)}</td>
                            <td>{formatMoney(row.interestBalance)}</td>
                            <td style={{ fontWeight: 700 }}>{formatMoney(row.totalOutstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="data-table report-table report-table--savings">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Payments</th>
                          <th>Saved in Period</th>
                          <th>Savings Balance</th>
                          <th>Interest (1%)</th>
                          <th>Last Paid On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row) => (
                          <tr key={row.userId}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{row.name}</div>
                              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{row.email}</div>
                            </td>
                            <td>{row.paymentCount}</td>
                            <td>{formatMoney(row.amountSaved)}</td>
                            <td style={{ fontWeight: 700 }}>{formatMoney(row.savingsBalance)}</td>
                            <td>{formatMoney(row.savingsInterest)}</td>
                            <td>{row.lastPaidOn ? moment.utc(row.lastPaidOn).format('DD MMM YYYY') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <Pagination
                  currentPage={page}
                  totalItems={rows.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ManageReports;
