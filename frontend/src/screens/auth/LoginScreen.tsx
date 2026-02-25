// GymBro — Login Screen
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, Radius, Fonts } from '../../theme';

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const { login, isLoading, error, clearError } = useAuthStore();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('GymBro', 'Please enter email and password');
            return;
        }
        clearError();
        await login(email, password);
    };

    return (
        <LinearGradient colors={['#0A0A0A', '#111111']} style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inner}
            >
                {/* Logo */}
                <View style={styles.logoRow}>
                    <Text style={styles.logoIcon}>🏋️</Text>
                    <Text style={styles.logoText}>GymBro</Text>
                </View>
                <Text style={styles.tagline}>Your AI Personal Trainer</Text>

                {/* Form */}
                <View style={styles.card}>
                    <Text style={styles.heading}>Welcome Back</Text>

                    {error && (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle" size={16} color={Colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry={!showPass}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                            <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, isLoading && { opacity: 0.7 }]}
                        onPress={handleLogin}
                        disabled={isLoading}
                        activeOpacity={0.85}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnText}>LOGIN</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
                        <Text style={styles.linkText}>
                            Don't have an account? <Text style={styles.linkAccent}>Register</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
    logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    logoIcon: { fontSize: 36 },
    logoText: { fontSize: 42, fontWeight: '900', color: Colors.primary, marginLeft: 8 },
    tagline: { textAlign: 'center', color: Colors.textMuted, fontSize: Fonts.sizes.md, marginBottom: Spacing.xl },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    heading: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.lg },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: Radius.sm,
        padding: Spacing.sm,
        marginBottom: Spacing.md,
        gap: 8,
    },
    errorText: { color: Colors.error, fontSize: Fonts.sizes.sm, flex: 1 },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.md,
        paddingHorizontal: Spacing.md,
    },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, color: Colors.textPrimary, fontSize: Fonts.sizes.md, paddingVertical: 14 },
    eyeBtn: { padding: 4 },
    btn: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.md,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    btnText: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: '800', letterSpacing: 1 },
    linkRow: { marginTop: Spacing.md, alignItems: 'center' },
    linkText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
    linkAccent: { color: Colors.primary, fontWeight: '700' },
});
