import { useAuth } from '../contexts/AuthContext';

const apiClient = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });

        if (response.status === 401) {
            // Clear storage instead of using useAuth to avoid circular dependency
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('currentProject');
            //window.location.href = '/login';
            throw new Error('Session expired. Please login again.');
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
