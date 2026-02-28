import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionCard } from './SubscriptionCard';
import { UserProfile } from '../types/profile';
import { Colors, Fonts, Spacing, Radius } from '../theme';

interface ProfileBannerProps {
  profile: UserProfile;
  onViewProfile: () => void;
}

/**
 * ProfileBanner Component
 * Displays user identity and subscription information with CultFit-style gradient background
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export const ProfileBanner: React.FC<ProfileBannerProps> = ({ profile, onViewProfile }) => {
  return (
    <LinearGradient
      colors={['#FF6B35', '#CC4D1B', '#0A0A0A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.container}>
        {/* Avatar */}
        <TouchableOpacity onPress={onViewProfile} style={styles.avatarContainer}>
          {profile.profile_picture_url ? (
            <Image 
              source={{ uri: profile.profile_picture_url }} 
              style={styles.avatar}
            />
          ) : (
            <View style={styles.defaultAvatar}>
              <Ionicons name="person" size={40} color={Colors.textSecondary} />
            </View>
          )}
        </TouchableOpacity>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{profile.name}</Text>
          
          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={Colors.textSecondary} />
            <Text style={styles.locationText}>
              {profile.location || 'Location not set'}
            </Text>
          </View>
        </View>

        {/* View Profile Button */}
        <TouchableOpacity 
          style={styles.viewProfileButton}
          onPress={onViewProfile}
        >
          <Text style={styles.viewProfileText}>VIEW PROFILE</Text>
        </TouchableOpacity>

        {/* Subscription Card */}
        <SubscriptionCard subscription={profile.subscription} />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  container: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.textPrimary,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.xxl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  locationText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
  },
  viewProfileButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  viewProfileText: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
