import apiClient from "./api-client";
import API_BASE_URL, { ENDPOINTS } from "./config";

export const fetchFiles = async (project_id) => {
  if (!project_id) {
    return [];
  }
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.FETCH_FILES}?project_id=${project_id}`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching files:", error);
    throw error;
  }
};

export const fetchSenseiCheckRules = async (project_id) => {
  if (!project_id) {
    return [];
  }
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.SENSEI_CHECK_RULES}?project_id=${project_id}`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching SENSEI Check rules:", error);
    throw error;
  }
};

export const uploadFiles = async (formData) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.UPLOAD_FILES}`,
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error uploading files:", error);
    throw error;
  }
};

export const uploadSenseiCheckRules = async (formData) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.UPLOAD_SENSEI_CHECK_RULES}`,
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error uploading SENSEI Check rules:", error);
    throw error;
  }
};

export const deleteSenseiCheckRule = async (id) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.SENSEI_CHECK_RULES}${id}/`,
      {
        method: "DELETE",
      },
    );
    return response;
  } catch (error) {
    console.error("Error deleting SENSEI Check rule:", error);
    throw error;
  }
};

export const fetchSenseiCheckRule = async (id) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.SENSEI_CHECK_RULES}${id}/`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching SENSEI Check rule:", error);
    throw error;
  }
};

export const updateSenseiCheckRule = async (
  id,
  content,
  projectId,
  options = {},
) => {
  try {
    const formData = new FormData();
    const blob = new Blob([content], { type: "application/x-yaml" });
    formData.append("file", blob, "rule.yaml");
    formData.append("project", projectId);
    formData.append(
      "ignore_validation_errors",
      options.ignoreValidationErrors ? "true" : "false",
    );

    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.SENSEI_CHECK_RULES}${id}/`,
      {
        method: "PUT",
        body: formData,
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error updating SENSEI Check rule:", error);
    throw error;
  }
};

export const createSenseiCheckRule = async (
  content,
  projectId,
  options = {},
) => {
  try {
    const formData = new FormData();
    const blob = new Blob([content], { type: "application/x-yaml" });
    formData.append("file", blob, "rule.yaml");
    formData.append("project", projectId);
    formData.append(
      "ignore_validation_errors",
      options.ignoreValidationErrors ? "true" : "false",
    );

    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.UPLOAD_SENSEI_CHECK_RULES}`,
      {
        method: "POST",
        body: formData,
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error creating SENSEI Check rule:", error);
    throw error;
  }
};

export const toggleSenseiCheckRuleActive = async (ruleId, active) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.SENSEI_CHECK_RULES}${ruleId}/toggle-active/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ active }),
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error toggling SENSEI Check rule active state:", error);
    throw error;
  }
};

export const deleteFiles = async (ids) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.DELETE_FILES}`,
      {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      },
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error deleting files:", error);
    throw error;
  }
};

export const fetchFile = async (fileId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.FETCH_FILES}${fileId}/fetch/`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching file:", error);
    throw error;
  }
};

export const updateFile = async (fileId, content, options = {}) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.FETCH_FILES}${fileId}/update-file/`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          ignore_validation_errors: options.ignoreValidationErrors,
        }),
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error updating file:", error);
    throw error;
  }
};

export const createFile = async (content, projectId, options = {}) => {
  try {
    const formData = new FormData();
    const blob = new Blob([content], { type: "application/x-yaml" });
    formData.append("file", blob, "newfile.yaml");
    formData.append("project", projectId);
    formData.append(
      "ignore_validation_errors",
      options.ignoreValidationErrors ? "true" : "false",
    );

    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.UPLOAD_FILES}`,
      {
        method: "POST",
        body: formData,
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error creating file:", error);
    throw error;
  }
};

