import API_BASE_URL from './config';

export const uploadFiles = (formData) => {
    return fetch(`${API_BASE_URL}/upload/`, {
        method: 'POST',
        body: formData,
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
};
