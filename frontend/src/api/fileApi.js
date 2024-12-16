import API_BASE_URL from './config';

export const fetchFiles = () => {
    return fetch(`${API_BASE_URL}/testfiles/`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
};

export const uploadFiles = (formData) => {
    return fetch(`${API_BASE_URL}/testfiles/upload/`, {
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
    return fetch(`${API_BASE_URL}/testfiles/delete-bulk/`, {
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
