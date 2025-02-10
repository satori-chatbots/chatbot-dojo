import API_BASE_URL, { ENDPOINTS } from './config';


export const submitSignUp = async (data) => {
    try {
        const response = await fetch(`${API_BASE_URL}${ENDPOINTS.REGISTER}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            // Format error messages from Django response
            const errorMessage = Object.entries(errorData)
                .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
                .join('\n');
            throw new Error(errorMessage);
        }

        const responseData = await response.json();
        // Save token to localStorage
        localStorage.setItem('token', responseData.token);
        return responseData;
    } catch (error) {
        console.error('Error during signup:', error);
        throw error;
    }
};

export const submitLogin = async (data) => {
    try {
        const response = await fetch(`${API_BASE_URL}${ENDPOINTS.LOGIN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = Object.entries(errorData)
                .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
                .join('\n');
            throw new Error(errorMessage);
        }

        const responseData = await response.json();
        // Save token to localStorage
        localStorage.setItem('token', responseData.token);
        return responseData;
    } catch (error) {
        console.error('Error during login:', error);
        throw error;
    }
}

export const validateToken = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) return false;

        const response = await fetch(`${API_BASE_URL}/validate-token/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            // If token is invalid, remove it from localStorage
            localStorage.removeItem('token');
            return false;
        }

        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.error('Token validation failed:', error);
        localStorage.removeItem('token');
        return false;
    }
};
