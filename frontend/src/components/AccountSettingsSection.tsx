import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProfileMenuItem } from './ProfileMenuItem';
import { Colors, Fonts, Spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface AccountSettingsSectionProps {
  onNavigate: (screen: string) => void;
}

/**
 * AccountSettingsSection Component
 * Displays navigation items for account settings in a single-column layout
 * Uses premium ProfileMenuItem component with CultFit-inspired design
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const AccountSettingsSection: React.FC<AccountSettingsSectionProps> = ({ onNavigate }) => {
  const settingsItems = [
    {
      icon: <Ionicons name="notifications-outline" size={24} color="#FF6B35" />,
      label: 'Notifications',
      screen: 'Notifications',
    },
    {
      icon: <Ionicons name="mail-outline" size={24} color="#FF6B35" />,
      label: 'Contact Details',
      screen: 'ContactDetails',
    },
    {
      icon: <Ionicons name="card-outline" size={24} color="#FF6B35" />,
      label: 'Payments',
      screen: 'Payments',
    },
    {
      icon: <Ionicons name="ellipsis-horizontal-outline" size={24} color="#FF6B35" />,
      label: 'Others',
      screen: 'Others',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Account Settings</Text>
      <View style={styles.list}>
        {settingsItems.map((item) => (
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
