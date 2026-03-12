import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Shield, Mail, Lock, User, Building, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

const Register = () => {
    const navigate = useNavigate();
    const { register, isLoading, error, clearError } = useAuthStore();

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        organizationId: '',
        role: 'admin' // default for registration
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        if (error) clearError();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await register(formData);
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

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label htmlFor="fullName">Full Name</label>
                            <User className="input-icon" size={20} />
                            <input
                                type="text"
                                id="fullName"
                                name="fullName"
                                className="form-control"
                                placeholder="John Doe"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <Mail className="input-icon" size={20} />
                            <input
                                type="email"
                                id="email"
                                name="email"
                                className="form-control"
                                placeholder="admin@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="organizationId">Organization ID</label>
                        <Building className="input-icon" size={20} />
                        <input
                            type="text"
                            id="organizationId"
                            name="organizationId"
                            className="form-control"
                            placeholder="Provide an organization ID"
                            value={formData.organizationId}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <Lock className="input-icon" size={20} />
                        <input
                            type="password"
                            id="password"
                            name="password"
                            className="form-control"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                            Must be at least 8 characters with 1 uppercase, 1 lowercase & 1 number
                        </small>
                    </div>

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label htmlFor="role">Role</label>
                        <select
                            id="role"
                            name="role"
                            className="form-control"
                            value={formData.role}
                            onChange={handleChange}
                            style={{ width: '100%', paddingLeft: '1rem' }}
                        >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="officer">Loan Officer</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading || !formData.email || !formData.password || !formData.organizationId || !formData.fullName}
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
