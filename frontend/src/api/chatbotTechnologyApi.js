import API_BASE_URL, { ENDPOINTS } from './config';

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
        console.error('Error fetching chatbot technologies:', error);
        throw error;
    }
};

export const createChatbotTechnology = async (data) => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error creating chatbot technology:', error);
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
        console.error('Error fetching technology choices:', error);
        throw error;
    }
};
