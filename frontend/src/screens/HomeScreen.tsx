// GymBro — Home Screen
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useGamificationStore } from '../stores/gamificationStore';
import { Colors, Spacing, Radius, Fonts, getRankColor } from '../theme';
import api from '../services/api';

const { width } = Dimensions.get('window');

const FEATURES = [
    { icon: 'videocam-outline', label: 'AI\nTrainer', screen: 'AI Trainer', color: '#FF6B35', desc: 'Real-time pose' },
    { icon: 'restaurant-outline', label: 'AI Nutrition\nCoach', screen: 'Diet', color: '#22C55E', desc: 'Custom meal plan' },
    { icon: 'body-outline', label: 'Body\nScan', screen: 'BodyScan', color: '#3B82F6', desc: 'Posture analysis' },
    { icon: 'calendar-outline', label: 'Activity\nLogging', screen: 'Strength', color: '#F59E0B', desc: 'Track workouts' },
    { icon: 'people-outline', label: 'Find\nCoaches', screen: 'Coaches', color: '#8B5CF6', desc: 'Nearby trainers' },
    { icon: 'trophy-outline', label: 'Achievements', screen: 'Gamification', color: '#EC4899', desc: 'XP & badges' },
];

export default function HomeScreen({ navigation }: any) {
    const { user } = useAuthStore();
    const { xp, rank, streak_count, fetchProfile } = useGamificationStore();
    const [status, setStatus] = useState<any>(null);

    const fetchStatus = async () => {
        try {
            const { data } = await api.get('/subscription/status');
            setStatus(data);
        } catch { }
    };

    useEffect(() => {
        fetchProfile();
        fetchStatus();
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
                    <View style={styles.headerRight}>
                        <Ionicons name="flash" size={16} color="#F59E0B" />
                        <Text style={styles.xpText}>{xp}</Text>
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
                    <Text style={styles.greetingText}>
                        Welcome back, {user?.name?.split(' ')[0] ?? 'Athlete'}!
                    </Text>
                    <Text style={styles.heroTitle}>
                        {status?.tier === 'premium' ? "Don't miss today's session" : "Get Your AI\nTrainer Now"}
                    </Text>
                    <Text style={styles.heroSub}>Real-time form • Diet • Body scan • Voice coaching</Text>
                    <TouchableOpacity
                        style={styles.heroCta}
                        onPress={() => navigation.navigate('AI Trainer')}
                    >
                        <Text style={styles.heroCtaText}>
                            {status?.tier === 'premium' ? 'Start Now' : 'Start AI Session'}
                        </Text>
                    </TouchableOpacity>
                </LinearGradient>

                {/* Rank + Streak */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Ionicons name="flame" size={24} color="#F59E0B" style={{ marginBottom: 4 }} />
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
                    {FEATURES.map((feature, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.gridItem}
                            onPress={() => navigation.navigate(feature.screen as any)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconWrapper, { backgroundColor: feature.color + '20' }]}>
                                <Ionicons name={feature.icon as any} size={28} color={feature.color} />
                            </View>
                            <View style={styles.itemText}>
                                <Text style={styles.itemLabel}>{feature.label}</Text>
                                <Text style={styles.itemDesc}>{feature.desc}</Text>
                            </View>
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
    headerRight: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.primaryGlow, borderRadius: Radius.full,
        paddingHorizontal: 12, paddingVertical: 4,
    },
    xpText: { color: Colors.primary, fontWeight: '700', fontSize: Fonts.sizes.sm, marginLeft: 4 },
    hero: {
        marginHorizontal: Spacing.lg, marginTop: Spacing.md,
        borderRadius: Radius.xl, padding: Spacing.xl,
    },
    greetingText: { color: 'rgba(255,255,255,0.8)', fontSize: Fonts.sizes.md, marginBottom: 4 },
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
    statCard: { flex: 1, backgroundColor: Colors.surface, padding: 16, borderRadius: Radius.lg, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
    statLabel: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
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
    gridItem: {
        width: (width - Spacing.lg * 2 - 12) / 2, backgroundColor: Colors.surface, borderRadius: Radius.lg,
        padding: 16, marginBottom: 0, flexDirection: 'column', gap: 12,
    },
    iconWrapper: {
        width: 48, height: 48, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    itemText: { flex: 1 },
    itemLabel: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.textPrimary, lineHeight: 22 },
    itemDesc: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 4 },
});
