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
                .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
                .join('\n');
            throw new Error(errorMessage);
        }

        return await response.json();
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
                .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
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
