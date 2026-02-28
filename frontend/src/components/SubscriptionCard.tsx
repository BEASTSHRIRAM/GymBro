import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Subscription } from '../types/profile';
import { Colors, Fonts, Spacing, Radius } from '../theme';

interface SubscriptionCardProps {
  subscription: Subscription | null | undefined;
}

/**
 * SubscriptionCard Component
 * Displays subscription details with status indicator, progress bar, and expiry information
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 20.1, 20.2, 20.3, 20.4
 */
export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ subscription }) => {
  // Handle null/undefined subscription
  if (!subscription) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={24} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No active subscription</Text>
        </View>
      </View>
    );
  }

  // Calculate progress: (days remaining / total days) × 100
  const calculateProgress = (): number => {
    const now = new Date();
    const startDate = new Date(subscription.start_date);
    const expiryDate = new Date(subscription.expiry_date);

    const totalDays = Math.max(1, Math.floor((expiryDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const progress = Math.max(0, Math.min(100, (remainingDays / totalDays) * 100));
    return progress;
  };

  // Check if expiring within 7 days
  const isExpiringSoon = (): boolean => {
    const now = new Date();
    const expiryDate = new Date(subscription.expiry_date);
    const daysRemaining = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining >= 0 && daysRemaining <= 7;
  };

  // Get status indicator color
  const getStatusColor = (): string => {
    switch (subscription.status) {
      case 'ACTIVE':
        return Colors.success;
      case 'EXPIRING TODAY':
        return Colors.warning;
      case 'EXPIRED':
        return Colors.error;
      case 'INACTIVE':
        return Colors.textMuted;
      default:
        return Colors.textMuted;
    }
  };

  // Format expiry date
  const formatExpiryDate = (): string => {
    const expiryDate = new Date(subscription.expiry_date);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return expiryDate.toLocaleDateString('en-US', options);
  };

  const progress = calculateProgress();
  const showWarning = isExpiringSoon();
  const statusColor = getStatusColor();

  return (
    <View style={styles.card}>
      {/* Subscription Name */}
      <Text style={styles.subscriptionName}>{subscription.name}</Text>

      {/* Status Row */}
      <View style={styles.statusRow}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusText}>{subscription.status}</Text>
        </View>
        <Text style={styles.expiryText}>Expires: {formatExpiryDate()}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${progress}%`,
                backgroundColor: statusColor 
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>

      {/* Warning Message */}
      {showWarning && subscription.status !== 'EXPIRED' && (
        <View style={styles.warningContainer}>
          <Ionicons name="warning-outline" size={16} color={Colors.warning} />
          <Text style={styles.warningText}>
            Your subscription is expiring soon!
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
    marginLeft: Spacing.sm,
  },
  subscriptionName: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  statusText: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '500',
  },
  expiryText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBackground: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
  progressText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  warningText: {
    color: Colors.warning,
    fontSize: Fonts.sizes.sm,
    marginLeft: Spacing.xs,
    flex: 1,
  },
});
