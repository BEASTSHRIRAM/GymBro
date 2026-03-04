// GymBro — Gamification Screen
import React, { useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGamificationStore } from '../stores/gamificationStore';
import { useAuthStore } from '../stores/authStore';
import { Colors, Spacing, Radius, Fonts, getRankColor } from '../theme';

const RANK_EMOJI: Record<string, string> = {
    Beginner: 'star-outline', Bronze: 'medal-outline', Silver: 'medal', Gold: 'trophy-outline', Elite: 'trophy',
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
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                    <Ionicons name="trophy-outline" size={28} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                    <Text style={st.title}>Achievements</Text>
                </View>
            </View>

            {/* Rank Card */}
            <View style={[st.rankCard, { borderColor: getRankColor(rank) }]}>
                <Ionicons name={RANK_EMOJI[rank] as any ?? 'star-outline'} size={64} color={getRankColor(rank)} style={{ marginBottom: 8 }} />
                <Text style={[st.rankLabel, { color: getRankColor(rank) }]}>{rank}</Text>
                <Text style={st.xpValue}>{xp} XP</Text>
                <View style={st.progressBg}>
                    <View style={[st.progressFill, { width: `${progress * 100}%`, backgroundColor: getRankColor(rank) }]} />
                </View>
                <Text style={st.nextRankText}>
                    {progress >= 1 ? 'Max rank! Stay Elite!' : `${nextXP - xp} XP to next rank`}
                </Text>
            </View>

            {/* Stats Row */}
            <View style={st.statsGrid}>
                {[{ label: 'Streak', value: `${streak_count}d`, icon: 'flame-outline' as any },
                { label: 'Workouts', value: workout_count, icon: 'barbell-outline' as any },
                { label: 'Best Form', value: `${best_form_score}%`, icon: 'star-outline' as any },
                ].map((s, i) => (
                    <View key={i} style={st.statCard}>
                        <Ionicons name={s.icon} size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
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
                    <Text style={st.posText}>
                        {entry.position === 1 ? '1st' : entry.position === 2 ? '2nd' : entry.position === 3 ? '3rd' : `#${entry.position}`}
                    </Text>
                    <View style={{ flex: 1 }}>
                        <Text style={st.leaderName}>
                            {entry.name} {entry.user_id === user?.id ? '(You)' : ''}
                        </Text>
                        <Text style={[st.leaderRank, { color: getRankColor(entry.rank) }]}>{entry.rank}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="flash" size={14} color="#F59E0B" />
                        <Text style={[st.leaderXP, { marginLeft: 4 }]}>{entry.xp}</Text>
                    </View>
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
    rankBadge: { fontSize: 48, marginBottom: 8 },
    rankLabel: { fontSize: 28, fontWeight: '900', marginBottom: 4 },
    xpValue: { fontSize: 18, color: Colors.textMuted, marginBottom: 16 },
    progressBg: { width: '100%', height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', backgroundColor: Colors.primary },
    nextRankText: { fontSize: 13, color: Colors.textMuted },

    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 16, gap: 12 },
    statCard: { flex: 1, backgroundColor: Colors.surface, padding: 12, borderRadius: Radius.lg, alignItems: 'center' },
    statVal: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
    statLabel: { fontSize: 12, color: Colors.textMuted },

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
    leaderRowMe: { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: Colors.primary, borderWidth: 1 },
    posText: { fontSize: 16, width: 32, fontWeight: 'bold', color: Colors.textMuted },
    leaderName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
    leaderRank: { fontSize: Fonts.sizes.xs, fontWeight: '600' },
    leaderXP: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.primary },
});
