const API_BASE_URL = 'http://localhost:8000';
const MEDIA_URL = `${API_BASE_URL}/filevault/`;

export const ENDPOINTS = {
    FETCH_FILES: '/testfiles/',
    UPLOAD_FILES: '/testfiles/upload/',
    DELETE_FILES: '/testfiles/delete-bulk/',
    EXECUTE_TEST: '/execute-selected/',
    FETCH_TEST_CASES: '/testcases/',
    PROJECTS: '/projects/',
    CHATBOTTECHNOLOGIES: '/chatbottechnologies/',
    TECHNOLOGIES_CHOICES: '/chatbottechnologies/choices/',
    GLOBALREPORTS: '/globalreports/',
    TESTERRORS: '/testerrors/',
    CHECK_TEST_CASE_NAME: '/testcases/check-name/',
    CHECK_PROJECT_NAME: '/projects/check-name/',
    CHECK_CHATBOT_NAME: '/chatbottechnologies/check-name/',
    PROFILERPORTS: '/profilereports/',
};

export default API_BASE_URL;
export { MEDIA_URL };
