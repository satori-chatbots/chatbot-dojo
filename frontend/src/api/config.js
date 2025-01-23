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
};

export default API_BASE_URL;
export { MEDIA_URL };
