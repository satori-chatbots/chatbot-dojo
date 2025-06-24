import API_BASE_URL, { ENDPOINTS } from "./config";

const API_URL = `${API_BASE_URL}${ENDPOINTS.CHATBOTCONNECTOR}`;
const CHOICES_URL = `${API_BASE_URL}${ENDPOINTS.CONNECTORS_CHOICES}`;

export const fetchChatbotConnectors = async () => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching chatbot connectors:", error);
    throw error;
  }
};

export const createChatbotConnector = async (data) => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = Object.entries(errorData)
        .map(([field, errors]) => `${field}: ${errors.join(", ")}`)
        .join("; ");
      throw new Error(errorMessage || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating chatbot connector:", error);
    throw error;
  }
};

export const fetchTechnologyChoices = async () => {
  try {
    const response = await fetch(CHOICES_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.technology_choices;
  } catch (error) {
    console.error("Error fetching technology choices:", error);
    throw error;
  }
};

export const updateChatbotConnector = async (id, data) => {
  try {
    const response = await fetch(`${API_URL}${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = Object.entries(errorData)
        .map(([field, errors]) => `${field}: ${errors.join(", ")}`)
        .join("; ");
      throw new Error(errorMessage || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error updating chatbot connector:", error);
    throw error;
  }
};

export const deleteChatbotConnector = async (id) => {
  try {
    const response = await fetch(`${API_URL}${id}/`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    // Handle empty (204) responses
    if (response.status === 204) {
      return;
    }
    return await response.json();
  } catch (error) {
    console.error("Error deleting chatbot connector:", error);
    throw error;
  }
};

export const checkChatbotConnectorName = async (name) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${ENDPOINTS.CHECK_CHATBOT_NAME}?chatbot_name=${name}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error checking chatbot connector name:", error);
    throw error;
  }
};
