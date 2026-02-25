// GymBro — AI Form Checker Screen
// Real-time exercise form analysis via WebSocket + Expo Camera + Deepgram TTS
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Alert, Platform, Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useGamificationStore } from '../stores/gamificationStore';
import { formCheckerSocket } from '../services/websocket';
import { playAudioBase64, stopAudio } from '../services/audioService';
import { Colors, Spacing, Radius, Fonts, getFormScoreColor } from '../theme';

const { width, height } = Dimensions.get('window');

const EXERCISES = [
    { key: 'squat', label: 'Squat', icon: '🏋️' },
    { key: 'bench_press', label: 'Bench Press', icon: '💪' },
    { key: 'deadlift', label: 'Deadlift', icon: '⚡' },
    { key: 'shoulder_press', label: 'Shoulder Press', icon: '🎯' },
];

export default function FormCheckerScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [isRecording, setIsRecording] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState('squat');

    const { user } = useAuthStore();
    const {
        sessionId, repCount, formScore, faults, feedback,
        voiceEnabled, startSession, endSession, updateAnalysis, toggleVoice,
    } = useWorkoutStore();
    const { awardXP } = useGamificationStore();

    const cameraRef = useRef<CameraView>(null);
    const frameInterval = useRef<NodeJS.Timeout | null>(null);

    // ── Start session ────────────────────────────────────────────────────────
    const handleStart = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Permission', 'Camera access is required for form checking.');
                return;
            }
        }
        startSession(selectedExercise, user?.id ?? '');
        formCheckerSocket.connect(
            sessionId || `s_${Date.now()}`,
            user?.id ?? '',
            selectedExercise,
            (data) => {
                updateAnalysis({
                    repCount: data.rep_count,
                    formScore: data.form_score,
                    faults: data.faults,
                    feedback: data.feedback,
                    jointAngles: data.joint_angles,
                });
                if (data.audio && voiceEnabled) {
                    playAudioBase64(data.audio);
                }
            },
            (err) => console.error('[FormChecker] WS Error:', err)
        );
        setIsRecording(true);

        // Send frames every 300ms (~3fps to backend — balance latency/quality)
        frameInterval.current = setInterval(captureAndSendFrame, 300);
    };

    // ── Stop session ─────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (frameInterval.current) clearInterval(frameInterval.current);
        formCheckerSocket.disconnect();
        setIsRecording(false);
        await stopAudio();
        await awardXP('workout_complete', formScore);
        endSession();
    };

    // ── Capture & stream frame ────────────────────────────────────────────────
    const captureAndSendFrame = useCallback(async () => {
        if (!cameraRef.current || !formCheckerSocket.isConnected()) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.3,    // Low quality = smaller base64 = lower latency
                base64: true,
                skipProcessing: true,
            });
            if (photo?.base64) {
                formCheckerSocket.sendFrame(photo.base64, selectedExercise, voiceEnabled);
            }
        } catch { /* Camera busy — skip frame */ }
    }, [selectedExercise, voiceEnabled]);

    useEffect(() => {
        return () => {
            if (frameInterval.current) clearInterval(frameInterval.current);
            formCheckerSocket.disconnect();
        };
    }, []);

    if (!permission) return <View style={styles.container} />;

    return (
        <View style={styles.container}>
            {/* Camera View */}
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
            >
                {/* Top bar */}
                <View style={styles.topBar}>
                    <Text style={styles.appName}>GymBro</Text>
                    <View style={styles.topRight}>
                        <TouchableOpacity onPress={toggleVoice} style={styles.iconBtn}>
                            <Ionicons
                                name={voiceEnabled ? 'volume-high' : 'volume-mute'}
                                size={22}
                                color={voiceEnabled ? Colors.primary : Colors.textMuted}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
                            style={styles.iconBtn}
                        >
                            <Ionicons name="camera-reverse" size={22} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Form Score HUD */}
                {isRecording && (
                    <View style={styles.hud}>
                        <View style={[styles.scoreCircle, { borderColor: getFormScoreColor(formScore) }]}>
                            <Text style={[styles.scoreValue, { color: getFormScoreColor(formScore) }]}>
                                {Math.round(formScore)}
                            </Text>
                            <Text style={styles.scoreLabel}>FORM</Text>
                        </View>
                        <View style={styles.repBox}>
                            <Text style={styles.repValue}>{repCount}</Text>
                            <Text style={styles.repLabel}>REPS</Text>
                        </View>
                    </View>
                )}

                {/* Feedback Banner */}
                {isRecording && feedback ? (
                    <View style={styles.feedbackBanner}>
                        <Ionicons name="mic" size={14} color={Colors.primary} />
                        <Text style={styles.feedbackText} numberOfLines={2}>{feedback}</Text>
                    </View>
                ) : null}

                {/* Faults */}
                {isRecording && faults.length > 0 && (
                    <View style={styles.faultRow}>
                        {faults.map((f) => (
                            <View key={f} style={styles.faultChip}>
                                <Text style={styles.faultText}>⚠️ {f.replace(/_/g, ' ')}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Bottom controls */}
                <View style={styles.bottomBar}>
                    {/* Exercise selector */}
                    {!isRecording && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
                            {EXERCISES.map((ex) => (
                                <TouchableOpacity
                                    key={ex.key}
                                    style={[styles.exBtn, selectedExercise === ex.key && styles.exBtnActive]}
                                    onPress={() => setSelectedExercise(ex.key)}
                                >
                                    <Text style={styles.exIcon}>{ex.icon}</Text>
                                    <Text style={[styles.exLabel, selectedExercise === ex.key && styles.exLabelActive]}>
                                        {ex.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Record button */}
                    <TouchableOpacity
                        style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                        onPress={isRecording ? handleStop : handleStart}
                    >
                        <View style={isRecording ? styles.stopIcon : styles.startIcon} />
                    </TouchableOpacity>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    camera: { flex: 1 },
    topBar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    appName: { color: Colors.primary, fontSize: Fonts.sizes.lg, fontWeight: '900' },
    topRight: { flexDirection: 'row', gap: 12 },
    iconBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radius.full },
    hud: {
        position: 'absolute', top: 110, right: Spacing.lg,
        gap: 12, alignItems: 'center',
    },
    scoreCircle: {
        width: 72, height: 72, borderRadius: 36,
        borderWidth: 3, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center',
    },
    scoreValue: { fontSize: Fonts.sizes.xl, fontWeight: '900' },
    scoreLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
    repBox: {
        width: 60, height: 60, borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
    },
    repValue: { fontSize: Fonts.sizes.xxl, fontWeight: '900', color: Colors.textPrimary },
    repLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
    feedbackBanner: {
        position: 'absolute', bottom: 160, left: Spacing.lg, right: 96,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: Radius.md,
        borderLeftWidth: 3, borderLeftColor: Colors.primary,
        paddingHorizontal: 12, paddingVertical: 8,
    },
    feedbackText: { color: Colors.textPrimary, fontSize: Fonts.sizes.sm, flex: 1 },
    faultRow: {
        position: 'absolute', bottom: 140, left: Spacing.lg,
        flexDirection: 'row', flexWrap: 'wrap', gap: 4,
    },
    faultChip: {
        backgroundColor: 'rgba(239,68,68,0.85)', borderRadius: Radius.full,
        paddingHorizontal: 10, paddingVertical: 4,
    },
    faultText: { color: '#fff', fontSize: Fonts.sizes.xs, fontWeight: '600' },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', padding: Spacing.md,
        alignItems: 'center',
    },
    exerciseScroll: { marginBottom: Spacing.md },
    exBtn: {
        alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: Radius.full, borderWidth: 1,
        borderColor: Colors.border, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.1)',
    },
    exBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    exIcon: { fontSize: 18 },
    exLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
    exLabelActive: { color: '#fff', fontWeight: '700' },
    recordBtn: {
        width: 72, height: 72, borderRadius: 36,
        borderWidth: 4, borderColor: Colors.primary,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    recordBtnActive: { borderColor: Colors.error },
    startIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary },
    stopIcon: { width: 24, height: 24, borderRadius: 4, backgroundColor: Colors.error },
});
