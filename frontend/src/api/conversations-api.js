import API_BASE_URL, { ENDPOINTS } from "./config";

export const fetchConversationsByProfileReports = (profileReportIds) => {
  return fetch(
    `${API_BASE_URL}${ENDPOINTS.CONVERSATIONS}?profile_report_ids=${profileReportIds.join(",")}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};

export const fetchConversationsByProfileReport = (profileReportId) => {
  return fetch(
    `${API_BASE_URL}${ENDPOINTS.CONVERSATIONS}?profile_report_id=${profileReportId}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};
