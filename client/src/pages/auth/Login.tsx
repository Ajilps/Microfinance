import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Shield, Mail, Lock, Building, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

const Login = () => {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuthStore();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        organizationId: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        if (error) clearError();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(formData);
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

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="organizationId">Organization ID</label>
                        <Building className="input-icon" size={20} />
                        <input
                            type="text"
                            id="organizationId"
                            name="organizationId"
                            className="form-control"
                            placeholder="Enter org ID (e.g., 65a...)"
                            value={formData.organizationId}
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
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading || !formData.email || !formData.password || !formData.organizationId}
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
