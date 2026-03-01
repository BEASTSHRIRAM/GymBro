// GymBro — Register Screen (with inline OTP step)
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, Radius, Fonts } from '../../theme';

const GOALS = ['lose_fat', 'build_muscle', 'maintain'];
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

// Custom hook for countdown timer
function useCountdown(initialSeconds: number) {
    const [seconds, setSeconds] = useState(initialSeconds);

    useEffect(() => {
        if (seconds <= 0) return;

        const timer = setInterval(() => {
            setSeconds(s => s - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [seconds]);

    return seconds;
}

// ── Defined OUTSIDE component — prevents keyboard dismiss on re-render ──────────
const InputRow = ({ icon, placeholder, field, keyboard = 'default', secure = false,
    value, onChangeText, showPass, togglePass }: any) => (
    <View style={styles.inputGroup}>
        <Ionicons name={icon} size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            keyboardType={keyboard}
            secureTextEntry={secure && !showPass}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize={field === 'email' ? 'none' : 'words'}
        />
        {secure && (
            <TouchableOpacity onPress={togglePass}>
                <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
        )}
    </View>
);

export default function RegisterScreen({ navigation }: any) {
    const [form, setForm] = useState({
        name: '', email: '', password: '',
        age: '', height: '', weight: '',
        goal: 'build_muscle', activity_level: 'moderate',
    });
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [showPass, setShowPass] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [otpEmail, setOtpEmail] = useState('');
    const otpRefs = useRef<any[]>([]);
    const { register, verifyOtp, error, isLoading, clearError, pendingOtpEmail, setPendingOtpEmail, resendOtp, resendCooldown, resendSuccess, resendError, clearResendMessages } = useAuthStore();
    const countdown = useCountdown(resendCooldown);

    // Sync with Zustand on mount (for when navigating back to Register)
    useEffect(() => {
        if (pendingOtpEmail && !showOtp) {
            setShowOtp(true);
            setOtpEmail(pendingOtpEmail);
        }
    }, [pendingOtpEmail]);

    // Auto-dismiss resend messages after 3 seconds
    useEffect(() => {
        if (resendSuccess || resendError) {
            const timer = setTimeout(() => {
                clearResendMessages();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [resendSuccess, resendError, clearResendMessages]);

    const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

    // ── Step 1: Register ───────────────────────────────────────────────────────
    const handleRegister = async () => {
        if (!form.name || !form.email || !form.password) {
            Alert.alert('GymBro', 'Name, email and password are required');
            return;
        }
        clearError();
        await register({
            name: form.name, email: form.email, password: form.password,
            age: form.age ? parseInt(form.age) : undefined,
            height: form.height ? parseFloat(form.height) : undefined,
            weight: form.weight ? parseFloat(form.weight) : undefined,
            goal: form.goal, activity_level: form.activity_level,
        });
        const err = useAuthStore.getState().error;
        if (!err || err.toLowerCase().includes('already registered') || err.toLowerCase().includes('already exists')) {
            // Registration succeeded or account already exists — navigate to OTP
            useAuthStore.getState().clearError();
            navigation.navigate('OTP', { email: form.email, password: form.password });
        }
    };

    // ── Step 2: Verify OTP ─────────────────────────────────────────────────────
    const handleOtpChange = (val: string, idx: number) => {
        const next = [...otp];
        next[idx] = val;
        setOtp(next);
        if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    };

    const handleVerify = async () => {
        const code = otp.join('');
        if (code.length !== 6) {
            Alert.alert('GymBro', 'Please enter the full 6-digit OTP');
            return;
        }
        // Capture credentials before any state resets
        const email = otpEmail || form.email;
        const password = form.password;
        clearError();
        await verifyOtp(email, code);
        if (!useAuthStore.getState().error) {
            // Auto-login after successful verification
            try {
                await useAuthStore.getState().login(email, password);
                setPendingOtpEmail(null);
                setShowOtp(false);
                // login sets isAuthenticated=true → RootNavigator switches to AppDrawer
            } catch {
                setPendingOtpEmail(null);
                setShowOtp(false);
                // Fallback: manual login
                Alert.alert('✅ Verified!', 'Your account is ready. Please log in.', [
                    { text: 'Go to Login', onPress: () => navigation.navigate('Login') },
                ]);
            }
        }
    };

    // ── OTP Step UI ────────────────────────────────────────────────────────────
    if (showOtp) {
        return (
            <LinearGradient colors={['#0A0A0A', '#111111']} style={styles.container}>
                <View style={styles.otpInner}>
                    <TouchableOpacity onPress={() => { setShowOtp(false); setPendingOtpEmail(null); }} style={styles.back}>
                        <Ionicons name="arrow-back" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.otpIcon}>📧</Text>
                    <Text style={styles.heading}>Verify Your Email</Text>
                    <Text style={styles.sub}>
                        We sent a 6-digit code to{'\n'}
                        <Text style={{ color: Colors.primary }}>{otpEmail}</Text>
                    </Text>
                    {error && (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle" size={16} color={Colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}
                    {resendSuccess && (
                        <View style={styles.successBanner}>
                            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                            <Text style={styles.successText}>{resendSuccess}</Text>
                        </View>
                    )}
                    {resendError && (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle" size={16} color={Colors.error} />
                            <Text style={styles.errorText}>{resendError}</Text>
                        </View>
                    )}
                    <View style={styles.otpRow}>
                        {otp.map((digit, i) => (
                            <TextInput
                                key={i}
                                ref={(r) => (otpRefs.current[i] = r)}
                                style={[styles.otpBox, digit ? styles.otpBoxActive : null]}
                                value={digit}
                                onChangeText={(v) => handleOtpChange(v.replace(/[^0-9]/g, '').slice(-1), i)}
                                keyboardType="number-pad"
                                maxLength={1}
                                textAlign="center"
                                onKeyPress={({ nativeEvent }) => {
                                    if (nativeEvent.key === 'Backspace' && !digit && i > 0)
                                        otpRefs.current[i - 1]?.focus();
                                }}
                            />
                        ))}
                    </View>
                    <TouchableOpacity
                        style={[styles.btn, isLoading && { opacity: 0.7 }]}
                        onPress={handleVerify} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>VERIFY OTP</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.resendBtn, (isLoading || countdown > 0) && styles.resendBtnDisabled]}
                        onPress={() => resendOtp(otpEmail ?? '')}
                        disabled={isLoading || countdown > 0}
                    >
                        <Text style={[styles.resendBtnText, (isLoading || countdown > 0) && styles.resendBtnTextDisabled]}>
                            {countdown > 0 ? `Resend OTP (${countdown}s)` : 'Resend OTP'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        );
    }

    // ── Register Step UI ───────────────────────────────────────────────────────
    return (
        <LinearGradient colors={['#0A0A0A', '#111111']} style={{ flex: 1 }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View style={styles.logoRow}>
                        <Text style={styles.logoIcon}>🏋️</Text>
                        <Text style={styles.logoText}>GymBro</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.heading}>Create Account</Text>
                        {error && (
                            <View style={styles.errorBanner}>
                                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                        <InputRow icon="person-outline" placeholder="Full Name" field="name"
                            value={form.name} onChangeText={(v: string) => update('name', v)} />
                        <InputRow icon="mail-outline" placeholder="Email" field="email" keyboard="email-address"
                            value={form.email} onChangeText={(v: string) => update('email', v)} />
                        <InputRow icon="lock-closed-outline" placeholder="Password" field="password" secure
                            value={form.password} onChangeText={(v: string) => update('password', v)}
                            showPass={showPass} togglePass={() => setShowPass(!showPass)} />

                        <Text style={styles.sectionLabel}>Body Stats (optional)</Text>
                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <TextInput style={styles.input} placeholder="Age" placeholderTextColor={Colors.textMuted}
                                    keyboardType="numeric" value={form.age} onChangeText={(v) => update('age', v)} />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <TextInput style={styles.input} placeholder="Height (cm)" placeholderTextColor={Colors.textMuted}
                                    keyboardType="numeric" value={form.height} onChangeText={(v) => update('height', v)} />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <TextInput style={styles.input} placeholder="Weight (kg)" placeholderTextColor={Colors.textMuted}
                                    keyboardType="numeric" value={form.weight} onChangeText={(v) => update('weight', v)} />
                            </View>
                        </View>

                        <Text style={styles.sectionLabel}>Goal</Text>
                        <View style={styles.chipRow}>
                            {GOALS.map((g) => (
                                <TouchableOpacity key={g}
                                    style={[styles.chip, form.goal === g && styles.chipActive]}
                                    onPress={() => update('goal', g)}>
                                    <Text style={[styles.chipText, form.goal === g && styles.chipTextActive]}>
                                        {g.replace('_', ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.sectionLabel}>Activity Level</Text>
                        <View style={styles.chipRow}>
                            {ACTIVITY_LEVELS.map((a) => (
                                <TouchableOpacity key={a}
                                    style={[styles.chip, form.activity_level === a && styles.chipActive]}
                                    onPress={() => update('activity_level', a)}>
                                    <Text style={[styles.chipText, form.activity_level === a && styles.chipTextActive]}>
                                        {a}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.btn, isLoading && { opacity: 0.7 }]}
                            onPress={handleRegister} disabled={isLoading}>
                            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>CREATE ACCOUNT</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
                            <Text style={styles.linkText}>
                                Already have an account? <Text style={styles.linkAccent}>Login</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: Spacing.lg, paddingBottom: 40 },
    logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 48, marginBottom: 24 },
    logoIcon: { fontSize: 32 },
    logoText: { fontSize: 36, fontWeight: '900', color: Colors.primary, marginLeft: 8 },
    card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    heading: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
    errorBanner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: Radius.sm,
        padding: Spacing.sm, marginBottom: Spacing.md, gap: 8,
    },
    errorText: { color: Colors.error, fontSize: Fonts.sizes.sm, flex: 1 },
    successBanner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: Radius.sm,
        padding: Spacing.sm, marginBottom: Spacing.md, gap: 8,
    },
    successText: { color: Colors.success, fontSize: Fonts.sizes.sm, flex: 1 },
    sectionLabel: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, marginTop: Spacing.md, marginBottom: 8, fontWeight: '600' },
    row: { flexDirection: 'row' },
    inputGroup: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surface, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border,
        marginBottom: Spacing.sm, paddingHorizontal: Spacing.sm,
    },
    inputIcon: { marginRight: 6 },
    input: { flex: 1, color: Colors.textPrimary, fontSize: Fonts.sizes.md, paddingVertical: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
    chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs },
    chipTextActive: { color: '#fff', fontWeight: '700' },
    btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.md },
    btnText: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: '800', letterSpacing: 1 },
    linkRow: { marginTop: Spacing.md, alignItems: 'center' },
    linkText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
    linkAccent: { color: Colors.primary, fontWeight: '700' },
    // OTP step styles
    otpInner: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
    back: { position: 'absolute', top: 56, left: Spacing.lg },
    otpIcon: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
    sub: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 24 },
    otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: Spacing.xl },
    otpBox: { width: 48, height: 56, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, fontSize: Fonts.sizes.xl, fontWeight: '700' },
    otpBoxActive: { borderColor: Colors.primary },
    resendBtn: {
        marginTop: Spacing.lg,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    resendBtnDisabled: {
        borderColor: Colors.border,
        opacity: 0.5,
    },
    resendBtnText: {
        color: Colors.primary,
        fontSize: Fonts.sizes.sm,
        fontWeight: '700',
    },
    resendBtnTextDisabled: {
        color: Colors.textSecondary,
    },
});
