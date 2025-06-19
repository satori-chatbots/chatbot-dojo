import API_BASE_URL, { ENDPOINTS } from "./config";
import apiClient from "./apiClient";

export const executeTest = async (testFileIds, projectId, testName) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.EXECUTE_TEST}`,
      {
        method: "POST",
        body: JSON.stringify({
          test_file_ids: testFileIds,
          project_id: projectId,
          test_name: testName,
        }),
      },
    );
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const fetchTestCases = async () => {
  const response = await apiClient(
    `${API_BASE_URL}${ENDPOINTS.FETCH_TEST_CASES}`,
  );
  return response.json();
};

export const fetchTestCasesByProjects = async (projectIds) => {
  const response = await apiClient(
    `${API_BASE_URL}${ENDPOINTS.FETCH_TEST_CASES}?project_ids=${projectIds.join(",")}`,
  );
  return response.json();
};

export const checkTestCaseName = async (projectId, name) => {
  const response = await apiClient(
    `${API_BASE_URL}${ENDPOINTS.CHECK_TEST_CASE_NAME}?project_id=${projectId}&test_name=${name}`,
  );
  return response.json();
};

export const fetchTestCaseById = async (testCaseId) => {
  const response = await apiClient(
    `${API_BASE_URL}${ENDPOINTS.FETCH_TEST_CASES}?testcase_id=${testCaseId}`,
  );
  return response.json();
};

export const stopTestExecution = async (testCaseId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.STOP_TEST_EXECUTION}`,
      {
        method: "POST",
        body: JSON.stringify({ test_case_id: testCaseId }),
      },
    );
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const deleteTestCase = async (testCaseId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.FETCH_TEST_CASES}${testCaseId}/`,
      {
        method: "DELETE",
      },
    );

    if (response.status === 204 || response.status === 200) {
      return true;
    } else {
      try {
        const data = await response.json();
        return data;
      } catch (jsonError) {
        console.error("Error parsing JSON:", jsonError);
        throw new Error("Failed to parse JSON response");
      }
    }
  } catch (error) {
    throw error;
  }
};

export const fetchPaginatedTestCases = async (parameters) => {
  const queryParameters = new URLSearchParams({
    page: parameters.page,
    per_page: parameters.per_page,
    sort_column: parameters.sort_column,
    sort_direction: parameters.sort_direction,
    project_ids: parameters.project_ids,
    status: parameters.status,
    search: parameters.search,
  });

  const response = await apiClient(
    `${API_BASE_URL}${ENDPOINTS.FETCH_TEST_CASES}paginated/?${queryParameters}`,
    { method: "GET" },
  );
  return response.json();
};
