// GymBro — Diet Store
import { create } from 'zustand';
import api from '../services/api';

interface Meal {
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    items: string[];
}

interface DietPlan {
    id?: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    meals: Meal[];
    status: 'generating' | 'ready' | 'error';
}

interface DietInput {
    age: number;
    height: number;
    weight: number;
    goal: string;
    activity_level: string;
    gender: string;
}

interface DietState {
    plan: DietPlan | null;
    isLoading: boolean;
    error: string | null;
    generate: (input: DietInput) => Promise<void>;
    fetchCurrent: () => Promise<void>;
    pollUntilReady: () => Promise<void>;
    getSupplementAdvice: (requirements: string) => Promise<void>;
    clearError: () => void;
    supplementAdvice: string | null;
}

export const useDietStore = create<DietState>((set, get) => ({
    plan: null,
    isLoading: false,
    error: null,
    supplementAdvice: null,

    clearError: () => set({ error: null }),

    generate: async (input) => {
        set({ isLoading: true, error: null });
        try {
            await api.post('/diet/generate', input);
            set({ isLoading: false });
            // Start polling
            get().pollUntilReady();
        } catch (e: any) {
            set({ error: e.response?.data?.detail ?? 'Failed to generate diet plan', isLoading: false });
        }
    },

    fetchCurrent: async () => {
        try {
            const { data } = await api.get('/diet/current');
            set({ plan: data });
        } catch { /* not found is ok */ }
    },

    getSupplementAdvice: async (requirements: string) => {
        set({ isLoading: true, error: null, supplementAdvice: null });
        try {
            const { data } = await api.post('/diet/supplement', { requirements });
            set({ supplementAdvice: data.advice, isLoading: false });
        } catch (e: any) {
            set({ error: e.response?.data?.detail ?? 'Failed to get supplement advice', isLoading: false });
            throw e;
        }
    },

    pollUntilReady: async () => {
        let attempts = 0;
        const poll = async () => {
            try {
                const { data } = await api.get('/diet/current');
                set({ plan: data });
                if (data.status !== 'ready' && attempts < 10) {
                    attempts++;
                    await new Promise((r) => setTimeout(r, 2000));
                    await poll();
                }
            } catch { /* ignore */ }
        };
        await poll();
    },
}));
