// GymBro — OTP Verification Screen
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, Radius, Fonts } from '../../theme';

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

export default function OTPScreen({ navigation, route }: any) {
    const email = route?.params?.email ?? '';
    const password = route?.params?.password ?? '';
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const refs = useRef<any[]>([]);
    const { verifyOtp, isLoading, error, clearError, resendOtp, resendCooldown, resendSuccess, resendError, clearResendMessages } = useAuthStore();
    const countdown = useCountdown(resendCooldown);

    // Auto-dismiss resend messages after 3 seconds
    useEffect(() => {
        if (resendSuccess || resendError) {
            const timer = setTimeout(() => {
                clearResendMessages();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [resendSuccess, resendError, clearResendMessages]);

    const handleChange = (val: string, idx: number) => {
        const next = [...otp];
        next[idx] = val;
        setOtp(next);
        if (val && idx < 5) refs.current[idx + 1]?.focus();
    };

    const handleVerify = async () => {
        const code = otp.join('');
        if (code.length !== 6) {
            Alert.alert('GymBro', 'Please enter the full 6-digit OTP');
            return;
        }
        clearError();
        await verifyOtp(email, code);
        if (!useAuthStore.getState().error) {
            // Auto-login after successful verification
            if (password) {
                try {
                    await useAuthStore.getState().login(email, password);
                    // login sets isAuthenticated=true → RootNavigator switches to AppDrawer
                    return;
                } catch { }
            }
            // Fallback: manual login
            Alert.alert('✅ Verified!', 'Your account is ready. Please log in.', [
                { text: 'Go to Login', onPress: () => navigation.navigate('Login') },
            ]);
        }
    };

    return (
        <LinearGradient colors={['#0A0A0A', '#111111']} style={styles.container}>
            <View style={styles.inner}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
                    <Ionicons name="arrow-back" size={24} color={Colors.primary} />
                </TouchableOpacity>

                <Text style={styles.icon}>📧</Text>
                <Text style={styles.heading}>Verify Your Email</Text>
                <Text style={styles.sub}>
                    We sent a 6-digit code to{'\n'}
                    <Text style={{ color: Colors.primary }}>{email}</Text>
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
                            ref={(r) => (refs.current[i] = r)}
                            style={[styles.otpBox, digit ? styles.otpBoxActive : null]}
                            value={digit}
                            onChangeText={(v) => handleChange(v.replace(/[^0-9]/g, '').slice(-1), i)}
                            keyboardType="number-pad"
                            maxLength={1}
                            textAlign="center"
                            onKeyPress={({ nativeEvent }) => {
                                if (nativeEvent.key === 'Backspace' && !digit && i > 0) {
                                    refs.current[i - 1]?.focus();
                                }
                            }}
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.btn, isLoading && { opacity: 0.7 }]}
                    onPress={handleVerify}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.btnText}>VERIFY OTP</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.resendBtn, (isLoading || countdown > 0) && styles.resendBtnDisabled]}
                    onPress={() => resendOtp(email)}
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

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
    back: { position: 'absolute', top: 56, left: Spacing.lg },
    icon: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
    heading: {
        fontSize: Fonts.sizes.xxl, fontWeight: '800',
        color: Colors.textPrimary, textAlign: 'center', marginBottom: 8,
    },
    sub: {
        fontSize: Fonts.sizes.md, color: Colors.textSecondary,
        textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 24,
    },
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
    otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: Spacing.xl },
    otpBox: {
        width: 48, height: 56, borderRadius: Radius.md,
        backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
        color: Colors.textPrimary, fontSize: Fonts.sizes.xl, fontWeight: '700',
    },
    otpBoxActive: { borderColor: Colors.primary },
    btn: {
        backgroundColor: Colors.primary, borderRadius: Radius.md,
        paddingVertical: 16, alignItems: 'center',
    },
    btnText: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: '800', letterSpacing: 1 },
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
    linkRow: { marginTop: Spacing.lg, alignItems: 'center' },
    linkText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
    linkAccent: { color: Colors.primary, fontWeight: '700' },
});
