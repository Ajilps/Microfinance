import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface User {
    _id: string;
    email: string;
    fullName: string;
    role: string;
    organizationId: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (credentials: any) => Promise<void>;
    register: (userData: any) => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (credentials) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post('/auth/login', credentials);
                    const { user, token } = response.data.data;
                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false
                    });
                } catch (error: any) {
                    set({
                        isLoading: false,
                        error: error.response?.data?.message || 'Login failed'
                    });
                    throw error;
                }
            },

            register: async (userData) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post('/auth/register', userData);
                    const { user, token } = response.data.data;
                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false
                    });
                } catch (error: any) {
                    console.error(error.response?.data)
                    let errMsg = error.response?.data?.message || 'Registration failed';
                    if (error.response?.data?.errors) {
                        errMsg = error.response.data.errors[0]?.msg || errMsg;
                    }
                    set({
                        isLoading: false,
                        error: errMsg
                    });
                    throw error;
                }
            },

            logout: async () => {
                set({ isLoading: true });
                try {
                    await api.post('/auth/logout');
                } catch (error) {
                    console.error('Logout failed:', error);
                } finally {
                    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            // We only persist the auth token and user data
            partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
        }
    )
);
