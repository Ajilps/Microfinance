import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Shield, Mail, Lock, Building, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useEffect } from 'react';

const schema = yup.object().shape({
    organizationName: yup.string().required('Organization name is required'),
    email: yup.string().required('Email Address is required').email('Must be a valid email'),
    password: yup.string().required('Password is required')
});

type LoginFormData = yup.InferType<typeof schema>;

const Login = () => {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuthStore();

    const {
        register,
        handleSubmit,
        formState: { errors, isValid },
    } = useForm<LoginFormData>({
        resolver: yupResolver(schema),
        mode: 'onChange' // To validate as the user types
    });

    useEffect(() => {
        // Clear global error when component mounts
        clearError();
    }, [clearError]);

    const onSubmit = async (data: LoginFormData) => {
        try {
            await login(data);
            navigate('/dashboard');
        } catch (err) {
            // Error is handled in the store
        }
    };

    return (
        <div className="auth-layout">
            {/* Decorative Blobs */}
            <div className="auth-blob-1"></div>
            <div className="auth-blob-2"></div>

            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">
                        <Shield size={28} />
                    </div>
                    <h1>Welcome Back</h1>
                    <p>Secure access to your microfinance dashboard</p>
                </div>

                {error && (
                    <div className="error-message">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="form-group">
                        <label htmlFor="organizationName">Organization Name</label>
                        <Building className="input-icon" size={20} />
                        <input
                            type="text"
                            id="organizationName"
                            className={`form-control ${errors.organizationName ? 'has-error' : ''}`}
                            placeholder="Enter organization name"
                            {...register('organizationName')}
                        />
                        {errors.organizationName && <p className="error-text" style={{ color: 'red', fontSize: '0.85rem', marginTop: '4px' }}>{errors.organizationName.message}</p>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <Mail className="input-icon" size={20} />
                        <input
                            type="email"
                            id="email"
                            className={`form-control ${errors.email ? 'has-error' : ''}`}
                            placeholder="admin@example.com"
                            {...register('email')}
                        />
                        {errors.email && <p className="error-text" style={{ color: 'red', fontSize: '0.85rem', marginTop: '4px' }}>{errors.email.message}</p>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <Lock className="input-icon" size={20} />
                        <input
                            type="password"
                            id="password"
                            className={`form-control ${errors.password ? 'has-error' : ''}`}
                            placeholder="••••••••"
                            {...register('password')}
                        />
                        {errors.password && <p className="error-text" style={{ color: 'red', fontSize: '0.85rem', marginTop: '4px' }}>{errors.password.message}</p>}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading || !isValid}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
                        {!isLoading && <ArrowRight size={20} />}
                    </button>
                </form>

                <div className="auth-footer">
                    Don't have an account? <Link to="/register">Create Organization</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
