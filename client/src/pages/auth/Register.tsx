import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Shield, Mail, Lock, User, Building, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useEffect } from 'react';

const schema = yup.object().shape({
    fullName: yup.string().required('Full Name is required').min(2, 'Must be at least 2 characters').max(100, 'Must be at most 100 characters'),
    email: yup.string().required('Email Address is required').email('Must be a valid email'),
    organizationName: yup.string().required('Organization name is required'),
    password: yup.string()
        .required('Password is required')
        .min(8, 'Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain at least 1 uppercase, 1 lowercase & 1 number'),
    role: yup.string().required('Role is required').oneOf(['admin', 'manager', 'officer'], 'Invalid role')
});

type RegisterFormData = yup.InferType<typeof schema>;

const Register = () => {
    const navigate = useNavigate();
    const { register: registerAction, isLoading, error, clearError } = useAuthStore();

    const {
        register,
        handleSubmit,
        formState: { errors, isValid },
    } = useForm<RegisterFormData>({
        resolver: yupResolver(schema),
        mode: 'onChange', // To validate as the user types
        defaultValues: {
            role: 'admin'
        }
    });

    useEffect(() => {
        // Clear global error when component mounts
        clearError();
    }, [clearError]);

    const onSubmit = async (data: RegisterFormData) => {
        try {
            await registerAction(data);
            navigate('/dashboard');
        } catch (err) {
            // Error is handled in the store
        }
    };

    return (
        <div className="auth-layout" style={{ padding: '4rem 2rem' }}>
            {/* Decorative Blobs */}
            <div className="auth-blob-1"></div>
            <div className="auth-blob-2"></div>

            <div className="auth-card" style={{ maxWidth: '540px' }}>
                <div className="auth-header">
                    <div className="auth-logo">
                        <Shield size={28} />
                    </div>
                    <h1>Create Account</h1>
                    <p>Set up your microfinance organization profile</p>
                </div>

                {error && (
                    <div className="error-message">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label htmlFor="fullName">Full Name</label>
                            <User className="input-icon" size={20} />
                            <input
                                type="text"
                                id="fullName"
                                className={`form-control ${errors.fullName ? 'has-error' : ''}`}
                                placeholder="John Doe"
                                {...register('fullName')}
                            />
                            {errors.fullName && <p className="error-text" style={{ color: 'red', fontSize: '0.85rem', marginTop: '4px' }}>{errors.fullName.message}</p>}
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
                    </div>

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
                        {!errors.password && <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                            Must be at least 8 characters with 1 uppercase, 1 lowercase & 1 number
                        </small>}
                    </div>

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label htmlFor="role">Role</label>
                        <select
                            id="role"
                            className={`form-control ${errors.role ? 'has-error' : ''}`}
                            {...register('role')}
                            style={{ width: '100%', paddingLeft: '1rem' }}
                        >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="officer">Loan Officer</option>
                        </select>
                        {errors.role && <p className="error-text" style={{ color: 'red', fontSize: '0.85rem', marginTop: '4px' }}>{errors.role.message}</p>}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading || !isValid}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
                        {!isLoading && <ArrowRight size={20} />}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account? <Link to="/login">Sign in here</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
