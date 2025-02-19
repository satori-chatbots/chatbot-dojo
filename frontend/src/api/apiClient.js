import { useAuth } from '../contexts/AuthContext';

const apiClient = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    // Only add Authorization header if token is available
    if (token) {
        defaultHeaders.Authorization = `Token ${token}`;
    }

    // Remove Content-Type header if body is FormData (fixes upload file issue)
    if (options.body instanceof FormData) {
        delete defaultHeaders['Content-Type'];
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('currentProject');

            // Redirect to login page if session expired
            if (token) {
                window.location.href = '/login';
                throw new Error('Session expired. Please login again.');
            }
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData));
        }

        return response;
    } catch (error) {
        throw error;
    }
};

export default apiClient;
