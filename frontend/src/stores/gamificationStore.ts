// GymBro — Gamification Store
import { create } from 'zustand';
import api from '../services/api';

interface Badge {
    id: string;
    name: string;
    icon: string;
}

interface LeaderboardEntry {
    position: number;
    user_id: string;
    name: string;
    xp: number;
    rank: string;
    streak_count: number;
}

interface GamificationState {
    xp: number;
    rank: string;
    streak_count: number;
    workout_count: number;
    best_form_score: number;
    badges: Badge[];
    leaderboard: LeaderboardEntry[];
    isLoading: boolean;

    fetchProfile: () => Promise<void>;
    fetchLeaderboard: () => Promise<void>;
    awardXP: (activity: string, formScore?: number) => Promise<void>;
}

export const useGamificationStore = create<GamificationState>((set) => ({
    xp: 0,
    rank: 'Beginner',
    streak_count: 0,
    workout_count: 0,
    best_form_score: 0,
    badges: [],
    leaderboard: [],
    isLoading: false,

    fetchProfile: async () => {
        set({ isLoading: true });
        try {
            const { data } = await api.get('/gamification/profile');
            set({
                xp: data.xp,
                rank: data.rank,
                streak_count: data.streak_count,
                workout_count: data.workout_count,
                best_form_score: data.best_form_score,
                badges: data.badges,
                isLoading: false,
            });
        } catch {
            set({ isLoading: false });
        }
    },

    fetchLeaderboard: async () => {
        try {
            const { data } = await api.get('/gamification/leaderboard');
            set({ leaderboard: data.leaderboard });
        } catch { /* ignore */ }
    },

    awardXP: async (activity, formScore = 0) => {
        try {
            const { data } = await api.post('/gamification/award-xp', {
                activity,
                form_score: formScore,
            });
            set((s) => ({
                xp: data.total_xp,
                rank: data.new_rank,
            }));
        } catch { /* ignore */ }
    },
}));
