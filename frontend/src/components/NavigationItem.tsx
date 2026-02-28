import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius } from '../theme';

interface NavigationItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

/**
 * NavigationItem Component
 * Reusable card-style navigation item with icon, label, and chevron
 * Used in ActivitySection and AccountSettingsSection with 2-column grid layout
 * 
 * Requirements: 4.1-4.7, 5.1-5.4
 */
export const NavigationItem: React.FC<NavigationItemProps> = ({ icon, label, onPress }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      android_ripple={{
        color: Colors.primaryGlow,
        borderless: false,
      }}
    >
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color={Colors.primary} />
        </View>

        {/* Label */}
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    minHeight: 80,
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
  },
});
