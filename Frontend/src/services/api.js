import axios from "axios";

// Ensure the base URL matches the backend API endpoint

const API_BASE_URL = import.meta.env.VITE_DEV
  ? "http://localhost:4000/api"
  : import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Configure Axios Request Interceptor to attach the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for handling common errors globally
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and handle unauthorized error
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Potential redirect to login if required: window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
