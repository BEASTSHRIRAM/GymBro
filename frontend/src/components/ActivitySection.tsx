import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProfileMenuItem } from './ProfileMenuItem';
import { Colors, Fonts, Spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface ActivitySectionProps {
  onNavigate: (screen: string) => void;
}

/**
 * ActivitySection Component
 * Displays navigation items for activity-related features in a single-column layout
 * Uses premium ProfileMenuItem component with CultFit-inspired design
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */
export const ActivitySection: React.FC<ActivitySectionProps> = ({ onNavigate }) => {
  const activityItems = [
    {
      icon: <Ionicons name="time-outline" size={24} color="#FF6B35" />,
      label: 'Past Sessions',
      screen: 'PastSessions',
    },
    {
      icon: <Ionicons name="stats-chart-outline" size={24} color="#FF6B35" />,
      label: 'Reports',
      screen: 'Reports',
    },
    {
      icon: <Ionicons name="images-outline" size={24} color="#FF6B35" />,
      label: 'Memories',
      screen: 'Memories',
    },
    {
      icon: <Ionicons name="medal-outline" size={24} color="#FF6B35" />,
      label: 'Badges',
      screen: 'Badges',
    },
    {
      icon: <Ionicons name="create-outline" size={24} color="#FF6B35" />,
      label: 'Logging',
      screen: 'Logging',
    },
    {
      icon: <Ionicons name="download-outline" size={24} color="#FF6B35" />,
      label: 'Downloads',
      screen: 'Downloads',
    },
    {
      icon: <Ionicons name="body-outline" size={24} color="#FF6B35" />,
      label: 'BCA Report',
      screen: 'BCAReport',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Activity & Reports</Text>
      <View style={styles.list}>
        {activityItems.map((item) => (
          <ProfileMenuItem
            key={item.screen}
            title={item.label}
            icon={item.icon}
            onPress={() => onNavigate(item.screen)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  list: {
    // Single column layout - no grid needed
  },
});
