import API_BASE_URL, { ENDPOINTS } from './config';

export const fetchFiles = () => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.FETCH_FILES}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
};

export const uploadFiles = (formData) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.UPLOAD_FILES}`, {
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

export const deleteFiles = (ids) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.DELETE_FILES}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
};
