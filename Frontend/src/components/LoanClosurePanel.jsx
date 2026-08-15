import { useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

import api from '../services/api';

const today = () => new Date().toISOString().slice(0, 10);

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const LoanClosurePanel = ({ userId, outstandingBalance = 0, onClosed }) => {
  const [closeDate, setCloseDate] = useState(today());
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  const calculateSettlement = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const response = await api.get(`/admin/loans/${userId}/close/preview`, {
        params: { closeDate },
      });
      setPreview(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to calculate the loan settlement');
    } finally {
      setLoading(false);
    }
  };

  const confirmAndClose = async () => {
    if (!preview || closing) return;
    const result = await Swal.fire({
      title: 'Close this loan?',
      html: `This records <strong>${money(preview.totalSettlement)}</strong> as fully received and closes the current loan cycle. Principal and interest balances will become ₹0.00.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Payment received — close loan',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#475569',
      background: '#0d1117',
      color: '#e4ecf8',
    });
    if (!result.isConfirmed) return;

    setClosing(true);
    try {
      const response = await api.post(`/admin/loans/${userId}/close`, {
        closeDate,
        expectedTotal: preview.totalSettlement,
        note,
      });
      toast.success('Loan closed and settlement recorded');
      setPreview(null);
      setNote('');
      await onClosed?.(response.data);
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.preview) {
        setPreview(error.response.data.preview);
      }
      toast.error(error.response?.data?.message || 'Failed to close the loan');
    } finally {
      setClosing(false);
    }
  };

  return (
    <section className="card loan-closure-panel">
      <div className="member-section-heading loan-closure-heading">
        <div>
          <h3>Close loan</h3>
          <p>Calculate the exact principal and interest settlement through the closing date.</p>
        </div>
        <span className="loan-closure-badge">Full settlement</span>
      </div>

      <div className="loan-closure-controls">
        <div className="input-group">
          <label className="input-label" htmlFor={`loan-close-date-${userId}`}>Closing date *</label>
          <input
            id={`loan-close-date-${userId}`}
            className="input-field"
            type="date"
            max={today()}
            value={closeDate}
            onChange={(event) => {
              setCloseDate(event.target.value);
              setPreview(null);
            }}
          />
        </div>
        <div className="input-group loan-closure-note">
          <label className="input-label" htmlFor={`loan-close-note-${userId}`}>Settlement note</label>
          <input
            id={`loan-close-note-${userId}`}
            className="input-field"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional receipt or payment reference"
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary loan-closure-calculate"
          disabled={loading || outstandingBalance <= 0 || !closeDate}
          onClick={calculateSettlement}
        >
          {loading ? 'Calculating…' : 'Calculate closing amount'}
        </button>
      </div>

      {outstandingBalance <= 0 && (
        <p className="loan-closure-empty">There is no unpaid loan balance to close.</p>
      )}

      {preview && (
        <div className="loan-closure-preview">
          <div><span>Principal due</span><strong>{money(preview.principalDue)}</strong></div>
          <div><span>Existing unpaid interest / fines</span><strong>{money(preview.existingInterestDue)}</strong></div>
          <div><span>Missed completed-period interest</span><strong>{money(preview.unrecordedCompletedInterest)}</strong></div>
          <div><span>Final prorated interest</span><strong>{money(preview.projectedPartialInterest)}</strong></div>
          <div className="loan-closure-total"><span>Total payment to collect</span><strong>{money(preview.totalSettlement)}</strong></div>
          <p>
            Final partial interest uses: principal at period start × 1% × elapsed days ÷ 28.
            Closing will safely apply any missed full periods first.
          </p>
          <button
            type="button"
            className="btn loan-closure-submit"
            disabled={closing}
            onClick={confirmAndClose}
          >
            {closing ? 'Closing loan…' : 'Confirm full payment and close loan'}
          </button>
        </div>
      )}
    </section>
  );
};

export default LoanClosurePanel;
