import API_BASE_URL, { ENDPOINTS } from './config';
import apiClient from './apiClient';

export const fetchProjects = async () => {
    const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.PROJECTS}`, {
        method: 'GET'
    });
    return response.json();
};

export const fetchProject = async (id) => {
    const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.PROJECTS}${id}/`);
    return response.json();
};

export const createProject = async (project) => {
    const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.PROJECTS}`, {
        method: 'POST',
        body: JSON.stringify(project)
    });
    return response.json();
};

export const updateProject = async (id, project) => {
    const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.PROJECTS}${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(project)
    });
    return response.json();
};

export const deleteProject = async (id) => {
    const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.PROJECTS}${id}/`, {
        method: 'DELETE'
    });
    return response.status;
};

export const checkProjectName = async (name) => {
    const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.CHECK_PROJECT_NAME}?project_name=${name}`);
    return response.json();
};
