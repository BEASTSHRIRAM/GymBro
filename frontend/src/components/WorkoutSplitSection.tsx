import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSplit } from '../types/profile';
import { Colors, Fonts, Spacing, Radius } from '../theme';

interface WorkoutSplitSectionProps {
  workoutSplit: WorkoutSplit | null | undefined;
  isGenerating: boolean;
  onEdit: () => void;
  onGenerate: () => void;
  onSave?: () => void;
  onRegenerate?: () => void;
  showSaveButtons?: boolean;
}

/**
 * WorkoutSplitSection Component
 * Displays workout split with empty state, loading state, and generated split preview
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.4, 7.5, 7.6, 19.2
 */
export const WorkoutSplitSection: React.FC<WorkoutSplitSectionProps> = ({
  workoutSplit,
  isGenerating,
  onEdit,
  onGenerate,
  onSave,
  onRegenerate,
  showSaveButtons = false,
}) => {
  // Loading state during AI generation
  if (isGenerating) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="barbell-outline" size={24} color={Colors.primary} />
          <Text style={styles.title}>Workout Split</Text>
        </View>
        
        <View style={styles.card}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>
              Generating your personalized workout split...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Empty state when no workout split
  if (!workoutSplit) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="barbell-outline" size={24} color={Colors.primary} />
          <Text style={styles.title}>Workout Split</Text>
        </View>
        
        <View style={styles.card}>
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No workout split set</Text>
            <Text style={styles.emptySubtext}>
              Let AI create a personalized workout plan for you
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.generateButton}
            onPress={onGenerate}
          >
            <Ionicons name="sparkles" size={20} color={Colors.textPrimary} />
            <Text style={styles.buttonText}>Ask AI to Generate</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Display workout split
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="barbell-outline" size={24} color={Colors.primary} />
        <Text style={styles.title}>Workout Split</Text>
      </View>
      
      <View style={styles.card}>
        {/* Split Header */}
        <View style={styles.splitHeader}>
          <Text style={styles.splitName}>{workoutSplit.split_name}</Text>
          <Text style={styles.frequency}>{workoutSplit.frequency}</Text>
        </View>

        {/* Days and Exercises */}
        {workoutSplit.days.map((day, dayIndex) => (
          <View key={dayIndex} style={styles.dayContainer}>
            <Text style={styles.dayName}>{day.day_name}</Text>
            
            {day.exercises.map((exercise, exerciseIndex) => (
              <View key={exerciseIndex} style={styles.exerciseRow}>
                <View style={styles.exerciseBullet} />
                <View style={styles.exerciseContent}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseDetails}>
                    {exercise.sets} sets × {exercise.reps} reps ({exercise.rest_seconds}s rest)
                  </Text>
                  {exercise.notes && (
                    <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                  )}
                </View>
              </View>
            ))}
            
            {day.notes && (
              <Text style={styles.dayNotes}>{day.notes}</Text>
            )}
          </View>
        ))}

        {/* General Notes */}
        {workoutSplit.notes && (
          <View style={styles.notesContainer}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.notes}>{workoutSplit.notes}</Text>
          </View>
        )}

        {/* Action Buttons */}
        {showSaveButtons ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]}
              onPress={onSave}
            >
              <Ionicons name="checkmark-circle" size={20} color={Colors.textPrimary} />
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.regenerateButton]}
              onPress={onRegenerate}
            >
              <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
              <Text style={styles.buttonText}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.editButton]}
              onPress={onEdit}
            >
              <Ionicons name="create-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.generateButton]}
              onPress={onGenerate}
            >
              <Ionicons name="sparkles" size={20} color={Colors.textPrimary} />
              <Text style={styles.buttonText}>Ask AI to Generate</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  
  // Loading State
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  
  // Split Display
  splitHeader: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  splitName: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  frequency: {
    color: Colors.primary,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
  },
  
  // Day Container
  dayContainer: {
    marginBottom: Spacing.lg,
  },
  dayName: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  
  // Exercise Row
  exerciseRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  exerciseBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseName: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseDetails: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
  },
  exerciseNotes: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.xs,
    fontStyle: 'italic',
    marginTop: 2,
  },
  dayNotes: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.sm,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
    paddingLeft: Spacing.md,
  },
  
  // Notes
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.md,
  },
  notes: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  editButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  generateButton: {
    backgroundColor: Colors.primary,
  },
  saveButton: {
    backgroundColor: Colors.success,
  },
  regenerateButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
  },
});
