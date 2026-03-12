import axios from 'axios';

// Create an Axios instance with base URL and credentials
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
    withCredentials: true, // Send cookies with requests
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor to handle 401 Unauthorized globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Clear local storage / Zustand state if needed 
            // when the session expires
            // Since Zustand is external to this file, we might handle it in the store
        }
        return Promise.reject(error);
    }
);

export default api;
