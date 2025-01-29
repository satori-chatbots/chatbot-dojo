import API_BASE_URL, { ENDPOINTS } from './config';

export const fetchGlobalReportsByTestCases = (testCaseIds) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.GLOBALREPORTS}?test_cases_ids=${testCaseIds.join(',')}`)
        .then(response => {
            if (!response.ok) {
                const errorData = response.json();
                throw new Error(JSON.stringify(errorData));
            }
            return response.json();
        });
};

export const fetchGlobalReportsByTestCase = (testCaseId) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.GLOBALREPORTS}?test_case_id=${testCaseId}`)
        .then(response => {
            if (!response.ok) {
                const errorData = response.json();
                throw new Error(JSON.stringify(errorData));
            }
            return response.json();
        });
};
