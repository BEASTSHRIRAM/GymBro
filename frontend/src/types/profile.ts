/**
 * Profile Screen Types
 * TypeScript interfaces and types for the profile management feature
 */

// ─── Enums ───────────────────────────────────────────────────────────────────
export type FitnessGoal = 'lose_fat' | 'build_muscle' | 'maintain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'EXPIRING TODAY';

// ─── Subscription ────────────────────────────────────────────────────────────
export interface Subscription {
  name: string;
  status: SubscriptionStatus;
  start_date: string; // ISO date
  expiry_date: string; // ISO date
}

// ─── Workout Split ───────────────────────────────────────────────────────────
export interface Exercise {
  name: string;
  sets: number;
  reps: string; // e.g., "8-10" or "12"
  rest_seconds: number;
  notes?: string;
}

export interface WorkoutDay {
  day_name: string;
  exercises: Exercise[];
  notes?: string;
}

export interface WorkoutSplit {
  split_name: string;
  frequency: string;
  days: WorkoutDay[];
  notes?: string;
  generated_at: string; // ISO date
}

// ─── User Profile ────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  profile_picture_url?: string;
  location?: string;
  age?: number;
  height?: number; // cm
  weight?: number; // kg
  goal?: FitnessGoal;
  activity_level?: ActivityLevel;
  subscription?: Subscription;
  workout_split?: WorkoutSplit;
  xp: number;
  rank: string;
  streak_count: number;
}

// ─── API Request Types ───────────────────────────────────────────────────────
export interface ProfileUpdateRequest {
  name?: string;
  location?: string;
  age?: number;
  height?: number;
  weight?: number;
  goal?: FitnessGoal;
  activity_level?: ActivityLevel;
}

export interface WorkoutSplitGenerateRequest {
  age: number;
  height: number;
  weight: number;
  goal: FitnessGoal;
  activity_level: ActivityLevel;
}

// ─── Profile Store State ─────────────────────────────────────────────────────
export interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  uploadProfilePicture: (imageUri: string) => Promise<void>;
  generateWorkoutSplit: (requirements?: string) => Promise<void>;
  saveWorkoutSplit: (split: WorkoutSplit) => Promise<void>;
  clearError: () => void;
}
