import { supabase } from './supabase';

// Production API URL (Render deployment)
const RENDER_API_URL = 'https://project-delta-3mqz.onrender.com';

// Local development URLs (uncomment and change API_URL below to use local Docker/server)
// const LOCALHOST = Platform.select({
//     android: "http://10.0.2.2:3000",
//     ios: "http://localhost:3000",
//     default: "http://localhost:3000",
// });

// Use Render deployment URL (change to LOCALHOST for local development)
const API_URL = RENDER_API_URL;

console.log('[API] Base URL:', API_URL);

// Helper to get the current access token from Supabase session
const getAccessToken = async (): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
};

export const api = {
  fetch: async (endpoint: string, options: RequestInit = {}) => {
    const url = `${API_URL}${endpoint}`;
    console.log('[API] Request:', options.method || 'GET', url);

    // Get access token for Authorization header
    const token = await getAccessToken();
    console.log('[API] Token:', token ? 'present' : 'missing');

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Build headers with Authorization if token exists
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const defaultOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Still include for cookie fallback
      signal: controller.signal,
    };

    try {
      const response = await fetch(url, defaultOptions);
      clearTimeout(timeoutId);

      console.log('[API] Response status:', response.status);
      const data = await response.json();

      if (!response.ok) {
        console.log('[API] Error response:', data);
        throw new Error(data.error || 'API Request Failed');
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.log('[API] Request timed out after 10s');
        throw new Error('Request timed out - check if API server is running at ' + API_URL);
      }
      console.log('[API] Fetch error:', error.message);
      throw error;
    }
  },

  post: async (endpoint: string, body: any) => {
    return api.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  get: async (
    endpoint: string,
    options?: { params?: Record<string, string | number | boolean | undefined> }
  ) => {
    const query =
      options?.params && Object.keys(options.params).length > 0
        ? `?${new URLSearchParams(
            Object.entries(options.params)
              .filter(([, value]) => value !== undefined)
              .map(([key, value]) => [key, String(value)])
          ).toString()}`
        : '';

    return api.fetch(`${endpoint}${query}`, {
      method: 'GET',
    });
  },

  patch: async (endpoint: string, body: any) => {
    return api.fetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete: async (endpoint: string) => {
    return api.fetch(endpoint, {
      method: 'DELETE',
    });
  },
};

export interface SleepTimelineResponse {
  sleep_data_id: string | null;
  date: string;
  phases: {
    id: string;
    cycle_number: number;
    stage: 'awake' | 'light' | 'deep' | 'rem';
    start_time: string;
    end_time: string;
    duration_minutes: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
  meta: {
    total_phases: number;
    estimated_cycles: number;
    confidence: 'high' | 'medium' | 'low' | null;
    generation_v: number | null;
  };
}

export async function fetchSleepTimeline(
  userId: string,
  date: string
): Promise<SleepTimelineResponse | null> {
  const endpoint = `/api/sleep/${userId}/timeline/${date}`;
  const url = `${API_URL}${endpoint}`;
  console.log('[API] Request:', 'GET', url);

  const token = await getAccessToken();
  console.log('[API] Token:', token ? 'present' : 'missing');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    console.log('[API] Response status:', response.status);
    const data = await response.json();

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.log('[API] Error response:', data);
      throw new Error(data.error || 'API Request Failed');
    }

    return (data?.data ?? null) as SleepTimelineResponse | null;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.log('[API] Request timed out after 10s');
      throw new Error('Request timed out - check if API server is running at ' + API_URL);
    }
    console.log('[API] Fetch error:', error.message);
    throw error;
  }
}
