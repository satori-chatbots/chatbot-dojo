import apiClient from './apiClient';
import { ENDPOINTS } from './config';

export const fetchUserApiKeys = async () => {
    try {
        const response = await apiClient(ENDPOINTS.APIKEYS);
        if (!response.ok) {
            throw new Error(`Failed to fetch API keys: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching API keys:', error);
        throw error;
    }
};
