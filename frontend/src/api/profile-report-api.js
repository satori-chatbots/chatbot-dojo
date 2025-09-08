import API_BASE_URL, { ENDPOINTS } from "./config";

export const fetchProfileReportByGlobalReportId = (globalReportId) => {
  return fetch(
    `${API_BASE_URL}${ENDPOINTS.PROFILE_REPORTS}?global_report_id=${globalReportId}`,
  ).then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};
