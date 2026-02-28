// GymBro — AI Gym Trainer with Vision Agents
// Real-time AI coaching with voice feedback
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useGamificationStore } from '../stores/gamificationStore';
import { Colors, Spacing, Radius, Fonts } from '../theme';
import { visionAgentsWS } from '../services/visionAgentsWS';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.188:8000';

const EXERCISES = [
    { key: 'squat', label: 'Squat', icon: '🏋️' },
    { key: 'bench_press', label: 'Bench Press', icon: '💪' },
    { key: 'deadlift', label: 'Deadlift', icon: '⚡' },
    { key: 'shoulder_press', label: 'Shoulder Press', icon: '🎯' },
];

export default function VideoCallFormCheckerScreen() {
    const [isLoading, setIsLoading] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [selectedExercise, setSelectedExercise] = useState('squat');
    const [trainerMessage, setTrainerMessage] = useState('');
    const [sessionDuration, setSessionDuration] = useState(0);
    const [repCount, setRepCount] = useState(0);
    const [formScore, setFormScore] = useState(0);
    const [faults, setFaults] = useState<string[]>([]);

    const { user } = useAuthStore();
    const { startSession, endSession } = useWorkoutStore();
    const { awardXP } = useGamificationStore();
    
    const cameraRef = useRef<CameraView>(null);
    const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [permission, requestPermission] = useCameraPermissions();

    // Timer for session duration
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTraining) {
            interval = setInterval(() => {
                setSessionDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTraining]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (frameIntervalRef.current) {
                clearInterval(frameIntervalRef.current);
            }
            if (isTraining) {
                visionAgentsWS.disconnect();
            }
        };
    }, [isTraining]);

    // ── Start AI training session ────────────────────────────────────────────
    const handleStartTraining = async () => {
        if (!user?.id) {
            Alert.alert('Error', 'Please log in to start training');
            return;
        }

        // Request camera permission
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert('Error', 'Camera permission is required for AI training');
                return;
            }
        }

        setIsLoading(true);
        try {
            const sessionId = `va_${user.id}_${selectedExercise}_${Date.now()}`;
            
            // Connect WebSocket
            await visionAgentsWS.connect(
                sessionId,
                user.id,
                selectedExercise,
                async (msg) => {
                    if (msg.type === 'session_started') {
                        setTrainerMessage(msg.message);
                    } else if (msg.type === 'analysis') {
                        setTrainerMessage(msg.feedback);
                        setRepCount(msg.rep_count);
                        setFormScore(msg.form_score);
                        setFaults(msg.faults);
                        // Play audio feedback
                        if (msg.audio_base64) {
                            await visionAgentsWS.playAudio(msg.audio_base64);
                        }
                    } else if (msg.type === 'session_ended') {
                        Alert.alert(
                            'Training Complete! 🎉',
                            `Duration: ${Math.floor(sessionDuration / 60)}m ${sessionDuration % 60}s\nReps: ${msg.total_reps}\nForm Score: ${msg.avg_form_score.toFixed(1)}%\n\nFeedback: ${msg.feedback}`,
                            [{ text: 'OK' }]
                        );
                    }
                },
                (err) => {
                    console.error('[AITrainer] WS Error:', err);
                    Alert.alert('Error', 'Connection failed: ' + err.message);
                }
            );

            setSessionId(sessionId);
            setIsTraining(true);
            setSessionDuration(0);
            startSession(selectedExercise, user.id);

            // Start sending frames every 500ms
            frameIntervalRef.current = setInterval(captureAndSendFrame, 500);

        } catch (error: any) {
            console.error('[AITrainer] Start error:', error);
            Alert.alert(
                'Error',
                error.message || 'Failed to start training'
            );
        } finally {
            setIsLoading(false);
        }
    };

    // ── End AI training session ──────────────────────────────────────────────
    const handleEndTraining = async () => {
        if (!sessionId) return;

        setIsLoading(true);
        try {
            // Stop sending frames immediately
            if (frameIntervalRef.current) {
                clearInterval(frameIntervalRef.current);
                frameIntervalRef.current = null;
            }

            // Send end session message and wait for response
            visionAgentsWS.endSession();
            
            // Give server time to process and send final message
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Disconnect WebSocket
            visionAgentsWS.disconnect();

            // Award XP
            const avgScore = formScore || 0;
            await awardXP('workout_complete', avgScore);

            // Reset state
            setIsTraining(false);
            setSessionId(null);
            setTrainerMessage('');
            setSessionDuration(0);
            setRepCount(0);
            setFormScore(0);
            setFaults([]);
            endSession();

        } catch (error: any) {
            console.error('[AITrainer] End error:', error);
            Alert.alert(
                'Error',
                error.message || 'Failed to end training'
            );
        } finally {
            setIsLoading(false);
        }
    };

    // ── Capture & analyze frame ─────────────────────────────────────────────
    const captureAndSendFrame = useCallback(async () => {
        if (!sessionId || !visionAgentsWS.isConnected() || !cameraRef.current) return;
        try {
            // Capture frame from camera
            const photo = await cameraRef.current.takePictureAsync({
                base64: true,
                quality: 0.5,
                skipProcessing: true,
            });
            
            if (photo?.base64) {
                console.log(`[AITrainer] Sending frame (${photo.base64.length} bytes)`);
                visionAgentsWS.sendFrame(photo.base64, Date.now());
            } else {
                console.warn('[AITrainer] No base64 data from camera');
            }
        } catch (error) {
            console.error('[AITrainer] Frame capture error:', error);
        }
    }, [sessionId]);

    // ── Render training UI ───────────────────────────────────────────────────
    if (isTraining && sessionId) {
        return (
            <View style={styles.trainingContainer}>
                {/* Camera Feed */}
                <CameraView
                    ref={cameraRef}
                    style={styles.cameraFeed}
                    facing="front"
                />

                {/* Overlay: Header */}
                <View style={styles.trainingHeader}>
                    <View style={styles.liveIndicator} />
                    <Text style={styles.trainingHeaderText}>
                        {selectedExercise.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text style={styles.timerText}>
                        {Math.floor(sessionDuration / 60)}:{String(sessionDuration % 60).padStart(2, '0')}
                    </Text>
                </View>

                {/* Overlay: Trainer Message */}
                <View style={styles.trainerMessageBox}>
                    <Ionicons name="chatbubble-ellipses" size={32} color={Colors.primary} />
                    <Text style={styles.trainerMessage}>{trainerMessage}</Text>
                </View>

                {/* Overlay: Stats */}
                <View style={styles.statsBox}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Reps</Text>
                        <Text style={styles.statValue}>{repCount}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Form</Text>
                        <Text style={styles.statValue}>{formScore.toFixed(0)}%</Text>
                    </View>
                </View>

                {/* Overlay: End Button */}
                <TouchableOpacity
                    style={styles.endTrainingButton}
                    onPress={handleEndTraining}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="stop-circle" size={24} color="#fff" />
                            <Text style={styles.endTrainingText}>End Training</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        );
    }

    // ── Render setup UI ──────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.appName}>GymBro</Text>
                <Text style={styles.subtitle}>AI Video Trainer</Text>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsCard}>
                <Ionicons name="information-circle" size={32} color={Colors.primary} />
                <Text style={styles.instructionsTitle}>How it works</Text>
                <Text style={styles.instructionsText}>
                    1. Select your exercise{'\n'}
                    2. Start AI training{'\n'}
                    3. Get real-time voice coaching{'\n'}
                    4. Complete your reps with form feedback
                </Text>
            </View>

            {/* Exercise selector */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Exercise</Text>
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
            </View>

            {/* Call controls */}
            <View style={styles.controls}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={Colors.primary} />
                ) : (
                    <TouchableOpacity
                        style={[styles.callBtn, styles.startCallBtn]}
                        onPress={handleStartTraining}
                    >
                        <Ionicons name="mic" size={24} color="#fff" />
                        <Text style={styles.callBtnText}>Start AI Training</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Technical note */}
            <View style={styles.techNote}>
                <Text style={styles.techNoteText}>
                    ⚡ Powered by Vision Agents SDK + Gemini 3.0 Flash + ElevenLabs TTS
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
        paddingTop: 60,
    },
    trainingContainer: {
        flex: 1,
        backgroundColor: Colors.bg,
        justifyContent: 'space-between',
    },
    cameraFeed: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,
    },
    trainingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: Radius.lg,
        justifyContent: 'space-between',
        marginTop: 60,
        marginHorizontal: Spacing.lg,
    },
    liveIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.error,
    },
    trainingHeaderText: {
        color: '#fff',
        fontSize: Fonts.sizes.md,
        fontWeight: '700',
        flex: 1,
        marginLeft: 12,
    },
    timerText: {
        color: Colors.primary,
        fontSize: Fonts.sizes.lg,
        fontWeight: '700',
    },
    trainerMessageBox: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: Spacing.xl,
        borderRadius: Radius.lg,
        alignItems: 'center',
        marginVertical: Spacing.xl,
        marginHorizontal: Spacing.lg,
    },
    trainerMessage: {
        color: '#fff',
        fontSize: Fonts.sizes.md,
        textAlign: 'center',
        marginTop: Spacing.md,
        lineHeight: 24,
    },
    statsBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        color: Colors.textSecondary,
        fontSize: Fonts.sizes.sm,
        fontWeight: '600',
    },
    statValue: {
        color: Colors.primary,
        fontSize: Fonts.sizes.xl,
        fontWeight: '700',
        marginTop: 4,
    },
    endTrainingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.error,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: Radius.full,
        gap: 12,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    endTrainingText: {
        color: '#fff',
        fontSize: Fonts.sizes.lg,
        fontWeight: '700',
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    appName: {
        color: Colors.primary,
        fontSize: Fonts.sizes.xxl,
        fontWeight: '900',
    },
    subtitle: {
        color: Colors.textSecondary,
        fontSize: Fonts.sizes.md,
        marginTop: 4,
    },
    instructionsCard: {
        backgroundColor: Colors.card,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
        padding: Spacing.xl,
        borderRadius: Radius.lg,
        alignItems: 'center',
    },
    instructionsTitle: {
        color: Colors.textPrimary,
        fontSize: Fonts.sizes.lg,
        fontWeight: '700',
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    instructionsText: {
        color: Colors.textSecondary,
        fontSize: Fonts.sizes.sm,
        textAlign: 'center',
        lineHeight: 22,
    },
    section: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        color: Colors.textPrimary,
        fontSize: Fonts.sizes.md,
        fontWeight: '700',
        marginBottom: Spacing.md,
    },
    exerciseScroll: {
        flexDirection: 'row',
    },
    exBtn: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: Radius.lg,
        borderWidth: 2,
        borderColor: Colors.border,
        marginRight: 12,
        backgroundColor: Colors.card,
        minWidth: 100,
    },
    exBtnActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    exIcon: {
        fontSize: 28,
        marginBottom: 4,
    },
    exLabel: {
        fontSize: Fonts.sizes.sm,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    exLabelActive: {
        color: '#fff',
        fontWeight: '700',
    },
    controls: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    callBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: Radius.full,
        minWidth: 200,
        gap: 12,
    },
    startCallBtn: {
        backgroundColor: Colors.primary,
    },
    callBtnText: {
        color: '#fff',
        fontSize: Fonts.sizes.lg,
        fontWeight: '700',
    },
    techNote: {
        padding: Spacing.lg,
        alignItems: 'center',
    },
    techNoteText: {
        color: Colors.textMuted,
        fontSize: Fonts.sizes.xs,
        textAlign: 'center',
    },
});
