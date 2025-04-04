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

export const updateFile = async (fileId, content, options = {}) => {
    try {
        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.FETCH_FILES}${fileId}/update-file/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content,
                ignore_validation_errors: options.ignoreValidationErrors
            }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating file:', error);
        throw error;
    }
};

export const createFile = async (content, projectId, options = {}) => {
    try {
        const formData = new FormData();
        const blob = new Blob([content], { type: 'application/x-yaml' });
        formData.append('file', blob, 'newfile.yaml');
        formData.append('project', projectId);
        formData.append('ignore_validation_errors', options.ignoreValidationErrors ? 'true' : 'false');

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

export const fetchTemplate = async () => {
    try {
        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.FETCH_FILES}template/`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching template:', error);
        throw error;
    }
};

export const validateYamlOnServer = async (content) => {
    try {
        const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.VALIDATE_YAML}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error validating YAML on server:', error);
        return {
            valid: false,
            errors: [{ message: 'Failed to validate YAML on server' }]
        };
    }
};

export const generateProfiles = async (projectId, params = {}) => {
    try {
        const response = await apiClient(`${API_BASE_URL}/generate-profiles/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                project_id: projectId,
                conversations: params.conversations || 5,
                turns: params.turns || 5
            }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error starting profile generation:', error);
        throw error;
    }
};

export const checkGenerationStatus = async (taskId) => {
    try {
        const response = await apiClient(`${API_BASE_URL}/generation-status/${taskId}/`);
        return await response.json();
    } catch (error) {
        console.error('Error checking generation status:', error);
        throw error;
    }
};
