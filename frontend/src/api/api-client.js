const apiClient = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  // Only add Authorization header if token is available
  if (token) {
    defaultHeaders.Authorization = `Token ${token}`;
  }

  // Remove Content-Type header if body is FormData (fixes upload file issue)
  if (options.body instanceof FormData) {
    delete defaultHeaders["Content-Type"];
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("currentProject");

    // Redirect to login page if session expired
    if (token) {
      globalThis.location.href = "/login";
      throw new Error("Session expired. Please login again.");
    }
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(JSON.stringify(errorData));
  }

  return response;
};

export default apiClient;

export const fetchLLMProviders = async () => {
  try {
    const response = await apiClient(`${API_BASE_URL}/llm-providers/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch LLM providers: ${response.status}`);
    }
    const data = await response.json();
    return data.providers;
  } catch (error) {
    console.error("Error fetching LLM providers:", error);
    throw error;
  }
};

export const fetchLLMModels = async (provider) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}/llm-models/?provider=${provider}`,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch LLM models for ${provider}: ${response.status}`,
      );
    }
    const data = await response.json();
    return data.models;
  } catch (error) {
    console.error("Error fetching LLM models:", error);
    throw error;
  }
};
