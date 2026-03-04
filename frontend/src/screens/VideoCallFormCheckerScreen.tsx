// GymBro — AI Gym Trainer with Vision Agents + Stream Video
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Alert, ActivityIndicator, LayoutAnimation, Platform, UIManager,
    PermissionsAndroid,
} from 'react-native';
import {
    StreamVideo,
    StreamVideoClient,
    StreamCall,
    CallContent,
    Call,
    CallingState,
    callManager,
} from '@stream-io/video-react-native-sdk';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useGamificationStore } from '../stores/gamificationStore';
import { useProfileStore } from '../stores/profileStore';
import { Colors, Spacing, Radius, Fonts } from '../theme';
import api from '../services/api';

if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const EXERCISES = [
    { key: 'squat', label: 'Squat', icon: 'barbell-outline' },
    { key: 'bench_press', label: 'Bench Press', icon: 'fitness-outline' },
    { key: 'deadlift', label: 'Deadlift', icon: 'flash-outline' },
    { key: 'shoulder_press', label: 'Shoulder Press', icon: 'arrow-up-circle-outline' },
];

const EXERCISE_COLORS: Record<string, string> = {
    squat: '#FF6B35',
    bench_press: '#3B82F6',
    deadlift: '#22C55E',
    shoulder_press: '#A855F7',
};

interface SessionSummary {
    session_id: string;
    exercise: string;
    duration_seconds: number;
    total_reps: number;
    avg_form_score: number;
    faults: string[];
    timestamp: string;
}

function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

function formatDate(iso: string) {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
}

