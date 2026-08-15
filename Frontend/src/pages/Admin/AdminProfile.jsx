import { useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import PasswordInput, { PasswordStrengthMeter } from '../../components/PasswordInput';
import AuthContext from '../../context/auth-context';
import api from '../../services/api';

const EMPTY_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const passwordIsStrong = (value) =>
  value.length >= 8
  && /[A-Z]/.test(value)
  && /[a-z]/.test(value)
  && /[0-9]/.test(value)
  && /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(value);

const sessionFromResponse = (data) => {
  const { token } = data;
  const admin = { ...data };
  delete admin.token;
  delete admin.message;
  return { admin, token };
};

const AdminProfile = () => {
  const { login } = useContext(AuthContext);
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [account, setAccount] = useState(null);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const response = await api.get('/admin/profile');
        if (!active) return;
        setAccount(response.data);
        setProfile({ name: response.data.name || '', email: response.data.email || '' });
      } catch (error) {
        if (active) {
          toast.error(error.response?.data?.message || 'Failed to load admin profile');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => { active = false; };
  }, []);

  const updateProfileField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const updatePasswordField = (field, value) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    if (profile.name.trim().length < 2) {
      toast.warn('Name must contain at least 2 characters');
      return;
    }
    if (!profile.email.trim()) {
      toast.warn('Email address is required');
      return;
    }

    setSavingProfile(true);
    try {
      const response = await api.put('/admin/profile', {
        name: profile.name.trim(),
        email: profile.email.trim(),
      });
      const { admin, token } = sessionFromResponse(response.data);
      login(admin, token);
      setAccount(admin);
      setProfile({ name: admin.name, email: admin.email });
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (!passwordForm.currentPassword) {
      toast.warn('Enter your current password');
      return;
    }
    if (!passwordIsStrong(passwordForm.newPassword)) {
      toast.warn('The new password must meet all password requirements');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.warn('New password and confirmation do not match');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await api.put('/admin/profile/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      const { admin, token } = sessionFromResponse(response.data);
      login(admin, token);
      setAccount(admin);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <div className="spinner" aria-label="Loading admin profile" />;

  return (
    <div className="admin-profile-page">
      <div className="page-header">
        <h2>Admin Profile</h2>
        <p>Manage your account details and keep your administrator login secure.</p>
      </div>

      <div className="admin-profile-summary card">
        <div className="admin-profile-summary__avatar" aria-hidden="true">
          {(account?.name || 'A').charAt(0).toUpperCase()}
        </div>
        <div>
          <h3>{account?.name || 'Admin'}</h3>
          <p>{account?.email}</p>
          <span className="badge badge-success">Administrator</span>
        </div>
      </div>

      <div className="admin-profile-grid">
        <form className="card admin-profile-card" onSubmit={submitProfile}>
          <div className="admin-profile-card__header">
            <div className="admin-profile-card__icon" aria-hidden="true">👤</div>
            <div>
              <h3>Profile details</h3>
              <p>This name appears beside records created or updated by you.</p>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="admin-profile-name">Admin name *</label>
            <input
              id="admin-profile-name"
              className="input-field"
              type="text"
              minLength="2"
              maxLength="100"
              autoComplete="name"
              required
              value={profile.name}
              onChange={(event) => updateProfileField('name', event.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="admin-profile-email">Email address *</label>
            <input
              id="admin-profile-email"
              className="input-field"
              type="email"
              maxLength="254"
              autoComplete="email"
              required
              value={profile.email}
              onChange={(event) => updateProfileField('email', event.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </form>

        <form className="card admin-profile-card" onSubmit={submitPassword}>
          <div className="admin-profile-card__header">
            <div className="admin-profile-card__icon admin-profile-card__icon--security" aria-hidden="true">🔐</div>
            <div>
              <h3>Change password</h3>
              <p>Your current password is required before a new one can be set.</p>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="admin-current-password">Current password *</label>
            <PasswordInput
              id="admin-current-password"
              autoComplete="current-password"
              placeholder="Enter current password"
              required
              value={passwordForm.currentPassword}
              onChange={(event) => updatePasswordField('currentPassword', event.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="admin-new-password">New password *</label>
            <PasswordInput
              id="admin-new-password"
              autoComplete="new-password"
              placeholder="Enter a strong new password"
              required
              value={passwordForm.newPassword}
              onChange={(event) => updatePasswordField('newPassword', event.target.value)}
            />
            <PasswordStrengthMeter password={passwordForm.newPassword} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="admin-confirm-password">Confirm new password *</label>
            <PasswordInput
              id="admin-confirm-password"
              autoComplete="new-password"
              placeholder="Re-enter the new password"
              required
              value={passwordForm.confirmPassword}
              onChange={(event) => updatePasswordField('confirmPassword', event.target.value)}
            />
            {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <div className="error-text">Passwords do not match.</div>
            )}
          </div>

          <div className="admin-profile-security-note">
            Changing your password signs out every other browser or device. This device stays signed in securely.
          </div>

          <button className="btn btn-secondary" type="submit" disabled={savingPassword}>
            {savingPassword ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminProfile;
