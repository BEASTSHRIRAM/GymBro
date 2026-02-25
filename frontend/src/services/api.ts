// GymBro — Axios API Client
// Base URL auto-set from env; JWT header injected from Zustand store

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});

// ── Request Interceptor — inject JWT ──────────────────────────────────────────
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response Interceptor — auto refresh on 401 ───────────────────────────────
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const refresh = await SecureStore.getItemAsync('refresh_token');
                if (refresh) {
                    const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
                        refresh_token: refresh,
                    });
                    await SecureStore.setItemAsync('access_token', data.access_token);
                    original.headers.Authorization = `Bearer ${data.access_token}`;
                    return api(original);
                }
            } catch (_) {
                await SecureStore.deleteItemAsync('access_token');
                await SecureStore.deleteItemAsync('refresh_token');
            }
        }
        return Promise.reject(error);
    }
);

export default api;
