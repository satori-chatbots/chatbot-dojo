import API_BASE_URL, { ENDPOINTS } from "./config";

export const fetchProfileReportByGlobalReportId = (globalReportId) => {
  return fetch(
    `${API_BASE_URL}${ENDPOINTS.PROFILERPORTS}?global_report_id=${globalReportId}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};
