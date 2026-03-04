// GymBro — Auth Store (Zustand)
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

interface User {
    id: string;
    name: string;
    email: string;
    xp: number;
    rank: string;
    streak_count: number;
    role: string;
    goal?: string;
    weight?: number;
    height?: number;
    age?: number;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isInitializing: boolean;
    error: string | null;
    resendSuccess: string | null;
    resendError: string | null;
    resendCooldown: number;

    login: (email: string, password: string) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    verifyOtp: (email: string, otp: string) => Promise<void>;
    logout: () => Promise<void>;
    loadUser: () => Promise<void>;
    clearError: () => void;
    pendingOtpEmail: string | null;
    setPendingOtpEmail: (email: string | null) => void;
    resendOtp: (email: string) => Promise<void>;
    clearResendMessages: () => void;
}

interface RegisterData {
    name: string;
    email: string;
    password: string;
    age?: number;
    height?: number;
    weight?: number;
    goal?: string;
    activity_level?: string;
}

// Safely extract a displayable error string from Axios error responses
// Handles Pydantic validation errors (array of {type, loc, msg, input, ctx})
function parseError(e: any, fallback: string): string {
    const detail = e.response?.data?.detail;
    if (!detail) return fallback;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail.map((d: any) => d.msg ?? JSON.stringify(d)).join('; ');
    }
    if (typeof detail === 'object') return JSON.stringify(detail);
    return String(detail);
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitializing: true,
    error: null,
    resendSuccess: null,
    resendError: null,
    resendCooldown: 0,
    pendingOtpEmail: null,

    clearError: () => set({ error: null }),
    setPendingOtpEmail: (email) => set({ pendingOtpEmail: email }),
    clearResendMessages: () => set({ resendSuccess: null, resendError: null }),

    loadUser: async () => {
        set({ isInitializing: true });
        try {
            const token = await SecureStore.getItemAsync('access_token');
            if (!token) {
                set({ isInitializing: false, isAuthenticated: false });
                return;
            }
            const { data } = await api.get('/auth/me');
            set({ user: data, isAuthenticated: true, isInitializing: false });
        } catch {
            set({ isAuthenticated: false, isInitializing: false });
        }
    },

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await api.post('/auth/login', { email, password });
            await SecureStore.setItemAsync('access_token', data.access_token);
            await SecureStore.setItemAsync('refresh_token', data.refresh_token);
            set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (e: any) {
            set({
                error: parseError(e, 'Login failed'),
                isLoading: false,
            });
        }
    },

    register: async (data) => {
        set({ isLoading: true, error: null });
        try {
            await api.post('/auth/register', data);
            set({ isLoading: false });
        } catch (e: any) {
            set({
                error: parseError(e, 'Registration failed'),
                isLoading: false,
            });
        }
    },

    verifyOtp: async (email, otp) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await api.post('/auth/verify-otp', { email, otp });
            // New verify-otp returns JWT tokens + user for auto-login
            if (data.access_token && data.refresh_token) {
                await SecureStore.setItemAsync('access_token', data.access_token);
                await SecureStore.setItemAsync('refresh_token', data.refresh_token);
                set({ user: data.user, isAuthenticated: true, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch (e: any) {
            set({
                error: parseError(e, 'OTP verification failed'),
                isLoading: false,
            });
        }
    },

    logout: async () => {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        set({ user: null, isAuthenticated: false });
    },

    resendOtp: async (email: string) => {
        set({ isLoading: true, resendError: null, resendSuccess: null });
        try {
            const { data } = await api.post('/auth/resend-otp', { email });
            set({
                resendSuccess: data.message,
                resendCooldown: data.cooldown_seconds,
                isLoading: false
            });
        } catch (e: any) {
            const errorData = e.response?.data;
            set({
                resendError: parseError(e, 'Failed to resend OTP. Please try again'),
                resendCooldown: errorData?.remaining_seconds ?? 0,
                isLoading: false,
            });
        }
    },
}));
