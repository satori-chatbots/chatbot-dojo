// Use relative URLs - nginx will handle routing in both development and production

const API_BASE_URL = globalThis.location.origin;
const API_PATH = "/api";
const MEDIA_URL = `${API_BASE_URL}/filevault/`;

export const ENDPOINTS = {
  FETCH_FILES: `${API_PATH}/testfiles/`,
  UPLOAD_FILES: `${API_PATH}/testfiles/upload/`,
  SENSEI_CHECK_RULES: `${API_PATH}/senseicheckrules/`,
  UPLOAD_SENSEI_CHECK_RULES: `${API_PATH}/senseicheckrules/upload/`,
  EXECUTE_SENSEI_CHECK: `${API_PATH}/execute-sensei-check/`,
  DELETE_FILES: `${API_PATH}/testfiles/delete-bulk/`,
  EXECUTE_TEST: `${API_PATH}/execute-selected/`,
  FETCH_TEST_CASES: `${API_PATH}/testcases/`,
  PROJECTS: `${API_PATH}/projects/`,
  CHATBOTCONNECTOR: `${API_PATH}/chatbotconnectors/`,
  CONNECTORS_CHOICES: `${API_PATH}/chatbotconnectors/choices/`,
  CONNECTORS_AVAILABLE: `${API_PATH}/chatbotconnectors/available/`,
  CONNECTORS_PARAMETERS: `${API_PATH}/chatbotconnectors/parameters/`,
  GLOBALREPORTS: `${API_PATH}/globalreports/`,
  TESTERRORS: `${API_PATH}/testerrors/`,
  CHECK_TEST_CASE_NAME: `${API_PATH}/testcases/check-name/`,
  CHECK_PROJECT_NAME: `${API_PATH}/projects/check-name/`,
  CHECK_CHATBOT_NAME: `${API_PATH}/chatbotconnectors/check-name/`,
  PROFILE_REPORTS: `${API_PATH}/profilereports/`,
  CONVERSATIONS: `${API_PATH}/conversations/`,
  STOP_TEST_EXECUTION: `${API_PATH}/test-cases-stop/`,
  REGISTER: `${API_PATH}/register/`,
  LOGIN: `${API_PATH}/login/`,
  APIKEYS: `${API_PATH}/api-keys/`,
  UPDATE_PROFILE: `${API_PATH}/update-profile/`,
  VALIDATE_YAML: `${API_PATH}/validate-yaml/`,
  LLM_MODELS: `${API_PATH}/llm-models/`,
  LLM_PROVIDERS: `${API_PATH}/llm-providers/`,
  SENSEI_EXECUTION_STATUS: `${API_PATH}/sensei-execution-status/`,
  GENERATE_PROFILES: `${API_PATH}/generate-profiles/`,
  VALIDATE_TOKEN: `${API_PATH}/validate-token/`,
  TRACER_GENERATION_STATUS: `${API_PATH}/tracer-generation-status/`,
  ONGOING_GENERATION: `${API_PATH}/ongoing-generation/`,
  PROFILE_EXECUTIONS: `${API_PATH}/profile-executions/`,
  DELETE_PROFILE_EXECUTION: `${API_PATH}/profile-execution/`,
  TRACER_EXECUTIONS: `${API_PATH}/tracer-executions/`,
  TRACER_ANALYSIS_REPORT: `${API_PATH}/tracer-analysis-report/`,
  TRACER_WORKFLOW_GRAPH: `${API_PATH}/tracer-workflow-graph/`,
  TRACER_ORIGINAL_PROFILES: `${API_PATH}/tracer-original-profiles/`,
  TRACER_EXECUTION_LOGS: `${API_PATH}/tracer-execution-logs/`,
};

export default API_BASE_URL;
export { MEDIA_URL };
