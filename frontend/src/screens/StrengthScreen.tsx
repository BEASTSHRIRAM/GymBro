// GymBro — Strength Predictor Screen
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { Colors, Spacing, Radius, Fonts } from '../theme';

const EXERCISES = ['squat', 'bench_press', 'deadlift', 'shoulder_press'];

interface Prediction {
    current_1rm: number;
    predicted_4_week: number;
    predicted_8_week: number;
    weekly_data: { week: number; orm: number }[];
}

export default function StrengthScreen() {
    const [exercise, setExercise] = useState('squat');
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const logWorkout = async () => {
        if (!weight || !reps) {
            Alert.alert('GymBro', 'Enter weight (kg) and reps');
            return;
        }
        setIsLoading(true);
        try {
            const { data } = await api.post('/strength/log', {
                exercise_name: exercise,
                weight_kg: parseFloat(weight),
                reps: parseInt(reps),
            });
            Alert.alert('✅ Logged!', `Estimated 1RM: ${data.estimated_1rm} kg`);
            setWeight('');
            setReps('');
            fetchPrediction();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail ?? 'Failed to log workout');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPrediction = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get(`/strength/predict/${exercise}`);
            setPrediction(data);
        } catch {
            // No logs yet — that's fine
        } finally {
            setIsLoading(false);
        }
    };

    const ProjectionBar = ({ label, value, max, color }: any) => (
        <View style={st.projRow}>
            <Text style={st.projLabel}>{label}</Text>
            <View style={st.projBarBg}>
                <View style={[st.projBarFill, { width: `${Math.min((value / max) * 100, 100)}%`, backgroundColor: color }]} />
            </View>
            <Text style={[st.projValue, { color }]}>{value} kg</Text>
        </View>
    );

    const maxVal = prediction ? Math.max(prediction.current_1rm, prediction.predicted_8_week) * 1.1 : 100;

    return (
        <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={st.header}>
                <Text style={st.title}>📈 Strength Predictor</Text>
            </View>

            {/* Exercise Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.exScroll}>
                {EXERCISES.map((ex) => (
                    <TouchableOpacity
                        key={ex}
                        style={[st.exBtn, exercise === ex && st.exBtnActive]}
                        onPress={() => { setExercise(ex); setPrediction(null); }}
                    >
                        <Text style={[st.exText, exercise === ex && st.exTextActive]}>
                            {ex.replace(/_/g, ' ')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Log Workout */}
            <View style={st.card}>
                <Text style={st.cardTitle}>Log a Set</Text>
                <View style={st.row}>
                    <View style={[st.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <TextInput
                            style={st.input}
                            placeholder="Weight (kg)"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="decimal-pad"
                            value={weight}
                            onChangeText={setWeight}
                        />
                    </View>
                    <View style={[st.inputGroup, { flex: 1 }]}>
                        <TextInput
                            style={st.input}
                            placeholder="Reps"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="number-pad"
                            value={reps}
                            onChangeText={setReps}
                        />
                    </View>
                </View>
                <TouchableOpacity style={st.logBtn} onPress={logWorkout} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={st.logBtnText}>📝 Log & Predict</Text>}
                </TouchableOpacity>
            </View>

            {/* Prediction Results */}
            {prediction && (
                <View style={st.card}>
                    <Text style={st.cardTitle}>Strength Projections</Text>
                    <View style={st.rmRow}>
                        <Text style={st.rmLabel}>Current 1RM</Text>
                        <Text style={st.rmValue}>{prediction.current_1rm} <Text style={st.rmUnit}>kg</Text></Text>
                    </View>
                    <ProjectionBar label="Now" value={prediction.current_1rm} max={maxVal} color={Colors.primary} />
                    <ProjectionBar label="4 Weeks" value={prediction.predicted_4_week} max={maxVal} color="#22C55E" />
                    <ProjectionBar label="8 Weeks" value={prediction.predicted_8_week} max={maxVal} color="#3B82F6" />

                    <Text style={st.formulaNote}>
                        📐 Epley & Brzycki formulae · Linear regression on {prediction.weekly_data.length} training weeks
                    </Text>
                </View>
            )}

            {!prediction && !isLoading && (
                <View style={st.emptyCard}>
                    <Text style={st.emptyIcon}>⚡</Text>
                    <Text style={st.emptyText}>Log your first set to see predictions</Text>
                    <TouchableOpacity onPress={fetchPrediction} style={st.loadBtn}>
                        <Text style={st.loadBtnText}>Load Existing Data</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: 16 },
    title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
    exScroll: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    exBtn: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full,
        borderWidth: 1, borderColor: Colors.border, marginRight: 8,
        backgroundColor: Colors.surface,
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
    rmRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    rmLabel: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, alignSelf: 'flex-end' },
    rmValue: { fontSize: Fonts.sizes.display, fontWeight: '900', color: Colors.primary },
    rmUnit: { fontSize: Fonts.sizes.lg, color: Colors.textSecondary },
    projRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    projLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, width: 58 },
    projBarBg: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
    projBarFill: { height: '100%', borderRadius: Radius.full },
    projValue: { fontSize: Fonts.sizes.sm, fontWeight: '700', width: 56, textAlign: 'right' },
    formulaNote: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 8 },
    emptyCard: {
        alignItems: 'center', padding: 40,
        margin: Spacing.lg, backgroundColor: Colors.card,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
    loadBtn: {
        paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary,
    },
    loadBtnText: { color: Colors.primary, fontWeight: '700' },
});
