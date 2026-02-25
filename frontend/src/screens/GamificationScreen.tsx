// GymBro — Gamification Screen
import React, { useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList,
} from 'react-native';
import { useGamificationStore } from '../stores/gamificationStore';
import { useAuthStore } from '../stores/authStore';
import { Colors, Spacing, Radius, Fonts, getRankColor } from '../theme';

const RANK_EMOJI: Record<string, string> = {
    Beginner: '🥋', Bronze: '🥉', Silver: '🥈', Gold: '🥇', Elite: '🏆',
};

export default function GamificationScreen() {
    const { user } = useAuthStore();
    const {
        xp, rank, streak_count, workout_count, best_form_score,
        badges, leaderboard, isLoading, fetchProfile, fetchLeaderboard,
    } = useGamificationStore();

    useEffect(() => {
        fetchProfile();
        fetchLeaderboard();
    }, []);

    const nextThreshold: Record<string, number> = {
        Beginner: 500, Bronze: 1500, Silver: 3000, Gold: 6000, Elite: 9999,
    };
    const nextXP = nextThreshold[rank] ?? 500;
    const progress = Math.min(xp / nextXP, 1);

    if (isLoading && !xp) {
        return (
            <View style={[st.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={st.header}>
                <Text style={st.title}>🏆 Achievements</Text>
            </View>

            {/* Rank Card */}
            <View style={[st.rankCard, { borderColor: getRankColor(rank) }]}>
                <Text style={st.rankEmoji}>{RANK_EMOJI[rank] ?? '🥋'}</Text>
                <Text style={[st.rankLabel, { color: getRankColor(rank) }]}>{rank}</Text>
                <Text style={st.xpValue}>{xp} XP</Text>
                <View style={st.progressBg}>
                    <View style={[st.progressFill, { width: `${progress * 100}%`, backgroundColor: getRankColor(rank) }]} />
                </View>
                <Text style={st.nextRankText}>
                    {progress >= 1 ? '🎉 Max rank! Stay Elite!' : `${nextXP - xp} XP to next rank`}
                </Text>
            </View>

            {/* Stats Row */}
            <View style={st.statsRow}>
                {[
                    { label: '🔥 Streak', value: `${streak_count}d` },
                    { label: '🏋️ Workouts', value: workout_count },
                    { label: '⭐ Best Form', value: `${best_form_score}%` },
                ].map((s, i) => (
                    <View key={i} style={st.statBox}>
                        <Text style={st.statVal}>{s.value}</Text>
                        <Text style={st.statLabel}>{s.label}</Text>
                    </View>
                ))}
            </View>

            {/* Badges */}
            {badges.length > 0 && (
                <>
                    <Text style={st.sectionTitle}>Badges</Text>
                    <View style={st.badgeGrid}>
                        {badges.map((b: any) => (
                            <View key={b.id} style={st.badgeBox}>
                                <Text style={st.badgeIcon}>{b.icon}</Text>
                                <Text style={st.badgeName}>{b.name}</Text>
                            </View>
                        ))}
                    </View>
                </>
            )}

            {/* Leaderboard */}
            <Text style={st.sectionTitle}>Leaderboard</Text>
            {leaderboard.map((entry: any) => (
                <View
                    key={entry.position}
                    style={[st.leaderRow, entry.user_id === user?.id && st.leaderRowMe]}
                >
                    <Text style={st.leaderPos}>
                        {entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : `#${entry.position}`}
                    </Text>
                    <View style={{ flex: 1 }}>
                        <Text style={st.leaderName}>
                            {entry.name} {entry.user_id === user?.id ? '(You)' : ''}
                        </Text>
                        <Text style={[st.leaderRank, { color: getRankColor(entry.rank) }]}>{entry.rank}</Text>
                    </View>
                    <Text style={st.leaderXP}>⚡ {entry.xp}</Text>
                </View>
            ))}
        </ScrollView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: 16 },
    title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
    rankCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        padding: Spacing.xl, alignItems: 'center',
        borderWidth: 2,
    },
    rankEmoji: { fontSize: 64, marginBottom: 8 },
    rankLabel: { fontSize: Fonts.sizes.xxl, fontWeight: '900', marginBottom: 4 },
    xpValue: { fontSize: Fonts.sizes.display, fontWeight: '900', color: Colors.textPrimary, marginBottom: 12 },
    progressBg: { width: '100%', height: 8, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: Radius.full },
    nextRankText: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 8 },
    statsRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: 12 },
    statBox: {
        flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
        padding: Spacing.md, alignItems: 'center',
        borderWidth: 1, borderColor: Colors.border,
    },
    statVal: { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.textPrimary },
    statLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
    sectionTitle: {
        fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.textPrimary,
        marginHorizontal: Spacing.lg, marginBottom: 12,
    },
    badgeGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 12,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    },
    badgeBox: {
        backgroundColor: Colors.card, borderRadius: Radius.lg,
        padding: Spacing.md, alignItems: 'center', minWidth: 80,
        borderWidth: 1, borderColor: Colors.border,
    },
    badgeIcon: { fontSize: 32, marginBottom: 4 },
    badgeName: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, textAlign: 'center' },
    leaderRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.card, borderRadius: Radius.lg,
        marginHorizontal: Spacing.lg, marginBottom: 8, padding: Spacing.md,
        borderWidth: 1, borderColor: Colors.border, gap: 12,
    },
    leaderRowMe: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
    leaderPos: { fontSize: Fonts.sizes.lg, width: 36 },
    leaderName: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
    leaderRank: { fontSize: Fonts.sizes.xs, fontWeight: '600' },
    leaderXP: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.primary },
});
