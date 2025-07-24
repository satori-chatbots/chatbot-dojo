import API_BASE_URL, { ENDPOINTS } from "./config";
import apiClient from "./api-client";

export const submitSignUp = async (data) => {
  try {
    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.REGISTER}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Format error messages from Django response
      const errorMessage = Object.entries(errorData)
        .map(
          ([field, errors]) =>
            `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`,
        )
        .join("\n");
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    // Save token to localStorage
    localStorage.setItem("token", responseData.token);
    return responseData;
  } catch (error) {
    console.error("Error during signup:", error);
    throw error;
  }
};

export const submitLogin = async (data) => {
  try {
    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.LOGIN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = Object.entries(errorData)
        .map(
          ([field, errors]) =>
            `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`,
        )
        .join("\n");
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    // Save token to localStorage
    localStorage.setItem("token", responseData.token);
    return responseData;
  } catch (error) {
    console.error("Error during login:", error);
    throw error;
  }
};

export const updateUserProfile = async (data) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.UPDATE_PROFILE}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error("Error during profile update:", error);
    throw error;
  }
};

export const validateToken = async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;

    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.VALIDATE_TOKEN}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // If token is invalid, remove it from localStorage
      localStorage.removeItem("token");
      return false;
    }

    const data = await response.json();
    return data.valid;
  } catch (error) {
    console.error("Token validation failed:", error);
    localStorage.removeItem("token");
    return false;
  }
};

// Get all API keys for the current user
export const getUserApiKeys = async () => {
  try {
    const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.APIKEYS}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching API keys:", error);
    throw error;
  }
};

// Create a new API key
export const createApiKey = async (data) => {
  try {
    const response = await apiClient(`${API_BASE_URL}${ENDPOINTS.APIKEYS}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error("Error creating API key:", error);
    throw error;
  }
};

// Update an existing API key
export const updateApiKey = async (id, data) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.APIKEYS}${id}/`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error("Error updating API key:", error);
    throw error;
  }
};

// Delete an API key
export const deleteApiKey = async (id) => {
  try {
    await apiClient(`${API_BASE_URL}${ENDPOINTS.APIKEYS}${id}/`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Error deleting API key:", error);
    throw error;
  }
};
