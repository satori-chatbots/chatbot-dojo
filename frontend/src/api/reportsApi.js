import API_BASE_URL, { ENDPOINTS } from './config';

export const fetchGlobalReportsByTestCases = (testCaseIds) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.GLOBALREPORTS}?test_cases_ids=${testCaseIds.join(',')}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
};
