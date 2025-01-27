import API_BASE_URL, { ENDPOINTS } from './config';

export const fetchTestErrorsByGlobalReports = (globalReportIds) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.TESTERRORS}?global_reports_ids=${globalReportIds.join(',')}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
};
