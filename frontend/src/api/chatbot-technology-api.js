import API_BASE_URL, { ENDPOINTS } from "./config";

const API_URL = `${API_BASE_URL}${ENDPOINTS.CHATBOTTECHNOLOGIES}`;
const CHOICES_URL = `${API_BASE_URL}${ENDPOINTS.TECHNOLOGIES_CHOICES}`;

export const fetchChatbotTechnologies = async () => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching chatbot technologies:", error);
    throw error;
  }
};

export const createChatbotTechnology = async (data) => {
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
      const errorMessage = errorData.link
        ? errorData.link.join(", ")
        : `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating chatbot technology:", error);
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

export const updateChatbotTechnology = async (id, data) => {
  try {
    const response = await fetch(`${API_URL}${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error updating chatbot technology:", error);
    throw error;
  }
};

export const deleteChatbotTechnology = async (id) => {
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
    console.error("Error deleting chatbot technology:", error);
    throw error;
  }
};

export const checkChatbotTechnologyName = async (name) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${ENDPOINTS.CHECK_CHATBOT_NAME}?chatbot_name=${name}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error checking chatbot technology name:", error);
    throw error;
  }
};
