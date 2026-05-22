import API_BASE_URL, { ENDPOINTS } from "./config";

const isValidId = (value) =>
  value !== undefined && value !== null && value !== "";

const cleanIds = (ids) => ids.filter((id) => isValidId(id));

export const fetchTestErrorsByGlobalReports = (globalReportIds) => {
  const ids = cleanIds(globalReportIds);
  if (ids.length === 0) {
    return Promise.resolve([]);
  }

  return fetch(
    `${API_BASE_URL}${ENDPOINTS.TESTERRORS}?global_report_ids=${ids.join(",")}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};

export const fetchTestErrorByGlobalReport = (globalReportId) => {
  if (!isValidId(globalReportId)) {
    return Promise.resolve([]);
  }

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
  const ids = cleanIds(profileReportIds);
  if (ids.length === 0) {
    return Promise.resolve([]);
  }

  return fetch(
    `${API_BASE_URL}${ENDPOINTS.TESTERRORS}?profile_report_ids=${ids.join(",")}`,
  ).then((response) => {
    if (!response.ok) {
      const errorData = response.json();
      throw new Error(JSON.stringify(errorData));
    }
    return response.json();
  });
};

export const fetchTestErrorByProfileReport = (profileReportId) => {
  if (!isValidId(profileReportId)) {
    return Promise.resolve([]);
  }

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
