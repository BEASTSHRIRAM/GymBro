// GymBro — Home Screen
import React, { useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useGamificationStore } from '../stores/gamificationStore';
import { Colors, Spacing, Radius, Fonts, getRankColor } from '../theme';

const { width } = Dimensions.get('window');

const FEATURES = [
    { icon: '🎥', label: 'AI\nTrainer', screen: 'AI Trainer', color: '#FF6B35', desc: 'Real-time pose' },
    { icon: '🥗', label: 'AI Diet\nCoach', screen: 'Diet', color: '#22C55E', desc: 'Custom meal plan' },
    { icon: '🔍', label: 'Body\nScan', screen: 'BodyScan', color: '#3B82F6', desc: 'Posture analysis' },
    { icon: '📈', label: 'Strength\nPredictor', screen: 'Strength', color: '#F59E0B', desc: '1RM projection' },
    { icon: '📍', label: 'Find\nCoaches', screen: 'Coaches', color: '#8B5CF6', desc: 'Nearby trainers' },
    { icon: '🏆', label: 'Achievements', screen: 'Gamification', color: '#EC4899', desc: 'XP & badges' },
];

export default function HomeScreen({ navigation }: any) {
    const { user } = useAuthStore();
    const { xp, rank, streak_count, fetchProfile } = useGamificationStore();

    useEffect(() => {
        fetchProfile();
    }, []);

    const nextRankXp = { Beginner: 500, Bronze: 1500, Silver: 3000, Gold: 6000, Elite: Infinity }[rank] ?? 500;
    const progress = Math.min(xp / nextRankXp, 1);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

            {/* Header */}
            <LinearGradient colors={['#1A1A1A', '#0A0A0A']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.openDrawer()}>
                    <Ionicons name="menu" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.logoRow}>
                    <Text style={styles.logoText}>GymBro</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Gamification')}>
                    <View style={styles.xpBadge}>
                        <Text style={styles.xpText}>⚡ {xp}</Text>
                    </View>
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
                {/* Hero CTA */}
                <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    style={styles.hero}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Text style={styles.heroGreeting}>
                        Welcome back, {user?.name?.split(' ')[0] ?? 'Athlete'}! 💪
                    </Text>
                    <Text style={styles.heroTitle}>Get Your AI{'\n'}Trainer Now</Text>
                    <Text style={styles.heroSub}>Real-time form • Diet • Body scan • Voice coaching</Text>
                    <TouchableOpacity
                        style={styles.heroCta}
                        onPress={() => navigation.navigate('AI Trainer')}
                    >
                        <Text style={styles.heroCtaText}>🚀 Start AI Session</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {/* Rank + Streak */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statEmoji}>🔥</Text>
                        <Text style={styles.statValue}>{streak_count}</Text>
                        <Text style={styles.statLabel}>Day Streak</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 2 }]}>
                        <View style={styles.rankRow}>
                            <Text style={[styles.rankBadge, { color: getRankColor(rank) }]}>{rank}</Text>
                            <Text style={styles.rankXp}>{xp} XP</Text>
                        </View>
                        <View style={styles.xpBar}>
                            <View style={[styles.xpFill, { width: `${progress * 100}%` }]} />
                        </View>
                        <Text style={styles.xpNext}>Next rank at {nextRankXp} XP</Text>
                    </View>
                </View>

                {/* Feature Grid */}
                <Text style={styles.sectionTitle}>AI Features</Text>
                <View style={styles.grid}>
                    {FEATURES.map((f) => (
                        <TouchableOpacity
                            key={f.label}
                            style={styles.featureCard}
                            onPress={() => {
                                if (f.screen === 'BodyScan' || f.screen === 'Gamification' || f.screen === 'Coaches') {
                                    navigation.navigate(f.screen);
                                } else {
                                    navigation.navigate(f.screen);
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.featureIconBg, { backgroundColor: f.color + '22' }]}>
                                <Text style={styles.featureIcon}>{f.icon}</Text>
                            </View>
                            <Text style={styles.featureLabel}>{f.label}</Text>
                            <Text style={styles.featureDesc}>{f.desc}</Text>
                            <View style={[styles.featureDot, { backgroundColor: f.color }]} />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 14,
    },
    logoRow: { alignItems: 'center' },
    logoText: { fontSize: 22, fontWeight: '900', color: Colors.primary },
    xpBadge: {
        backgroundColor: Colors.primaryGlow, borderRadius: Radius.full,
        paddingHorizontal: 12, paddingVertical: 4,
    },
    xpText: { color: Colors.primary, fontWeight: '700', fontSize: Fonts.sizes.sm },
    hero: {
        marginHorizontal: Spacing.lg, marginTop: Spacing.md,
        borderRadius: Radius.xl, padding: Spacing.xl,
    },
    heroGreeting: { color: 'rgba(255,255,255,0.8)', fontSize: Fonts.sizes.md, marginBottom: 4 },
    heroTitle: {
        fontSize: Fonts.sizes.display, fontWeight: '900',
        color: '#fff', lineHeight: 40, marginBottom: 8,
    },
    heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: Fonts.sizes.sm, marginBottom: Spacing.md },
    heroCta: {
        backgroundColor: '#fff', borderRadius: Radius.full,
        paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start',
    },
    heroCtaText: { color: Colors.primary, fontWeight: '800', fontSize: Fonts.sizes.md },

    statsRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md, gap: 12 },
    statCard: {
        backgroundColor: Colors.card, borderRadius: Radius.lg,
        padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, flex: 1,
    },
    statEmoji: { fontSize: 28, marginBottom: 4 },
    statValue: { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.textPrimary },
    statLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
    rankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8 },
    rankBadge: { fontSize: Fonts.sizes.xl, fontWeight: '900' },
    rankXp: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
    xpBar: { width: '100%', height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
    xpFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
    xpNext: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },

    sectionTitle: {
        fontSize: Fonts.sizes.lg, fontWeight: '800',
        color: Colors.textPrimary, marginHorizontal: Spacing.lg,
        marginTop: Spacing.xl, marginBottom: Spacing.md,
    },
    grid: {
        flexDirection: 'row', flexWrap: 'wrap',
        marginHorizontal: Spacing.lg, gap: 12,
    },
    featureCard: {
        width: (width - 48 - 12) / 2,
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
        position: 'relative', overflow: 'hidden',
    },
    featureIconBg: {
        width: 48, height: 48, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    featureIcon: { fontSize: 24 },
    featureLabel: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.textPrimary, lineHeight: 22 },
    featureDesc: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 4 },
    featureDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 12, right: 12 },
});
