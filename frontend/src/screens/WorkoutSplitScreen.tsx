import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, LayoutAnimation, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import { useProfileStore } from '../stores/profileStore';
import { Colors, Fonts, Spacing, Radius } from '../theme';

const DAY_COLORS: string[][] = [
    ['#FF6B35', '#CC4D1B'],
    ['#3B82F6', '#1D4ED8'],
    ['#22C55E', '#15803D'],
    ['#F59E0B', '#B45309'],
    ['#A855F7', '#7C3AED'],
    ['#EF4444', '#B91C1C'],
    ['#06B6D4', '#0E7490'],
];

const DAY_ICONS: string[] = [
    'barbell', 'fitness', 'body', 'flash', 'trophy', 'flame', 'walk',
];

function getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
}

export default function WorkoutSplitScreen() {
    const { profile, isLoading, generateWorkoutSplit, saveWorkoutSplit, fetchProfile } = useProfileStore();
    const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});
    const [expandedDay, setExpandedDay] = useState<number | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [status, setStatus] = useState<any>(null);
    const [requirements, setRequirements] = useState('');

    // Load completion state from AsyncStorage
    useEffect(() => {
        const load = async () => {
            try {
                const raw = await AsyncStorage.getItem(`@gymbo_completed_${getTodayKey()}`);
                if (raw) setCompletedExercises(JSON.parse(raw));
            } catch { }
        };
        load();
    }, []);

    useEffect(() => {
        if (!profile) fetchProfile();
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const { data } = await api.get('/subscription/status');
            setStatus(data);
        } catch { }
    };

    // Persist completion state
    const toggleExercise = useCallback(async (dayIdx: number, exIdx: number) => {
        const key = `${dayIdx}-${exIdx}`;
        const updated = { ...completedExercises, [key]: !completedExercises[key] };
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCompletedExercises(updated);
        try {
            await AsyncStorage.setItem(`@gymbo_completed_${getTodayKey()}`, JSON.stringify(updated));
        } catch { }
    }, [completedExercises]);

    const toggleDay = (idx: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedDay(expandedDay === idx ? null : idx);
    };

    const handleGenerate = async () => {
        if (isQuotaExhausted) {
            Alert.alert('Limit Reached', 'You have used your free AI Workout generation. Upgrade to Premium for unlimited generations!');
            return;
        }

        try {
            await generateWorkoutSplit(requirements);
            // The store updates the profile; after re-render, save it
            setTimeout(async () => {
                const updatedProfile = useProfileStore.getState().profile;
                if (updatedProfile?.workout_split) {
                    await saveWorkoutSplit(updatedProfile.workout_split);
                }
                fetchStatus();
            }, 500);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to generate split');
        }
    };

    const handleEditExercise = (dayIdx: number, exIdx: number) => {
        if (!split) return;
        const ex = split.days[dayIdx].exercises[exIdx];
        Alert.alert(
            ex.name,
            `${ex.sets} sets × ${ex.reps} reps`,
            [
                {
                    text: 'Rename', onPress: () => {
                        if (typeof (Alert as any).prompt === 'function') {
                            (Alert as any).prompt('Rename Exercise', '', (newName: string) => {
                                if (!newName?.trim()) return;
                                const updated = JSON.parse(JSON.stringify(split));
                                updated.days[dayIdx].exercises[exIdx].name = newName.trim();
                                saveSplitLocally(updated);
                            }, 'plain-text', ex.name);
                        } else {
                            // Android fallback — no Alert.prompt
                            const updated = JSON.parse(JSON.stringify(split));
                            updated.days[dayIdx].exercises[exIdx].name = ex.name + ' (edited)';
                            saveSplitLocally(updated);
                        }
                    }
                },
                {
                    text: 'Delete', style: 'destructive', onPress: () => {
                        const updated = JSON.parse(JSON.stringify(split));
                        updated.days[dayIdx].exercises.splice(exIdx, 1);
                        saveSplitLocally(updated);
                    }
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const handleAddExercise = (dayIdx: number) => {
        if (!split) return;
        const updated = JSON.parse(JSON.stringify(split));
        updated.days[dayIdx].exercises.push({
            name: 'New Exercise',
            sets: 3,
            reps: '10-12',
            rest_seconds: 60,
            notes: '',
        });
        saveSplitLocally(updated);
    };

    const saveSplitLocally = async (updatedSplit: any) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        // Update store + backend
        const currentProfile = useProfileStore.getState().profile;
        if (currentProfile) {
            useProfileStore.setState({
                profile: { ...currentProfile, workout_split: updatedSplit },
            });
            try { await saveWorkoutSplit(updatedSplit); } catch { }
        }
    };

    const split = profile?.workout_split;

    // Count today's progress
    const totalExercises = split?.days?.reduce((sum, d) => sum + (d.exercises?.length || 0), 0) || 0;
    const doneCount = Object.values(completedExercises).filter(Boolean).length;

    const isQuotaExhausted = status?.tier === 'free' && status?.usage?.workout_split?.remaining <= 0;

    // ── Empty State ──
    if (!split) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconWrap}>
                        <Ionicons name="barbell-outline" size={64} color={Colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No Workout Split Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Generate a personalized workout plan based on your body stats and goals using AI
                    </Text>

                    <View style={styles.reqInputGroup}>
                        <Text style={styles.reqLabel}>Special Requirements (Optional)</Text>
                        <TextInput
                            style={styles.reqInput}
                            placeholder="e.g. 3 days a week, no heavy squats"
                            placeholderTextColor={Colors.textMuted}
                            value={requirements}
                            onChangeText={setRequirements}
                            multiline
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.generateBtn, isQuotaExhausted && styles.generateBtnDisabled]}
                        onPress={handleGenerate}
                        disabled={isLoading || isQuotaExhausted}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name={isQuotaExhausted ? "lock-closed" : "sparkles"} size={20} color="#fff" />
                                <Text style={styles.generateBtnText}>
                                    {isQuotaExhausted ? 'Upgrade to Generate' : 'Generate with AI'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                    {isQuotaExhausted && (
                        <Text style={styles.quotaHint}>You have used your free AI Workout Split.</Text>
                    )}
                    {!profile?.age && (
                        <Text style={styles.emptyHint}>
                            Complete your profile first (age, weight, height, goal)
                        </Text>
                    )}
                </View>
            </View>
        );
    }

    // ── Split View ──
    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.splitName}>{split.split_name}</Text>
                        <Text style={styles.frequency}>{split.frequency}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.editToggle, editMode && styles.editToggleActive]}
                        onPress={() => setEditMode(!editMode)}
                    >
                        <Ionicons name={editMode ? 'checkmark' : 'create-outline'} size={18} color={editMode ? '#fff' : Colors.primary} />
                        <Text style={[styles.editToggleText, editMode && styles.editToggleTextActive]}>
                            {editMode ? 'Done' : 'Edit'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressWrap}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${totalExercises ? (doneCount / totalExercises) * 100 : 0}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                        {doneCount}/{totalExercises} exercises today
                    </Text>
                </View>

                {/* Day Cards */}
                {split.days.map((day, dayIdx) => {
                    const isExpanded = expandedDay === dayIdx;
                    const dayDone = day.exercises.every((_, exIdx) => completedExercises[`${dayIdx}-${exIdx}`]);
                    const colors = DAY_COLORS[dayIdx % DAY_COLORS.length];

                    return (
                        <View key={dayIdx} style={styles.dayCard}>
                            <TouchableOpacity onPress={() => toggleDay(dayIdx)} activeOpacity={0.85}>
                                <LinearGradient
                                    colors={dayDone ? ['#1a3a1a', '#0d260d'] : colors as [string, string]}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.dayHeader}
                                >
                                    <View style={styles.dayHeaderLeft}>
                                        <Ionicons
                                            name={(DAY_ICONS[dayIdx % DAY_ICONS.length]) as any}
                                            size={22} color="#fff"
                                        />
                                        <Text style={styles.dayName}>{day.day_name}</Text>
                                    </View>
                                    <View style={styles.dayHeaderRight}>
                                        {dayDone && <Ionicons name="checkmark-circle" size={22} color={Colors.success} />}
                                        <Text style={styles.exerciseCount}>{day.exercises.length} exercises</Text>
                                        <Ionicons
                                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={18} color="rgba(255,255,255,0.7)"
                                        />
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={styles.exerciseList}>
                                    {day.exercises.map((ex, exIdx) => {
                                        const done = !!completedExercises[`${dayIdx}-${exIdx}`];
                                        return (
                                            <TouchableOpacity
                                                key={exIdx}
                                                style={[styles.exerciseRow, done && styles.exerciseRowDone]}
                                                onPress={() => editMode ? handleEditExercise(dayIdx, exIdx) : toggleExercise(dayIdx, exIdx)}
                                                activeOpacity={0.7}
                                            >
                                                {editMode ? (
                                                    <TouchableOpacity
                                                        style={styles.deleteBtn}
                                                        onPress={() => handleEditExercise(dayIdx, exIdx)}
                                                    >
                                                        <Ionicons name="create" size={18} color={Colors.primary} />
                                                    </TouchableOpacity>
                                                ) : (
                                                    <View style={[styles.checkbox, done && styles.checkboxDone]}>
                                                        {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                    </View>
                                                )}
                                                <View style={styles.exerciseInfo}>
                                                    <Text style={[styles.exerciseName, done && !editMode && styles.exerciseNameDone]}>
                                                        {ex.name}
                                                    </Text>
                                                    <Text style={styles.exerciseDetail}>
                                                        {ex.sets} sets × {ex.reps} reps • {ex.rest_seconds}s rest
                                                    </Text>
                                                    {ex.notes ? (
                                                        <Text style={styles.exerciseNote}> Note: {ex.notes}</Text>
                                                    ) : null}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                    {editMode && (
                                        <TouchableOpacity
                                            style={styles.addExerciseBtn}
                                            onPress={() => handleAddExercise(dayIdx)}
                                        >
                                            <Ionicons name="add-circle" size={20} color={Colors.primary} />
                                            <Text style={styles.addExerciseText}>Add Exercise</Text>
                                        </TouchableOpacity>
                                    )}
                                    {day.notes ? (
                                        <Text style={styles.dayNote}>{day.notes}</Text>
                                    ) : null}
                                </View>
                            )}
                        </View>
                    );
                })}

                {split.notes ? (
                    <View style={styles.generalNotes}>
                        <Text style={styles.generalNotesTitle}>Coach Notes</Text>
                        <Text style={styles.generalNotesText}>{split.notes}</Text>
                    </View>
                ) : null}

                {/* Regenerate requirements */}
                <View style={[styles.reqInputGroup, { marginTop: Spacing.xl, marginHorizontal: 0, paddingHorizontal: 0 }]}>
                    <Text style={styles.reqLabel}>Adjust Requirements for New Split</Text>
                    <TextInput
                        style={[styles.reqInput, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                        placeholder="e.g. Focus more on abs, only 4 days"
                        placeholderTextColor={Colors.textMuted}
                        value={requirements}
                        onChangeText={setRequirements}
                        multiline
                    />
                </View>

                {/* Regenerate */}
                <TouchableOpacity
                    style={[styles.regenBtn, isQuotaExhausted && styles.regenBtnDisabled]}
                    onPress={handleGenerate}
                    disabled={isLoading || isQuotaExhausted}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color={Colors.primary} />
                    ) : (
                        <>
                            <Ionicons name={isQuotaExhausted ? "lock-closed" : "refresh"} size={18} color={isQuotaExhausted ? Colors.textMuted : Colors.primary} />
                            <Text style={[styles.regenBtnText, isQuotaExhausted && { color: Colors.textMuted }]}>
                                {isQuotaExhausted ? 'Upgrade to Regenerate' : 'Regenerate Split'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
                {isQuotaExhausted && (
                    <Text style={[styles.quotaHint, { marginBottom: Spacing.md }]}>Free uses exhausted.</Text>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    scrollContent: { padding: Spacing.md, paddingTop: 60 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    headerLeft: { flex: 1, marginRight: 12 },
    splitName: { color: Colors.textPrimary, fontSize: Fonts.sizes.xl, fontWeight: '700' },
    frequency: { color: Colors.primary, fontSize: Fonts.sizes.sm, marginTop: 4 },
    editToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1, borderColor: Colors.primary,
    },
    editToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    editToggleText: { color: Colors.primary, fontSize: Fonts.sizes.sm, fontWeight: '600' },
    editToggleTextActive: { color: '#fff' },

    // Progress
    progressWrap: { marginBottom: Spacing.lg },
    progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 3 },
    progressText: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, marginTop: 6, textAlign: 'right' },

    // Day cards
    dayCard: { marginBottom: Spacing.sm, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.card },
    dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.md },
    dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
    dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
    dayName: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: '600', flexShrink: 1 },
    exerciseCount: { color: 'rgba(255,255,255,0.7)', fontSize: Fonts.sizes.xs },

    // Exercise list
    exerciseList: { padding: Spacing.sm },
    exerciseRow: {
        flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
        paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    exerciseRowDone: { opacity: 0.6 },
    checkbox: {
        width: 24, height: 24, borderRadius: 6, borderWidth: 2,
        borderColor: Colors.textMuted, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2,
    },
    checkboxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
    exerciseInfo: { flex: 1 },
    exerciseName: { color: Colors.textPrimary, fontSize: Fonts.sizes.md, fontWeight: '500' },
    exerciseNameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
    exerciseDetail: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, marginTop: 2 },
    exerciseNote: { color: Colors.warning, fontSize: Fonts.sizes.xs, marginTop: 4 },
    dayNote: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, padding: Spacing.sm, fontStyle: 'italic' },

    // General notes
    generalNotes: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
    generalNotesTitle: { color: Colors.primary, fontSize: Fonts.sizes.md, fontWeight: '600', marginBottom: 6 },
    generalNotesText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, lineHeight: 20 },

    // Regen button
    regenBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 14, borderWidth: 1, borderColor: Colors.primary,
        borderRadius: Radius.md, marginTop: Spacing.lg,
    },
    regenBtnText: { color: Colors.primary, fontSize: Fonts.sizes.md, fontWeight: '600' },
    deleteBtn: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
    addExerciseBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10,
        paddingHorizontal: Spacing.sm, marginTop: 4,
    },
    addExerciseText: { color: Colors.primary, fontSize: Fonts.sizes.sm, fontWeight: '500' },

    // Empty state
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: 120 },
    emptyIconWrap: {
        width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.primaryGlow,
        justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
    },
    emptyTitle: { color: Colors.textPrimary, fontSize: Fonts.sizes.xl, fontWeight: '700', marginBottom: 8 },
    emptySubtitle: { color: Colors.textSecondary, fontSize: Fonts.sizes.md, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
    generateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.primary, paddingVertical: 16, paddingHorizontal: 32,
        borderRadius: Radius.lg,
    },
    generateBtnText: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: '700' },
    emptyHint: { color: Colors.warning, fontSize: Fonts.sizes.xs, marginTop: Spacing.md, textAlign: 'center' },
    reqInputGroup: { width: '100%', marginBottom: Spacing.lg, paddingHorizontal: Spacing.xl },
    reqLabel: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontWeight: '600', marginBottom: 8 },
    reqInput: {
        backgroundColor: Colors.surface, color: Colors.textPrimary,
        padding: Spacing.md, borderRadius: Radius.md,
        minHeight: 80, textAlignVertical: 'top',
        fontSize: Fonts.sizes.md, borderWidth: 1, borderColor: Colors.border
    },
    generateBtnDisabled: { backgroundColor: Colors.border },
    regenBtnDisabled: { borderColor: Colors.border },
    quotaHint: { color: Colors.warning, fontSize: Fonts.sizes.xs, fontWeight: '600', marginTop: 12, textAlign: 'center' },
});
