import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import moment from 'moment';
import Pagination from '../../components/Pagination';

const ITEMS_PER_PAGE = 10;

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'user', password: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      toast.error('Failed to load users: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('User deleted successfully');
      setUsers(prev => prev.filter(u => u._id !== id));
      setCurrentPage(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role, password: '' });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await api.put(`/admin/users/${editUser._id}`, editForm);
      toast.success('User updated successfully');
      setUsers(prev => prev.map(u => u._id === editUser._id ? { ...u, ...res.data } : u));
      setEditUser(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) return <div className="spinner"></div>;

  const paginatedUsers = users.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div>
      <div className="flex-between mb-4">
        <h2>Manage Users</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge badge-info" style={{ fontSize: '1rem', padding: '0.4rem 1rem' }}>{users.length} members</span>
          <AddUserButton onUserAdded={(newUser) => {
            setUsers(prev => [newUser, ...prev]);
            setCurrentPage(1);
          }} />
        </div>
      </div>

      {users.length === 0 ? (
        <div className="card">
          <p style={{ color: '#64748b' }}>No users found. Add a user using the button above, or users can register via the Register page.</p>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(user => (
                  <tr key={user._id}>
                    <td style={{ fontWeight: 500 }}>{user.name}</td>
                    <td style={{ color: '#64748b' }}>{user.email}</td>
                    <td>
                      <span className={`badge badge-${user.role === 'admin' ? 'info' : 'success'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{moment(user.createdAt).format('MMM Do YYYY')}</td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="badge badge-info"
                        style={{ border: 'none', cursor: 'pointer', padding: '0.35rem 0.75rem' }}
                        onClick={() => openEdit(user)}
                      >
                        Edit
                      </button>
                      <button
                        className="badge badge-danger"
                        style={{ border: 'none', cursor: 'pointer', padding: '0.35rem 0.75rem' }}
                        onClick={() => handleDelete(user._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={users.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <Modal title={`Edit User: ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form onSubmit={handleEditSubmit}>
            <div className="input-group">
              <label className="input-label">Name</label>
              <input
                type="text"
                className="input-field"
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                type="email"
                className="input-field"
                value={editForm.email}
                onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Role</label>
              <select
                className="input-field"
                value={editForm.role}
                onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
               <div className="input-group">
              <label className="input-label">New Password (leave blank to keep current)</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter new password to change"
                value={editForm.password}
                onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditUser(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

/* ─── Add User Button + Modal ─────────────────────────────────────── */
const AddUserButton = ({ onUserAdded }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setForm({ name: '', email: '', password: '', role: 'user' });
    setShowPassword(false);
  };

  const handleClose = () => {
    reset();
    setOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/admin/users', form);
      toast.success(`User "${res.data.name}" created successfully!`);
      onUserAdded(res.data);
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-primary"
        style={{ gap: '0.4rem', padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
        onClick={() => setOpen(true)}
        id="add-user-btn"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
        Add User
      </button>

      {open && (
        <Modal title="Add New User" onClose={handleClose}>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. John Doe"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="e.g. john@example.com"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    padding: '0.25rem', display: 'flex', alignItems: 'center'
                  }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Role</label>
              <select
                className="input-field"
                value={form.role}
                onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
              >
                <option value="user">Member (User)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {/* Role hint */}
            <p style={{
              fontSize: '0.78rem', color: 'var(--text-muted)',
              marginTop: '-0.75rem', marginBottom: '1.25rem',
              padding: '0.6rem 0.85rem',
              background: 'var(--surface-3)',
              borderRadius: 'var(--r-sm)',
              borderLeft: '3px solid var(--primary)'
            }}>
              {form.role === 'admin'
                ? '⚠️ Admin accounts have full access to the admin panel.'
                : '👤 Members can log in and view their own data only.'}
            </p>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={submitting}
                id="confirm-add-user-btn"
              >
                {submitting ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={handleClose}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

/* ─── Shared Modal Wrapper ────────────────────────────────────────── */
const Modal = ({ title, onClose, children }) => (
  <div
    style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
      animation: 'fadeIn 0.18s ease'
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--r-xl)',
      padding: '2rem',
      width: '100%',
      maxWidth: '460px',
      boxShadow: 'var(--shadow-xl)',
      animation: 'fadeUp 0.22s var(--ease-out) both',
      position: 'relative',
      maxHeight: '90vh',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button
          onClick={onClose}
          style={{
            background: 'var(--surface-3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', width: '30px', height: '30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)',
            transition: 'all 0.15s ease'
          }}
          aria-label="Close modal"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default ManageUsers;