export const fetchTemplate = async () => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.FETCH_FILES}template/`,
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching template:", error);
    throw error;
  }
};

export const fetchSenseiCheckRuleTemplate = async () => {
  // Return a basic template - this can be enhanced later when the backend
  // provides a specific template endpoint. There's no async work here so a
  // try/catch is unnecessary and can make linting tools think the catch is
  // unreachable.
  return {
    template: `# Sensei Check Rule Configuration
# Define your validation rule here

name: example_rule
description: Example validation rule
active: True
conversations: 1
oracle: conversation_length() == conversation_length('assistant') + conversation_length('user')

# Adjust the rule parameters as needed
# - name: unique identifier for the rule
# - description: brief description of what the rule validates
# - active: True/False to enable/disable the rule
# - conversations: number of conversations to validate
# - oracle: the validation logic
`,
  };
};

export const validateYamlOnServer = async (content) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.VALIDATE_YAML}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error validating YAML on server:", error);
    return {
      valid: false,
      errors: [{ message: "Failed to validate YAML on server" }],
    };
  }
};

export const generateProfiles = async (projectId, parameters = {}) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.GENERATE_PROFILES}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: projectId,
          sessions: parameters.sessions || 3,
          turns_per_session: parameters.turns_per_session || 8,
          verbosity: parameters.verbosity || "normal",
        }),
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error starting profile generation:", error);
    throw error;
  }
};

export const checkOngoingGeneration = async (projectId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.ONGOING_GENERATION}${projectId}/`,
    );
    return await response.json();
  } catch (error) {
    console.error("Error checking ongoing generation:", error);
    throw error;
  }
};

export const checkTracerGenerationStatus = async (celeryTaskId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.TRACER_GENERATION_STATUS}${celeryTaskId}/`,
    );
    return await response.json();
  } catch (error) {
    console.error("Error checking TRACER generation status:", error);
    throw error;
  }
};

export const fetchProfileExecutions = async (projectId) => {
  if (!projectId) {
    return { executions: [] };
  }
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.PROFILE_EXECUTIONS}${projectId}/`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching profile executions:", error);
    throw error;
  }
};

export const deleteProfileExecution = async (executionId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.DELETE_PROFILE_EXECUTION}${executionId}/delete/`,
      {
        method: "DELETE",
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error deleting profile execution:", error);
    throw error;
  }
};

// TRACER Dashboard API functions
export const fetchTracerExecutions = async () => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.TRACER_EXECUTIONS}`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching TRACER executions:", error);
    throw error;
  }
};

export const fetchTracerAnalysisReport = async (executionId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.TRACER_ANALYSIS_REPORT}${executionId}/`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching TRACER analysis report:", error);
    throw error;
  }
};

export const fetchTracerWorkflowGraph = async (executionId, format) => {
  try {
    let url = `${API_BASE_URL}${ENDPOINTS.TRACER_WORKFLOW_GRAPH}${executionId}/`;
    if (format) {
      url += `?graph_format=${format}`;
    }
    const response = await apiClient(url);

    // If a format is requested, it's for download, so we expect a blob.
    if (format) {
      return response.blob();
    }
    // Otherwise, it's the initial load for the viewer, which expects JSON with inline SVG.
    return response.json();
  } catch (error) {
    console.error("Error fetching TRACER workflow graph:", error);
    throw error;
  }
};

export const fetchTracerOriginalProfiles = async (executionId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.TRACER_ORIGINAL_PROFILES}${executionId}/`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching TRACER original profiles:", error);
    throw error;
  }
};

// Fetch TRACER execution logs
export const fetchTracerExecutionLogs = async (executionId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.TRACER_EXECUTION_LOGS}${executionId}/`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching TRACER execution logs:", error);
    throw error;
  }
};

// Execute SENSEI Check on selected test cases
export const executeSenseiCheck = async (
  projectId,
  testCaseIds,
  verbose = false,
) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.EXECUTE_SENSEI_CHECK}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: projectId,
          test_case_ids: testCaseIds,
          verbose: verbose,
        }),
      },
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error executing SENSEI Check:", error);
    throw error;
  }
};
