import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../stores/profileStore';
import { ProfileBanner } from '../components/ProfileBanner';
import { ActivitySection } from '../components/ActivitySection';
import { AccountSettingsSection } from '../components/AccountSettingsSection';
import { WorkoutSplitSection } from '../components/WorkoutSplitSection';
import { Colors, Fonts, Spacing } from '../theme';

/**
 * ProfileScreen Component
 * Main profile screen with CultFit-style design
 * 
 * Features:
 * - Profile banner with avatar, name, location, and subscription
 * - Activity & Reports section
 * - Account Settings section
 * - Workout Split section with AI generation
 * - Loading and error states
 * - Fade-in animation on mount
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 16.3, 19.1
 */
export default function ProfileScreen() {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const {
    profile,
    isLoading,
    error,
    fetchProfile,
    generateWorkoutSplit,
    saveWorkoutSplit,
    clearError,
  } = useProfileStore();

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  // Fade-in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Handle navigation to ProfileEditor
  const handleViewProfile = () => {
    navigation.navigate('ProfileEditor' as never);
  };

  // Handle navigation to other screens
  const handleNavigate = (screen: string) => {
    // For now, just log the navigation
    // These screens will be implemented in future tasks
    console.log(`Navigate to: ${screen}`);
    // navigation.navigate(screen as never);
  };

  // Handle workout split edit
  const handleEditWorkoutSplit = () => {
    console.log('Edit workout split');
    // TODO: Navigate to workout split editor
  };

  // Handle AI workout split generation
  const handleGenerateWorkoutSplit = async () => {
    try {
      await generateWorkoutSplit();
    } catch (error) {
      // Error is already handled in the store
      console.error('Failed to generate workout split:', error);
    }
  };

  // Handle save workout split
  const handleSaveWorkoutSplit = async () => {
    if (profile?.workout_split) {
      try {
        await saveWorkoutSplit(profile.workout_split);
      } catch (error) {
        console.error('Failed to save workout split:', error);
      }
    }
  };

  // Loading state
  if (isLoading && !profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Error state
  if (error && !profile) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No profile data
  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.errorText}>No profile data available</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Banner */}
        <ProfileBanner profile={profile} onViewProfile={handleViewProfile} />

        {/* Error Message (if any, while profile is loaded) */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Activity & Reports Section */}
        <ActivitySection onNavigate={handleNavigate} />

        {/* Account Settings Section */}
        <AccountSettingsSection onNavigate={handleNavigate} />

        {/* Workout Split Section */}
        <WorkoutSplitSection
          workoutSplit={profile.workout_split}
          isGenerating={isLoading}
          onEdit={handleEditWorkoutSplit}
          onGenerate={handleGenerateWorkoutSplit}
          onSave={handleSaveWorkoutSplit}
          onRegenerate={handleGenerateWorkoutSplit}
          showSaveButtons={false}
        />

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  
  // Center Container (Loading/Error States)
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
    marginTop: Spacing.md,
  },
  errorText: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  retryButtonText: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
  },
  
  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: 8,
    gap: Spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.sm,
  },
  
  // Bottom Spacing
  bottomSpacer: {
    height: Spacing.xl,
  },
});
