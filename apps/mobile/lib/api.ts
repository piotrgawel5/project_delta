import { Platform } from "react-native";

// Use localhost for emulator/simulator
const LOCALHOST = Platform.select({
    android: "http://10.0.2.2:3000",
    ios: "http://localhost:3000",
    default: "http://localhost:3000",
});

const API_URL = process.env.EXPO_PUBLIC_API_URL || LOCALHOST;

export const api = {
    fetch: async (endpoint: string, options: RequestInit = {}) => {
        const url = `${API_URL}${endpoint}`;

        // Ensure credentials are included for cookies
        const defaultOptions: RequestInit = {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
            credentials: "include", // Important for cookies
        };

        const response = await fetch(url, defaultOptions);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "API Request Failed");
        }

        return data;
    },

    post: async (endpoint: string, body: any) => {
        return api.fetch(endpoint, {
            method: "POST",
            body: JSON.stringify(body),
        });
    },

    get: async (endpoint: string) => {
        return api.fetch(endpoint, {
            method: "GET",
        });
    },
};
