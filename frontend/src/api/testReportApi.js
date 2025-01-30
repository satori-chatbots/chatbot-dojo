import API_BASE_URL, { ENDPOINTS } from './config';


export const fetchTestReportByGlobalReportId = (globalReportId) => {
    return fetch(`${API_BASE_URL}${ENDPOINTS.TESTREPORTS}?global_report_id=${globalReportId}`)
        .then(response => {
            if (!response.ok) {
                const errorData = response.json();
                throw new Error(JSON.stringify(errorData));
            }
            return response.json();
        });
}
