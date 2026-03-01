// GymBro — Profile Store (Zustand)
import { create } from 'zustand';
import api from '../services/api';
import {
  ProfileState,
  UserProfile,
  WorkoutSplit,
  ProfileUpdateRequest,
  WorkoutSplitGenerateRequest,
} from '../types/profile';

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<UserProfile>('/api/profile');
      set({ profile: data, isLoading: false });
    } catch (e: any) {
      set({
        error: e.response?.data?.detail ?? 'Failed to fetch profile',
        isLoading: false,
      });
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    set({ isLoading: true, error: null });
    try {
      // Extract only the fields that can be updated via the API
      const updateData: ProfileUpdateRequest = {
        name: updates.name,
        location: updates.location,
        age: updates.age,
        height: updates.height,
        weight: updates.weight,
        goal: updates.goal,
        activity_level: updates.activity_level,
      };

      const { data } = await api.put<UserProfile>('/api/profile', updateData);
      set({ profile: data, isLoading: false });
    } catch (e: any) {
      set({
        error: e.response?.data?.detail ?? 'Failed to update profile',
        isLoading: false,
      });
      throw e; // Re-throw so UI can handle navigation
    }
  },

  uploadProfilePicture: async (imageUri: string) => {
    set({ isLoading: true, error: null });
    try {
      // Create form data for image upload
      const formData = new FormData();

      // Extract file extension from URI
      const uriParts = imageUri.split('.');
      const fileType = uriParts[uriParts.length - 1];

      // Create file object for upload
      const file = {
        uri: imageUri,
        name: `profile.${fileType}`,
        type: `image/${fileType}`,
      } as any;

      formData.append('file', file);

      const { data } = await api.post<{ profile_picture_url: string }>(
        '/api/profile/picture',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Update profile with new picture URL
      const currentProfile = get().profile;
      if (currentProfile) {
        set({
          profile: {
            ...currentProfile,
            profile_picture_url: data.profile_picture_url,
          },
          isLoading: false,
        });
      }
    } catch (e: any) {
      set({
        error: e.response?.data?.detail ?? 'Failed to upload profile picture',
        isLoading: false,
      });
      throw e;
    }
  },

  generateWorkoutSplit: async () => {
    set({ isLoading: true, error: null });
    try {
      const currentProfile = get().profile;

      // Validate that we have all required user stats
      if (!currentProfile?.age || !currentProfile?.height || !currentProfile?.weight ||
        !currentProfile?.goal || !currentProfile?.activity_level) {
        throw new Error('Please complete your profile information before generating a workout split');
      }

      const requestData: WorkoutSplitGenerateRequest = {
        age: currentProfile.age,
        height: currentProfile.height,
        weight: currentProfile.weight,
        goal: currentProfile.goal,
        activity_level: currentProfile.activity_level,
      };

      console.log('[WorkoutSplit] Generating split with:', requestData);
      const { data } = await api.post<WorkoutSplit>(
        '/api/workout-split/generate',
        requestData,
        { timeout: 30000 } // Gemini needs more time
      );

      // Update profile with generated workout split
      set({
        profile: {
          ...currentProfile,
          workout_split: data,
        },
        isLoading: false,
      });
    } catch (e: any) {
      const errorMessage = e.message || e.response?.data?.detail;

      // Provide user-friendly error messages
      let displayError = 'Failed to generate workout split';
      if (errorMessage?.includes('timeout') || e.code === 'ECONNABORTED') {
        displayError = 'Request timed out, please try again';
      } else if (e.response?.status === 503) {
        displayError = 'AI service temporarily unavailable';
      } else if (errorMessage) {
        displayError = errorMessage;
      }

      set({
        error: displayError,
        isLoading: false,
      });
      throw e;
    }
  },

  saveWorkoutSplit: async (split: WorkoutSplit) => {
    set({ isLoading: true, error: null });
    try {
      await api.put('/api/workout-split', split);

      // Update profile with saved workout split
      const currentProfile = get().profile;
      if (currentProfile) {
        set({
          profile: {
            ...currentProfile,
            workout_split: split,
          },
          isLoading: false,
        });
      }
    } catch (e: any) {
      set({
        error: e.response?.data?.detail ?? 'Failed to save workout split',
        isLoading: false,
      });
      throw e;
    }
  },
}));
