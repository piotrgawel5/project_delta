import { Platform } from "react-native";
import { supabase } from "./supabase";

// Use localhost for emulator/simulator
// For physical device, set EXPO_PUBLIC_API_URL to your computer's local IP (e.g., http://192.168.1.x:3000)
const LOCALHOST = Platform.select({
    android: "http://10.0.2.2:3000",
    ios: "http://localhost:3000",
    default: "http://localhost:3000",
});

const API_URL = process.env.EXPO_PUBLIC_API_URL || LOCALHOST;

console.log("[API] Base URL:", API_URL);

// Helper to get the current access token from Supabase session
const getAccessToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
};

export const api = {
    fetch: async (endpoint: string, options: RequestInit = {}) => {
        const url = `${API_URL}${endpoint}`;
        console.log("[API] Request:", options.method || "GET", url);

        // Get access token for Authorization header
        const token = await getAccessToken();
        console.log("[API] Token:", token ? "present" : "missing");

        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        // Build headers with Authorization if token exists
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...((options.headers as Record<string, string>) || {}),
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const defaultOptions: RequestInit = {
            ...options,
            headers,
            credentials: "include", // Still include for cookie fallback
            signal: controller.signal,
        };

        try {
            const response = await fetch(url, defaultOptions);
            clearTimeout(timeoutId);

            console.log("[API] Response status:", response.status);
            const data = await response.json();

            if (!response.ok) {
                console.log("[API] Error response:", data);
                throw new Error(data.error || "API Request Failed");
            }

            return data;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === "AbortError") {
                console.log("[API] Request timed out after 10s");
                throw new Error(
                    "Request timed out - check if API server is running at " +
                        API_URL,
                );
            }
            console.log("[API] Fetch error:", error.message);
            throw error;
        }
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

    patch: async (endpoint: string, body: any) => {
        return api.fetch(endpoint, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
    },
};
