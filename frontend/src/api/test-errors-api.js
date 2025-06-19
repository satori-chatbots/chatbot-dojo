import API_BASE_URL, { ENDPOINTS } from "./config";

export const fetchTestErrorsByGlobalReports = (globalReportIds) => {
  return fetch(
    `${API_BASE_URL}${ENDPOINTS.TESTERRORS}?global_reports_ids=${globalReportIds.join(",")}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};

export const fetchTestErrorByGlobalReport = (globalReportId) => {
  return fetch(
    `${API_BASE_URL}${ENDPOINTS.TESTERRORS}?global_report_id=${globalReportId}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};

export const fetchTestErrorByProfileReports = (profileReportIds) => {
  return fetch(
    `${API_BASE_URL}${ENDPOINTS.TESTERRORS}?profile_report_ids=${profileReportIds.join(",")}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};

export const fetchTestErrorByProfileReport = (profileReportId) => {
  return fetch(
    `${API_BASE_URL}${ENDPOINTS.TESTERRORS}?profile_report_id=${profileReportId}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};
