import API_BASE_URL, { ENDPOINTS } from './config';

export const fetchProjects = () => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.PROJECTS}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
}

export const fetchProject = (id) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.PROJECTS}${id}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
}

export const createProject = (project) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.PROJECTS}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(project),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
}

export const deleteProject = (id) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.PROJECTS}${id}/`, {
        method: 'DELETE',
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.status;
        });
}

export const updateProject = (id, project) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.PROJECTS}${id}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(project),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
}

export const checkProjectName = (name) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.CHECK_PROJECT_NAME}?project_name=${name}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
}
