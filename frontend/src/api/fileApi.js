import apiClient from './apiClient';
import API_BASE_URL, { ENDPOINTS } from './config';

export const fetchFiles = async (project_id) => {
    if (!project_id) {
        return [];
    }
    try {
        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.FETCH_FILES}?project_id=${project_id}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching files:', error);
        throw error;
    }
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

export const deleteFiles = async (ids) => {
    try {
        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.DELETE_FILES}`, {
            method: 'DELETE',
            body: JSON.stringify({ ids }),
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error deleting files:', error);
        throw error;
    }
};

export const fetchFile = async (fileId) => {
    try {
        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.FETCH_FILES}${fileId}/fetch/`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching file:', error);
        throw error;
    }
};

export const updateFile = async (fileId, content) => {
    try {
        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.FETCH_FILES}${fileId}/update-file/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating file:', error);
        throw error;
    }
};
