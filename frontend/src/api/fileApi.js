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
        .then(async (response) => {
            const data = await response.json();
            if (!response.ok) {
                const errorMessage =
                    data.error ||
                    (data.errors && data.errors.map(e => e.error).join(', ')) ||
                    `HTTP error! Status: ${response.status}`;
                throw new Error(errorMessage);
            }
            return data;
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
