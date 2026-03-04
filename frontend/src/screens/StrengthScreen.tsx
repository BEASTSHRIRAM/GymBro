// GymBro — Activity Logging & Goals Screen (Strength & Cardio)
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { Colors, Spacing, Radius, Fonts } from '../theme';

const STRENGTH_EXERCISES = ['squat', 'bench_press', 'deadlift', 'shoulder_press', 'lat_pull_down', 'barbell_row', 'pull_up', 'bicep_curl'];
const CARDIO_EXERCISES = ['running', 'cycling', 'swimming', 'rowing_machine', 'stair_climber'];

interface LogEntry {
    id: string;
    weight_kg?: number;
    reps?: number;
    duration_minutes?: number;
    distance_km?: number;
    logged_at: string;
}

interface Goal {
    target_weight_kg?: number;
    target_duration_minutes?: number;
    target_distance_km?: number;
    created_at: string;
    completed_at?: string;
}

interface ActivityData {
    active_goal: Goal | null;
    logs: LogEntry[];
    completed_goals: Goal[];
}

type TabType = 'strength' | 'cardio';

export default function StrengthScreen() {
    const [activeTab, setActiveTab] = useState<TabType>('strength');
    const [exercise, setExercise] = useState('squat');

    // Strength Form
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [goalWeight, setGoalWeight] = useState('');

    // Cardio Form
    const [duration, setDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [goalDuration, setGoalDuration] = useState('');
    const [goalDistance, setGoalDistance] = useState('');

    const [data, setData] = useState<ActivityData>({ active_goal: null, logs: [], completed_goals: [] });
    const [isLoading, setIsLoading] = useState(false);

    // Switch tabs safely
    const handleTabSwitch = (tab: TabType) => {
        setActiveTab(tab);
        setExercise(tab === 'strength' ? STRENGTH_EXERCISES[0] : CARDIO_EXERCISES[0]);
        // Clear forms
        setWeight(''); setReps(''); setGoalWeight('');
        setDuration(''); setDistance(''); setGoalDuration(''); setGoalDistance('');
    };

    useEffect(() => {
        fetchData();
    }, [exercise, activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/strength/data/${activeTab}/${exercise}`);
            setData(res.data);
        } catch {
            setData({ active_goal: null, logs: [], completed_goals: [] });
        } finally {
            setIsLoading(false);
        }
    };

    const logWorkout = async () => {
        setIsLoading(true);
        try {
            const payload: any = {
                activity_type: activeTab,
                exercise_name: exercise,
            };

            if (activeTab === 'strength') {
                if (!weight || !reps) throw new Error('Enter weight and reps');
                payload.weight_kg = parseFloat(weight);
                payload.reps = parseInt(reps);
            } else {
                if (!duration) throw new Error('Enter duration (minutes) at minimum');
                payload.duration_minutes = parseInt(duration);
                if (distance) payload.distance_km = parseFloat(distance);
            }

            await api.post('/strength/log', payload);

            setWeight(''); setReps('');
            setDuration(''); setDistance('');
            fetchData();
        } catch (e: any) {
            Alert.alert('GymBro', e.message || e.response?.data?.detail || 'Failed to log workout');
            setIsLoading(false);
        }
    };

    const setGoal = async () => {
        setIsLoading(true);
        try {
            const payload: any = {
                activity_type: activeTab,
                exercise_name: exercise,
            };

            if (activeTab === 'strength') {
                if (!goalWeight) throw new Error('Enter target weight');
                payload.target_weight_kg = parseFloat(goalWeight);
            } else {
                if (!goalDuration && !goalDistance) throw new Error('Enter a target duration or distance');
                if (goalDuration) payload.target_duration_minutes = parseInt(goalDuration);
                if (goalDistance) payload.target_distance_km = parseFloat(goalDistance);
            }

            await api.post('/strength/goal', payload);

            setGoalWeight(''); setGoalDuration(''); setGoalDistance('');
            fetchData();
        } catch (e: any) {
            Alert.alert('GymBro', e.message || e.response?.data?.detail || 'Failed to set goal');
            setIsLoading(false);
        }
    };

    const completeGoal = async () => {
        setIsLoading(true);
        try {
            await api.post('/strength/goal/complete', {
                activity_type: activeTab,
                exercise_name: exercise,
            });
            fetchData();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail ?? 'Failed to complete goal');
            setIsLoading(false);
        }
    };

    const formatDate = (ds: string) => {
        const d = new Date(ds);
        return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}, ${d.getFullYear()}`;
    };

    // Render helpers for dynamic text
    const formatGoalTarget = (goal: Goal) => {
        if (goal.target_weight_kg) return `${goal.target_weight_kg} kg`;
        const parts = [];
        if (goal.target_distance_km) parts.push(`${goal.target_distance_km} km`);
        if (goal.target_duration_minutes) parts.push(`${goal.target_duration_minutes} mins`);
        return parts.join(' in ');
    };

    const formatLogItem = (log: LogEntry) => {
        if (activeTab === 'strength') return `${log.weight_kg} kg × ${log.reps} reps`;
        const parts = [];
        if (log.distance_km) parts.push(`${log.distance_km} km`);
        if (log.duration_minutes) parts.push(`${log.duration_minutes} mins`);
        return parts.join(' in ');
    };

    const currentExercises = activeTab === 'strength' ? STRENGTH_EXERCISES : CARDIO_EXERCISES;

    return (
        <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={st.header}>
                <Text style={st.title}>Activity Logging</Text>
            </View>

            {/* Top Tab Switcher */}
            <View style={st.tabContainer}>
                <TouchableOpacity
                    style={[st.tabBtn, activeTab === 'strength' && st.tabBtnActive]}
                    onPress={() => handleTabSwitch('strength')}
                >
                    <Text style={[st.tabText, activeTab === 'strength' && st.tabTextActive]}>Strength</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[st.tabBtn, activeTab === 'cardio' && st.tabBtnActive]}
                    onPress={() => handleTabSwitch('cardio')}
                >
                    <Text style={[st.tabText, activeTab === 'cardio' && st.tabTextActive]}>Cardio</Text>
                </TouchableOpacity>
            </View>

            {/* Exercise Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.exScroll}>
                {currentExercises.map((ex) => (
                    <TouchableOpacity
                        key={ex}
                        style={[st.exBtn, exercise === ex && st.exBtnActive]}
                        onPress={() => setExercise(ex)}
                    >
                        <Text style={[st.exText, exercise === ex && st.exTextActive]}>
                            {ex.replace(/_/g, ' ')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Log a Set / Session */}
            <View style={st.card}>
                <Text style={st.cardTitle}>{activeTab === 'strength' ? 'Log a Set' : 'Log Session'}</Text>
                <View style={st.row}>
                    {activeTab === 'strength' ? (
                        <>
                            <View style={[st.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <TextInput style={st.input} placeholder="Weight (kg)" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
                            </View>
                            <View style={[st.inputGroup, { flex: 1 }]}>
                                <TextInput style={st.input} placeholder="Reps" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" value={reps} onChangeText={setReps} />
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={[st.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <TextInput style={st.input} placeholder="Duration (min)" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" value={duration} onChangeText={setDuration} />
                            </View>
                            <View style={[st.inputGroup, { flex: 1 }]}>
                                <TextInput style={st.input} placeholder="Distance (km) opt." placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" value={distance} onChangeText={setDistance} />
                            </View>
                        </>
                    )}
                </View>
                <TouchableOpacity style={st.logBtn} onPress={logWorkout} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={st.logBtnText}>Log It</Text>}
                </TouchableOpacity>
            </View>

            {/* Active Goal */}
            <View style={st.card}>
                <Text style={st.cardTitle}>Active Goal</Text>
                {isLoading && !data.active_goal && data.logs.length === 0 ? (
                    <ActivityIndicator color={Colors.primary} style={{ marginTop: 10 }} />
                ) : data.active_goal ? (
                    <View style={st.goalContainer}>
                        <View style={st.goalDetails}>
                            <Text style={st.goalTarget}>Target: <Text style={st.goalHighlight}>{formatGoalTarget(data.active_goal)}</Text></Text>
                            <Text style={st.goalDate}>Set on {formatDate(data.active_goal.created_at)}</Text>
                        </View>
                        <TouchableOpacity style={st.completeBtn} onPress={completeGoal} disabled={isLoading}>
                            <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
                            <Text style={st.completeBtnText}>Complete</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
                        <Text style={st.noGoalText}>You have no active goal for this activity.</Text>
                        <View style={st.row}>
                            {activeTab === 'strength' ? (
                                <View style={[st.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <TextInput style={st.input} placeholder="Target Weight (kg)" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" value={goalWeight} onChangeText={setGoalWeight} />
                                </View>
                            ) : (
                                <>
                                    <View style={[st.inputGroup, { flex: 1, marginRight: 4 }]}>
                                        <TextInput style={st.input} placeholder="Target Min" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" value={goalDuration} onChangeText={setGoalDuration} />
                                    </View>
                                    <View style={[st.inputGroup, { flex: 1, marginRight: 8 }]}>
                                        <TextInput style={st.input} placeholder="Target km" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" value={goalDistance} onChangeText={setGoalDistance} />
                                    </View>
                                </>
                            )}
                            <TouchableOpacity style={[st.logBtn, { flex: 0.8, marginTop: 0 }]} onPress={setGoal} disabled={isLoading}>
                                <Text style={st.logBtnText}>Set Goal</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* History */}
            <View style={st.card}>
                <Text style={st.cardTitle}>History</Text>
                {data.logs.length === 0 && data.completed_goals.length === 0 ? (
                    <Text style={st.emptyText}>No history available for this activity yet.</Text>
                ) : (
                    <View>
                        {data.completed_goals.map((goal, idx) => (
                            <View key={`goal-${idx}`} style={st.historyItemGoal}>
                                <Ionicons name="checkmark-circle" size={20} color={Colors.success} style={{ marginRight: 8 }} />
                                <View>
                                    <Text style={st.historyItemTextGoal}>Completed Goal: {formatGoalTarget(goal)}</Text>
                                    <Text style={st.historyItemDate}>{formatDate(goal.completed_at!)}</Text>
                                </View>
                            </View>
                        ))}
                        {data.logs.map((log) => (
                            <View key={log.id} style={st.historyItem}>
                                <View style={st.historyIconWrapper}>
                                    <Ionicons name={activeTab === 'strength' ? 'barbell' : 'walk'} size={18} color={Colors.primary} />
                                </View>
                                <View style={st.historyDetails}>
                                    <Text style={st.historyItemText}>{formatLogItem(log)}</Text>
                                    <Text style={st.historyItemDate}>{formatDate(log.logged_at)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: 16 },
    title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
    tabContainer: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: 16, backgroundColor: Colors.surface, borderRadius: Radius.full, padding: 4 },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.full },
    tabBtnActive: { backgroundColor: Colors.primary },
    tabText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Fonts.sizes.sm },
    tabTextActive: { color: '#fff' },
    exScroll: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    exBtn: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full,
        borderWidth: 1, borderColor: Colors.border, marginRight: 8,
        backgroundColor: Colors.surface, height: 38,
    },
    exBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    exText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, textTransform: 'capitalize' },
    exTextActive: { color: '#fff', fontWeight: '700' },
    card: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
    },
    cardTitle: { fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
    row: { flexDirection: 'row', marginBottom: 8 },
    inputGroup: {
        backgroundColor: Colors.surface, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8,
    },
    input: { color: Colors.textPrimary, fontSize: Fonts.sizes.md, paddingVertical: 12, textAlign: 'center' },
    logBtn: {
        backgroundColor: Colors.primary, borderRadius: Radius.md,
        paddingVertical: 14, alignItems: 'center', marginTop: 4,
    },
    logBtnText: { color: '#fff', fontWeight: '800', fontSize: Fonts.sizes.md },
    goalContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, padding: 16, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
    goalDetails: { flex: 1 },
    goalTarget: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, marginBottom: 4 },
    goalHighlight: { fontSize: Fonts.sizes.xl, color: Colors.primary, fontWeight: '800' },
    goalDate: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
    completeBtn: { alignItems: 'center', paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: Colors.border },
    completeBtnText: { fontSize: Fonts.sizes.xs, color: Colors.success, fontWeight: '700', marginTop: 4 },
    noGoalText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, marginBottom: 12 },
    emptyText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
    historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
    historyIconWrapper: { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    historyDetails: { flex: 1 },
    historyItemText: { fontSize: Fonts.sizes.md, color: Colors.textPrimary, fontWeight: '600' },
    historyItemDate: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
    historyItemGoal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: 'rgba(34, 197, 94, 0.05)', paddingHorizontal: 8, borderRadius: Radius.sm },
    historyItemTextGoal: { fontSize: Fonts.sizes.md, color: Colors.success, fontWeight: '700' },
});
