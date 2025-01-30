import API_BASE_URL, { ENDPOINTS } from './config';

export const fetchTestErrorsByGlobalReports = (globalReportIds) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.TESTERRORS}?global_reports_ids=${globalReportIds.join(',')}`)
        .then(response => {
            if (!response.ok) {
                const errorData = response.json();
                throw new Error(JSON.stringify(errorData));
            }
            return response.json();
        });
};

export const fetchTestErrorByGlobalReport = (globalReportId) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.TESTERRORS}?global_report_id=${globalReportId}`)
        .then(response => {
            if (!response.ok) {
                const errorData = response.json();
                throw new Error(JSON.stringify(errorData));
            }
            return response.json();
        });
};

export const fetchTestErrorByTestReports = (testReportIds) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.TESTERRORS}?test_report_ids=${testReportIds.join(',')}`)
        .then(response => {
            if (!response.ok) {
                const errorData = response.json();
                throw new Error(JSON.stringify(errorData));
            }
            return response.json();
        });
}

export const fetchTestErrorByTestReport = (testReportId) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.TESTERRORS}?test_report_id=${testReportId}`)
        .then(response => {
            if (!response.ok) {
                const errorData = response.json();
                throw new Error(JSON.stringify(errorData));
            }
            return response.json();
        });
}
