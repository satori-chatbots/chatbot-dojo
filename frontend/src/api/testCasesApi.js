import API_BASE_URL, { ENDPOINTS } from './config';

export const executeTest = async (testFileIds, projectId) => {
    try {
        const response = await fetch(`${API_BASE_URL}${ENDPOINTS.EXECUTE_TEST}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ test_file_ids: testFileIds, project_id: projectId }),
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
