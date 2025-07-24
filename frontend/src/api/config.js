// Use relative URLs - nginx will handle routing in both development and production
const API_BASE_URL = globalThis.location.origin;
const MEDIA_URL = `${API_BASE_URL}/filevault/`;

export const ENDPOINTS = {
  FETCH_FILES: "/api/testfiles/",
  UPLOAD_FILES: "/api/testfiles/upload/",
  DELETE_FILES: "/api/testfiles/delete-bulk/",
  EXECUTE_TEST: "/api/execute-selected/",
  FETCH_TEST_CASES: "/api/testcases/",
  PROJECTS: "/api/projects/",
  CHATBOTCONNECTOR: "/api/chatbotconnectors/",
  CONNECTORS_CHOICES: "/api/chatbotconnectors/choices/",
  GLOBALREPORTS: "/api/globalreports/",
  TESTERRORS: "/api/testerrors/",
  CHECK_TEST_CASE_NAME: "/api/testcases/check-name/",
  CHECK_PROJECT_NAME: "/api/projects/check-name/",
  CHECK_CHATBOT_NAME: "/api/chatbotconnectors/check-name/",
  PROFILERPORTS: "/api/profilereports/",
  CONVERSATIONS: "/api/conversations/",
  STOP_TEST_EXECUTION: "/api/test-cases-stop/",
  REGISTER: "/api/register/",
  LOGIN: "/api/login/",
  APIKEYS: "/api/api-keys/",
  UPDATE_PROFILE: "/api/update-profile/",
  VALIDATE_YAML: "/api/validate-yaml/",
  LLM_MODELS: "/api/llm-models/",
  LLM_PROVIDERS: "/api/llm-providers/",
  SENSEI_EXECUTION_STATUS: "/api/sensei-execution-status/",
  GENERATE_PROFILES: "/api/generate-profiles/",
  VALIDATE_TOKEN: "/api/validate-token/",
  TRACER_GENERATION_STATUS: "/api/tracer-generation-status/",
  ONGOING_GENERATION: "/api/ongoing-generation/",
  PROFILE_EXECUTIONS: "/api/profile-executions/",
  DELETE_PROFILE_EXECUTION: "/api/profile-execution/",
  TRACER_EXECUTIONS: "/api/tracer-executions/",
  TRACER_ANALYSIS_REPORT: "/api/tracer-analysis-report/",
  TRACER_WORKFLOW_GRAPH: "/api/tracer-workflow-graph/",
  TRACER_ORIGINAL_PROFILES: "/api/tracer-original-profiles/",
  TRACER_EXECUTION_LOGS: "/api/tracer-execution-logs/",
};

export default API_BASE_URL;
export { MEDIA_URL };
