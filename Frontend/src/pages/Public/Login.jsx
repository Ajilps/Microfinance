import React, { useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import AuthContext from '../../context/auth-context';
import PasswordInput from '../../components/PasswordInput';

// Validation Schema — login only needs email + non-empty password
const schema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .required('Password is required'),
});

const Login = () => {
  const {
    register: registerForm,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/users/login', data);
      const { token, ...userData } = response.data;

      login(userData, token);
      toast.success(`Welcome back, ${userData.name}! 👋`);

      if (userData.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="auth-header">
        <img src="/Icon.png" alt="MicroFinance Logo" className="auth-logo-img" />
        <h1>Welcome Back</h1>
        <p>Login to manage your microfinance account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Email */}
        <div className="input-group">
          <label className="input-label" htmlFor="login-email">
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            className="input-field"
            placeholder="you@example.com"
            autoComplete="email"
            {...registerForm('email')}
          />
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        {/* Password with eye toggle */}
        <div className="input-group">
          <label className="input-label" htmlFor="login-password">
            Password
          </label>
          <PasswordInput
            id="login-password"
            placeholder="Enter your password"
            autoComplete="current-password"
            {...registerForm('password')}
          />
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          id="login-submit"
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
              Logging in...
            </span>
          ) : 'Login'}
        </button>
      </form>
{/* user public registration is disabled */}
      {/* <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <p style={{ color: '#64748b' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Create account
          </Link>
        </p>
      </div> */}
    </>
  );
};

export default Login;
