// GymBro — Workout (Form Checker) Store
import { create } from 'zustand';
import api from '../services/api';

interface WorkoutSession {
    sessionId: string;
    exercise: string;
    repCount: number;
    formScore: number;
    faults: string[];
    feedback: string;
    jointAngles: Record<string, number>;
    voiceEnabled: boolean;
    isActive: boolean;
}

interface WorkoutState extends WorkoutSession {
    history: any[];
    isLoading: boolean;

    startSession: (exercise: string, userId: string) => void;
    endSession: () => void;
    updateAnalysis: (data: Partial<WorkoutSession>) => void;
    toggleVoice: () => void;
    fetchHistory: (exercise: string) => Promise<void>;
    setExercise: (exercise: string) => void;
}

const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
    sessionId: '',
    exercise: 'squat',
    repCount: 0,
    formScore: 0,
    faults: [],
    feedback: '',
    jointAngles: {},
    voiceEnabled: true,
    isActive: false,
    history: [],
    isLoading: false,

    startSession: (exercise, _userId) => {
        set({
            sessionId: generateSessionId(),
            exercise,
            repCount: 0,
            formScore: 0,
            faults: [],
            feedback: '',
            jointAngles: {},
            isActive: true,
        });
    },

    endSession: () => {
        set({ isActive: false, repCount: 0, formScore: 0, faults: [], feedback: '' });
    },

    updateAnalysis: (data) => set((state) => ({ ...state, ...data })),

    toggleVoice: () => set((s) => ({ voiceEnabled: !s.voiceEnabled })),

    setExercise: (exercise) => set({ exercise }),

    fetchHistory: async (exercise) => {
        set({ isLoading: true });
        try {
            const { data } = await api.get(`/strength/history/${exercise}`);
            set({ history: data.logs ?? [], isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },
}));
