import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileMenuItemProps {
  title: string;
  icon: ReactNode;
  onPress: () => void;
}

/**
 * ProfileMenuItem Component
 * Premium menu card for Profile screen with CultFit-inspired design
 * 
 * Features:
 * - Fixed icon container width (40px) for consistent alignment
 * - Single-line title with ellipsis (numberOfLines={1})
 * - Right-aligned chevron arrow
 * - Dark theme with subtle elevation
 * - Responsive layout (no fixed widths)
 * - Premium feel with proper spacing
 */
export const ProfileMenuItem: React.FC<ProfileMenuItemProps> = ({ title, icon, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon Container - Fixed 40px width */}
      <View style={styles.iconContainer}>
        {icon}
      </View>

      {/* Title - Flex 1 with single line */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* Arrow - Right aligned */}
      <Ionicons name="chevron-forward" size={20} color="#888888" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 16,
    // Premium shadow/elevation
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  iconContainer: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    // Prevent text wrapping
    numberOfLines: 1,
  },
});
