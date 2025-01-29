import API_BASE_URL, { ENDPOINTS } from './config';

export const executeTest = async (testFileIds, projectId, testName) => {
    try {
        const response = await fetch(`${API_BASE_URL}${ENDPOINTS.EXECUTE_TEST}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ test_file_ids: testFileIds, project_id: projectId, test_name: testName }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error || 'Error executing test';
            throw new Error(errorMessage);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
};

export const fetchTestCases = () => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.FETCH_TEST_CASES}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
};

export const fetchTestCasesByProjects = (projectIds) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.FETCH_TEST_CASES}?project_ids=${projectIds.join(',')}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
};

export const checkTestCaseName = (projectId, name) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.CHECK_TEST_CASE_NAME}?project_id=${projectId}&test_name=${name}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
}

export const fetchTestCaseById = (testCaseId) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.FETCH_TEST_CASES}?testcase_id=${testCaseId}`)
        .then(response => {
            if (!response.ok) {
                const errorData = response.json();
                throw new Error(JSON.stringify(errorData));
            }
            return response.json();
        });
}