function SessionCard({ session }: { session: SessionSummary }) {
    const [expanded, setExpanded] = useState(false);
    const color = EXERCISE_COLORS[session.exercise] || Colors.primary;
    const exerciseEmoji = EXERCISES.find(e => e.key === session.exercise)?.icon || 'barbell-outline';
    const score = session.avg_form_score;
    const scoreColor = score >= 80 ? Colors.success : score >= 50 ? Colors.warning : Colors.error;

    return (
        <TouchableOpacity
            style={styles.sessionCard}
            onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setExpanded(e => !e);
            }}
            activeOpacity={0.8}
        >
            <View style={styles.sessionRow}>
                <View style={[styles.exerciseDot, { backgroundColor: color }]}>
                    <Ionicons name={exerciseEmoji as any} size={20} color="#fff" />
                </View>
                <View style={styles.sessionInfo}>
                    <Text style={styles.sessionExercise}>
                        {session.exercise.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                    <Text style={styles.sessionMeta}>
                        {formatDate(session.timestamp)} · {formatDuration(session.duration_seconds)}
                    </Text>
                </View>
                <View style={styles.sessionRight}>
                    {score > 0 && (
                        <Text style={[styles.scoreChip, { color: scoreColor, borderColor: scoreColor + '40', backgroundColor: scoreColor + '15' }]}>
                            {score.toFixed(0)}%
                        </Text>
                    )}
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={16} color={Colors.textMuted}
                        style={{ marginLeft: 6 }}
                    />
                </View>
            </View>

            {expanded && (
                <View style={styles.sessionDetails}>
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{session.total_reps || '—'}</Text>
                            <Text style={styles.statLabel}>Reps</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{formatDuration(session.duration_seconds)}</Text>
                            <Text style={styles.statLabel}>Duration</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: scoreColor }]}>
                                {score > 0 ? `${score.toFixed(0)}%` : '—'}
                            </Text>
                            <Text style={styles.statLabel}>Form</Text>
                        </View>
                    </View>
                    {session.faults && session.faults.length > 0 && (
                        <View style={styles.faultsSection}>
                            <Text style={styles.faultsTitle}>Form notes:</Text>
                            {session.faults.map((f, i) => (
                                <Text key={i} style={styles.faultItem}>• {f}</Text>
                            ))}
                        </View>
                    )}
                    {(!session.faults || session.faults.length === 0) && score === 0 && (
                        <Text style={styles.sessionNote}>
                            Session recorded. Keep training to build your AI coaching history!
                        </Text>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
}

export default function VideoCallFormCheckerScreen() {
    const [isLoading, setIsLoading] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [selectedExercise, setSelectedExercise] = useState('squat');
    const [sessionDuration, setSessionDuration] = useState(0);
    const [agentAvailable, setAgentAvailable] = useState<boolean | null>(null);

    // Audio device status (for in-call switching only)
    const [audioDeviceStatus, setAudioDeviceStatus] = useState<any>();

    // Recent sessions
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [showSessions, setShowSessions] = useState(false);

    const [streamClient, setStreamClient] = useState<StreamVideoClient | null>(null);
    const [activeCall, setActiveCall] = useState<Call | null>(null);

    const { user } = useAuthStore();
    const { profile, fetchProfile } = useProfileStore();
    const { startSession, endSession } = useWorkoutStore();
    const { awardXP } = useGamificationStore();
    const [status, setStatus] = useState<any>(null);

    const fetchStatus = async () => {
        try {
            const { data } = await api.get('/subscription/status');
            setStatus(data);
        } catch { }
    };

    const checkAgent = useCallback(async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                const { data } = await api.get('/gym-agent/status');
                setAgentAvailable(data.available);
                return;
            } catch {
                if (i < retries - 1) {
                    await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
                }
            }
        }
        setAgentAvailable(false);
    }, []);

    useEffect(() => {
        checkAgent();
        fetchStatus();
        if (!profile) fetchProfile();
    }, [checkAgent, profile]);

    useEffect(() => {
        if (Platform.OS === 'android') {
            callManager.android.getAudioDeviceStatus().then(setAudioDeviceStatus);
            const removeListener = callManager.android.addAudioDeviceChangeListener(setAudioDeviceStatus);
            return () => removeListener();
        }
    }, []);

    useEffect(() => {
        if (!isTraining) return;
        const timer = setInterval(() => setSessionDuration(d => d + 1), 1000);
        return () => clearInterval(timer);
    }, [isTraining]);

    const formatTimer = (s: number) =>
        `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    const loadSessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            const { data } = await api.get('/gym-agent/sessions');
            setSessions(data.sessions || []);
        } catch (e) {
            console.warn('[Sessions] Load failed:', e);
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    const toggleSessions = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (!showSessions && sessions.length === 0) loadSessions();
        setShowSessions(s => !s);
    };

    const isQuotaExhausted = status?.tier === 'free' && status?.usage?.ai_trainer?.remaining <= 0;

    const handleStartTraining = async () => {
        if (!user) { Alert.alert('Error', 'Please log in first'); return; }

        if (isQuotaExhausted) {
            Alert.alert(
                'Demo Finished',
                'You have used your free AI Trainer session. Upgrade to GymBro Premium for 35 sessions per month!'
            );
            return;
        }

        // Request camera + mic permissions before starting the call.
        // Without these, the video track won't publish and the AI can't see the user.
        if (Platform.OS === 'android') {
            try {
                const grants = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                ]);
                const camOk = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
                const micOk = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
                if (!camOk || !micOk) {
                    Alert.alert('Permissions Required', 'Camera and microphone access are needed for the AI coach to see and hear you.');
                    return;
                }
            } catch (e) {
                console.warn('[GymAgent] Permission request error:', e);
            }
        }

        setIsLoading(true);
        try {
            // 1. Fire backend session start
            const backendPromise = api.post('/gym-agent/start', { exercise: selectedExercise });

            // 2. While backend is creating the agent, we can't do much else,
            //    but we await it cleanly without any prior blocking Alert.
            const { data } = await backendPromise;
            if (data.error) throw new Error(data.error);
            const { session_id, call_id, call_type, stream_api_key } = data;

            const client = new StreamVideoClient({
                apiKey: stream_api_key,
                user: {
                    id: user.id,
                    name: user.name || 'GymBro User',
                    image: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=ff6b35&color=fff`,
                },
                tokenProvider: async () => {
                    const { data: tokenData } = await api.get('/api/stream/call-token', {
                        params: { user_id: user.id, call_id },
                    });
                    return tokenData.token;
                },
            });

            const call = client.call(call_type || 'default', call_id);

            // Join the call, then immediately enable camera + mic.
            // The backend agent needs the video track to be published
            // so YOLO can process frames and Gemini can see the user's
            // movements for rep counting & form coaching.
            await call.join({ create: true });

            // Enable camera + mic right after join so tracks are published ASAP
            try {
                await call.camera.enable();
            } catch (e) { console.warn('[GymAgent] Camera enable (non-fatal):', e); }
            try {
                await call.microphone.enable();
            } catch (e) { console.warn('[GymAgent] Mic enable (non-fatal):', e); }

            // Default to speakerphone for gym use (hands-free coaching)
            try {
                if (Platform.OS === 'android') {
                    const status = await callManager.android.getAudioDeviceStatus();
                    const speaker = status.devices?.find((d: string) => d.toLowerCase().includes('speaker'));
                    if (speaker) callManager.android.selectAudioDevice(speaker);
                }
            } catch (e) {
                console.warn('[GymAgent] Speaker default (non-fatal):', e);
            }

            setStreamClient(client);
            setActiveCall(call);
            setSessionId(session_id);
            setIsTraining(true);
            setSessionDuration(0);
            startSession(selectedExercise, user.id);
        } catch (error: any) {
            console.error('[GymAgent] Start error:', error);
            Alert.alert('Error', error.message || 'Failed to start training');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEndTraining = async () => {
        setIsTraining(false);
        setSessionDuration(0);
        // End Stream Call
        endSession();
        setSessionId(null);
        fetchStatus();
        loadSessions();

        const sid = sessionId;
        const call = activeCall;
        const client = streamClient;

        setActiveCall(null);
        setStreamClient(null);
        setIsLoading(true);

        try {
            if (sid) {
                try { await api.post('/gym-agent/end', { session_id: sid }); }
                catch (e) { console.warn('[GymAgent] Backend end (non-fatal):', e); }
            }
            if (call) {
                try {
                    if (call.state.callingState !== CallingState.LEFT) await call.leave();
                } catch (e) { console.warn('[GymAgent] Leave (non-fatal):', e); }
            }
            if (client) {
                try { await client.disconnectUser(); }
                catch (e) { console.warn('[GymAgent] Disconnect (non-fatal):', e); }
            }
            try { await awardXP('workout_complete', 85); }
            catch (e) { console.warn('[GymAgent] XP (non-fatal):', e); }

            // Refresh sessions after training ends
            await loadSessions();
            setSessions(s => s); // trigger re-render
        } catch (error) {
            console.error('[GymAgent] Failed to end session cleanly:', error);
            Alert.alert('Error', 'Failed to end session gracefully');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (activeCall?.state.callingState !== CallingState.LEFT) {
                activeCall?.leave().catch(() => { });
            }
            streamClient?.disconnectUser().catch(() => { });
        };
    }, [activeCall, streamClient]);

    // ── Training Call UI ─────────────────────────────────────────────────
    if (isTraining && streamClient && activeCall) {
        return (
            <StreamVideo client={streamClient}>
                <StreamCall call={activeCall}>
                    <View style={styles.trainingContainer}>
                        <View style={styles.trainingHeader}>
                            <View style={styles.headerLeft}>
                                <View style={styles.liveDot} />
                                <Text style={styles.headerLabel}>
                                    {EXERCISES.find(e => e.key === selectedExercise)?.icon}{' '}
                                    {EXERCISES.find(e => e.key === selectedExercise)?.label}
                                </Text>
                            </View>
                            <Text style={styles.timerText}>{formatTimer(sessionDuration)}</Text>
                        </View>
                        <CallContent onHangupCallHandler={handleEndTraining} />

                        {/* Audio Routing Toggle Button (Fallback for ICE Restarts) */}
                        <TouchableOpacity
                            style={styles.audioDeviceBtn}
                            activeOpacity={0.7}
                            onPress={async () => {
                                try {
                                    if (Platform.OS === 'ios') {
                                        callManager.ios.showDeviceSelector();
                                        return;
                                    }

                                    const status = await callManager.android.getAudioDeviceStatus();
                                    if (!status.devices || status.devices.length < 2) {
                                        Alert.alert("Audio Devices", "No other audio devices found.");
                                        return;
                                    }

                                    const buttons = status.devices.slice(0, 3).map((d: string) => ({
                                        text: d === status.selectedDevice ? `${d} ✓` : d,
                                        onPress: () => callManager.android.selectAudioDevice(d)
                                    }));

                                    Alert.alert(
                                        "Audio Output",
                                        "Choose where to route the coach's voice",
                                        buttons,
                                        { cancelable: true }
                                    );
                                } catch (e) {
                                    console.warn('[GymAgent] Audio device switch error:', e);
                                    Alert.alert("Error", "Could not load audio devices.");
                                }
                            }}
                        >
                            <Ionicons name="volume-high" size={16} color="#fff" />
                            <Text style={styles.audioDeviceText}>Audio Map</Text>
                        </TouchableOpacity>

                        <View style={styles.gymbroBar}>
                            <Text style={styles.gymbroText}>
                                GymBro AI Coach • Gemini Realtime • YOLO Pose
                            </Text>
                        </View>
                    </View>
                </StreamCall>
            </StreamVideo>
        );
    }

    // ── Selection UI ─────────────────────────────────────────────────────
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>AI Gym Trainer</Text>
                <Text style={styles.subtitle}>Vision Agents + Stream Video • Real-time coaching</Text>
                {agentAvailable !== null && (
                    <TouchableOpacity
                        style={[styles.statusBadge, { backgroundColor: agentAvailable ? '#22c55e15' : '#ef444415' }]}
                        onPress={() => { setAgentAvailable(null); checkAgent(); }}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.statusDot, { backgroundColor: agentAvailable ? '#22c55e' : '#ef4444' }]} />
                        <Text style={[styles.statusText, { color: agentAvailable ? '#22c55e' : '#ef4444' }]}>
                            {agentAvailable ? 'Vision Agents Ready' : 'Vision Agents Offline — tap to retry'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.sectionTitle}>
                {profile?.workout_split?.days.find(d => d.day_name.toLowerCase().includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()))
                    ? `Today's Split: ${profile.workout_split.days.find(d => d.day_name.toLowerCase().includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()))?.day_name}`
                    : 'Choose Exercise'}
            </Text>
            <View style={styles.menuContainer}>
                {profile?.workout_split?.days.find(d => d.day_name.toLowerCase().includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase())) && profile!.workout_split!.days.find(d => d.day_name.toLowerCase().includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()))!.exercises.length > 0 ? (
                    profile!.workout_split!.days.find(d => d.day_name.toLowerCase().includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()))!.exercises.map((ex, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.menuItem, selectedExercise === ex.name && styles.menuItemSelected]}
                            onPress={() => setSelectedExercise(ex.name)}
                        >
                            <Text style={[styles.menuItemText, selectedExercise === ex.name && styles.menuItemTextSelected]}>
                                {ex.name} ({ex.sets}x{ex.reps})
                            </Text>
                        </TouchableOpacity>
                    ))
                ) : (
                    EXERCISES.map(ex => (
                        <TouchableOpacity
                            key={ex.key}
                            style={[styles.menuItem, selectedExercise === ex.key && styles.menuItemSelected]}
                            onPress={() => setSelectedExercise(ex.key)}
                        >
                            <Text style={[styles.menuItemText, selectedExercise === ex.key && styles.menuItemTextSelected]}>
                                {ex.label}
                            </Text>
                        </TouchableOpacity>
                    ))
                )}
            </View>

            <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>How It Works</Text>
                <Text style={styles.infoText}>
                    {'• Join a '}
                    <Text style={styles.bold}>Stream video call</Text>
                    {' with your AI coach\n• '}
                    <Text style={styles.bold}>YOLO</Text>
                    {' analyzes your pose in real-time\n• '}
                    <Text style={styles.bold}>Gemini Realtime</Text>
                    {' sees, listens & coaches — zero lag\n• Just '}
                    <Text style={styles.bold}>talk naturally</Text>
                    {' — no separate STT/TTS needed'}
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.startButton, (!agentAvailable || isLoading || isQuotaExhausted) && styles.startButtonDisabled]}
                onPress={handleStartTraining}
                disabled={!agentAvailable || isLoading || isQuotaExhausted}
            >
                {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <>
                        <Ionicons name={isQuotaExhausted ? "lock-closed" : "videocam"} size={22} color="#fff" />
                        <Text style={styles.startButtonText}>
                            {isQuotaExhausted ? 'Subscribe to Continue' : 'Start Training'}
                        </Text>
                    </>
                )}
            </TouchableOpacity>
            {isQuotaExhausted && (
                <Text style={styles.quotaHint}>You have used your free AI Trainer demo session.</Text>
            )}

            {/* ── Recent Sessions ──────────────────────────────────────── */}
            <TouchableOpacity style={styles.recentSessionsBtn} onPress={toggleSessions} activeOpacity={0.7}>
                <View style={styles.recentBtnLeft}>
                    <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                    <Text style={styles.recentBtnText}>Recent Sessions</Text>
                    {sessions.length > 0 && (
                        <View style={styles.sessionCountBadge}>
                            <Text style={styles.sessionCountText}>{sessions.length}</Text>
                        </View>
                    )}
                </View>
                <Ionicons
                    name={showSessions ? 'chevron-up' : 'chevron-down'}
                    size={18} color={Colors.textMuted}
                />
            </TouchableOpacity>

            {showSessions && (
                <View style={styles.sessionsPanel}>
                    {sessionsLoading ? (
                        <View style={styles.sessionsLoading}>
                            <ActivityIndicator color={Colors.primary} size="small" />
                            <Text style={styles.loadingText}>Loading sessions...</Text>
                        </View>
                    ) : sessions.length === 0 ? (
                        <View style={styles.emptySessions}>
                            <Ionicons name="barbell-outline" size={40} color={Colors.textMuted} style={{ marginBottom: 8 }} />
                            <Text style={styles.emptyText}>No sessions yet</Text>
                            <Text style={styles.emptySubtext}>Complete a training session to see your history here</Text>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity onPress={loadSessions} style={styles.refreshBtn}>
                                <Ionicons name="refresh" size={14} color={Colors.textMuted} />
                                <Text style={styles.refreshText}>Refresh</Text>
                            </TouchableOpacity>
                            {sessions.map((s, i) => (
                                <SessionCard key={s.session_id || i} session={s} />
                            ))}
                        </>
                    )}
                </View>
            )}

            {!agentAvailable && agentAvailable !== null && (
                <Text style={styles.warningText}>Vision Agents SDK not available on backend. Tap status badge above to retry.</Text>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    contentContainer: { padding: Spacing.lg, paddingBottom: 120 },

    header: { marginBottom: Spacing.xl },
    title: { fontSize: 28, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 13, color: Colors.textSecondary },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 10,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statusText: { fontSize: 12, fontFamily: Fonts.medium },

    sectionTitle: { fontSize: 18, color: Colors.textPrimary, fontFamily: Fonts.bold, marginBottom: Spacing.md },

    menuContainer: { gap: Spacing.sm, marginBottom: Spacing.xl },
    menuItem: {
        backgroundColor: Colors.card, borderRadius: Radius.md,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border,
    },
    menuItemSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
    menuItemText: { fontSize: 16, color: Colors.textPrimary, fontFamily: Fonts.medium },
    menuItemTextSelected: { color: Colors.primary, fontFamily: Fonts.bold },

    infoCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
    infoTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 8 },
    infoText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 22 },
    bold: { fontFamily: Fonts.bold, color: Colors.textPrimary },

    startButton: {
        backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 16,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: Spacing.md,
    },
    startButtonDisabled: { opacity: 0.4 },
    startButtonText: { color: '#fff', fontSize: 18, fontFamily: Fonts.bold },
    warningText: { fontSize: 12, color: Colors.error, textAlign: 'center', marginTop: 8 },

    // Recent Sessions button
    recentSessionsBtn: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: Colors.card, borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 14,
        marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
    },
    recentBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    recentBtnText: { fontSize: 15, color: Colors.textPrimary, fontFamily: Fonts.medium },
    sessionCountBadge: {
        backgroundColor: Colors.primary, borderRadius: 10,
        paddingHorizontal: 7, paddingVertical: 2,
    },
    sessionCountText: { fontSize: 11, color: '#fff', fontFamily: Fonts.bold },

    // Sessions Panel
    sessionsPanel: { marginBottom: Spacing.xl },
    sessionsLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.md, justifyContent: 'center' },
    loadingText: { color: Colors.textSecondary, fontSize: 13 },
    emptySessions: { alignItems: 'center', paddingVertical: Spacing.xl },
    emptyIcon: { fontSize: 40, marginBottom: 8 },
    emptyText: { fontSize: 16, color: Colors.textPrimary, fontFamily: Fonts.bold, marginBottom: 4 },
    emptySubtext: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginBottom: 8 },
    refreshText: { fontSize: 12, color: Colors.textMuted },
    quotaHint: { color: Colors.warning, fontSize: Fonts.sizes.xs, textAlign: 'center', marginTop: -8, marginBottom: Spacing.xl, fontWeight: '600' },

    // Session Card
    sessionCard: {
        backgroundColor: Colors.card, borderRadius: Radius.lg,
        marginBottom: Spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
    },
    sessionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
    exerciseDot: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    exerciseDotIcon: { fontSize: 20 },
    sessionInfo: { flex: 1 },
    sessionExercise: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textPrimary },
    sessionMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    sessionRight: { flexDirection: 'row', alignItems: 'center' },
    scoreChip: {
        fontSize: 13, fontFamily: Fonts.bold,
        borderWidth: 1, borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    sessionDetails: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    statsRow: { flexDirection: 'row', paddingTop: Spacing.md, marginBottom: Spacing.sm },
    statBox: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.textPrimary },
    statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
    faultsSection: { backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: Spacing.sm, marginTop: 4 },
    faultsTitle: { fontSize: 12, color: Colors.warning, fontFamily: Fonts.bold, marginBottom: 4 },
    faultItem: { fontSize: 12, color: Colors.textSecondary, lineHeight: 20 },
    sessionNote: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingVertical: 8 },

    // Training View
    trainingContainer: { flex: 1, backgroundColor: '#000' },
    trainingHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, paddingTop: 52,
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
    headerLabel: { color: '#fff', fontSize: 16, fontFamily: Fonts.bold },
    timerText: { color: '#fff', fontSize: 18, fontFamily: Fonts.bold },
    gymbroBar: { backgroundColor: 'rgba(0,0,0,0.85)', paddingVertical: 8, alignItems: 'center' },
    gymbroText: { color: '#FF6B35', fontSize: 11, fontFamily: Fonts.medium },
    audioDeviceBtn: {
        position: 'absolute', top: 110, right: 16,
        backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6,
        zIndex: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    audioDeviceText: { color: '#fff', fontSize: 12, fontFamily: Fonts.medium },
});
