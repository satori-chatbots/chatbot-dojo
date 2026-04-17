import API_BASE_URL, { ENDPOINTS } from "./config";
import apiClient from "./api-client";

const extractErrorMessage = (error) => {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.error === "string") {
        return parsed.error;
      }

      return Object.values(parsed).flat().join(", ");
    } catch {
      return error.message;
    }
  }

  return "Unexpected Senpai Assistant error.";
};

export const initializeSenpaiConversation = async (forceNew = false) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.SENPAI_CONVERSATION_INITIALIZE}`,
      {
        method: "POST",
        body: JSON.stringify({ force_new: forceNew }),
      },
    );

    return await response.json();
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};

export const sendSenpaiMessage = async (message) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.SENPAI_CONVERSATION_MESSAGE}`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      },
    );

    return await response.json();
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};

export const assignSenpaiApiKey = async (assistantApiKeyId) => {
  try {
    const response = await apiClient(
      `${API_BASE_URL}${ENDPOINTS.SENPAI_CONVERSATION_API_KEY}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          assistant_api_key_id: assistantApiKeyId,
        }),
      },
    );

    return await response.json();
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};
