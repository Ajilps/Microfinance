import React, { useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import AuthContext from '../../context/auth-context';
import PasswordInput, { PasswordStrengthMeter } from '../../components/PasswordInput';

// ─── Strong Password Validation Schema ────────────────────────────────────────
const strongPasswordSchema = yup
  .string()
  .required('Password is required')
  .min(8, 'Password must be at least 8 characters')
  .matches(/[A-Z]/, 'Must include at least one uppercase letter')
  .matches(/[a-z]/, 'Must include at least one lowercase letter')
  .matches(/[0-9]/, 'Must include at least one number')
  .matches(/[!@#$%^&*(),.?":{}|<>_\-+=]/, 'Must include at least one special character');

const schema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .required('Full name is required'),
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: strongPasswordSchema,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password'), null], 'Passwords do not match')
    .required('Please confirm your password'),
});

const Register = () => {
  const {
    register: registerForm,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // Watch password to feed into strength meter
  const watchedPassword = watch('password', '');

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const payload = { name: data.name, email: data.email, password: data.password };
      const response = await api.post('/users/register', payload);
      const { token, ...userData } = response.data;

      login(userData, token);
      toast.success('Account created successfully. Welcome! 🎉');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="auth-header">
        <img src="/Icon.png" alt="MicroFinance Logo" className="auth-logo-img" />
        <h1>Create Account</h1>
        <p>Join our microfinance community</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Name */}
        <div className="input-group">
          <label className="input-label" htmlFor="reg-name">Full Name</label>
          <input
            id="reg-name"
            type="text"
            className="input-field"
            placeholder="John Doe"
            autoComplete="name"
            {...registerForm('name')}
          />
          {errors.name && <p className="error-text">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div className="input-group">
          <label className="input-label" htmlFor="reg-email">Email Address</label>
          <input
            id="reg-email"
            type="email"
            className="input-field"
            placeholder="you@example.com"
            autoComplete="email"
            {...registerForm('email')}
          />
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        {/* Password with eye icon + strength meter */}
        <div className="input-group">
          <label className="input-label" htmlFor="reg-password">Password</label>
          <PasswordInput
            id="reg-password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            {...registerForm('password')}
          />
          {errors.password && <p className="error-text">{errors.password.message}</p>}
          {/* Live password strength meter */}
          <PasswordStrengthMeter password={watchedPassword} />
        </div>

        {/* Confirm Password with eye icon */}
        <div className="input-group">
          <label className="input-label" htmlFor="reg-confirm">Confirm Password</label>
          <PasswordInput
            id="reg-confirm"
            placeholder="Repeat your password"
            autoComplete="new-password"
            {...registerForm('confirmPassword')}
          />
          {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          id="register-submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '1.25rem', padding: '0.875rem' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={{
                width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', display: 'inline-block'
              }} />
              Creating account...
            </span>
          ) : 'Create Account'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <p style={{ color: '#64748b' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Login here
          </Link>
        </p>
      </div>
    </>
  );
};

export default Register;
