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

export const uploadFiles = async (formData) => {
    try {
        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.UPLOAD_FILES}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error uploading files:', error);
        throw error;
    }
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

export const createFile = async (content, projectId) => {
    try {
        const formData = new FormData();
        const blob = new Blob([content], { type: 'application/x-yaml' });
        formData.append('file', blob, 'newfile.yaml');
        formData.append('project', projectId);

        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.UPLOAD_FILES}`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating file:', error);
        throw error;
    }
};
