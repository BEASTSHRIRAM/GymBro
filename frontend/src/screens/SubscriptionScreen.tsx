import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { Colors, Spacing, Radius, Fonts } from '../theme';
import { useProfileStore } from '../stores/profileStore';

export default function SubscriptionScreen() {
    const { fetchProfile } = useProfileStore();
    const [plans, setPlans] = useState<any[]>([]);
    const [status, setStatus] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActivating, setIsActivating] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [plansRes, statusRes] = await Promise.all([
                api.get('/subscription/plans'),
                api.get('/subscription/status')
            ]);
            setPlans(plansRes.data.plans);
            setStatus(statusRes.data);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to load subscription data');
        } finally {
            setIsLoading(false);
        }
    };

    const activatePremium = async () => {
        setIsActivating(true);
        try {
            const res = await api.post('/subscription/activate');
            Alert.alert('Success', res.data.message);
            await Promise.all([loadData(), fetchProfile()]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to activate premium');
        } finally {
            setIsActivating(false);
        }
    };

    if (isLoading) {
        return (
            <View style={st.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const currentTier = status?.tier || 'free';

    return (
        <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={st.header}>
                <Text style={st.title}>My Subscriptions</Text>
                <Text style={st.subtitle}>Current Plan: <Text style={st.highlight}>{currentTier.toUpperCase()}</Text></Text>
            </View>

            {/* Usage Quotas */}
            <View style={st.section}>
                <Text style={st.sectionTitle}>Monthly AI Quotas</Text>
                {status?.usage && Object.entries(status.usage).map(([feature, data]: [string, any]) => (
                    <View key={feature} style={st.quotaRow}>
                        <View style={st.quotaIcon}>
                            <Ionicons
                                name={feature === 'ai_trainer' ? 'barbell' : feature === 'diet_coach' ? 'restaurant' : feature === 'supplement_coach' ? 'medkit' : 'calendar'}
                                size={20}
                                color={Colors.primary}
                            />
                        </View>
                        <View style={st.quotaDetails}>
                            <Text style={st.quotaTitle}>{feature.replace('_', ' ').toUpperCase()}</Text>
                            <Text style={st.quotaText}>
                                Used: {data.used} / {data.limit === 999 ? 'Unlimited' : data.limit}
                            </Text>
                        </View>
                        {data.limit !== 999 && (
                            <View style={st.progressBarBg}>
                                <View style={[st.progressBarFill, { width: `${Math.min(100, (data.used / data.limit) * 100)}%` }]} />
                            </View>
                        )}
                    </View>
                ))}
            </View>

            {/* Plans */}
            <Text style={[st.sectionTitle, { marginHorizontal: Spacing.lg, marginTop: Spacing.lg }]}>Available Plans</Text>
            <View style={st.plansContainer}>
                {plans.map((plan) => {
                    const isActive = currentTier === plan.id;
                    return (
                        <View key={plan.id} style={[st.planCard, isActive && st.planCardActive]}>
                            {isActive && (
                                <View style={st.activeBadge}>
                                    <Text style={st.activeBadgeText}>CURRENT PLAN</Text>
                                </View>
                            )}
                            <Text style={st.planName}>{plan.name}</Text>
                            <Text style={st.planPrice}>
                                {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                                {plan.period && <Text style={st.planPeriod}>/{plan.period}</Text>}
                            </Text>

                            <View style={st.featureList}>
                                {plan.features.map((f: string, idx: number) => (
                                    <View key={idx} style={st.featureRow}>
                                        <Ionicons name="checkmark-circle" size={18} color={isActive ? Colors.bg : Colors.primary} />
                                        <Text style={[st.featureText, isActive && { color: Colors.bg }]}>{f}</Text>
                                    </View>
                                ))}
                            </View>

                            {!isActive && plan.id === 'premium' && (
                                <TouchableOpacity style={st.btn} onPress={activatePremium} disabled={isActivating}>
                                    {isActivating ? <ActivityIndicator color="#fff" /> : <Text style={st.btnText}>Subscribe Now</Text>}
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

const st = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
    container: { flex: 1, backgroundColor: Colors.bg },
    header: { padding: Spacing.lg, paddingTop: 60, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
    title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
    subtitle: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, marginTop: 4 },
    highlight: { color: Colors.primary, fontWeight: '700' },
    section: { margin: Spacing.lg, padding: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
    sectionTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
    quotaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    quotaIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    quotaDetails: { flex: 1 },
    quotaTitle: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary },
    quotaText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
    progressBarBg: { width: 60, height: 6, backgroundColor: Colors.border, borderRadius: 3, marginLeft: 12 },
    progressBarFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
    plansContainer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
    planCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    planCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    activeBadge: { position: 'absolute', top: -12, right: 16, backgroundColor: Colors.textPrimary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
    activeBadgeText: { color: Colors.bg, fontSize: Fonts.sizes.xs, fontWeight: '700' },
    planName: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary },
    planPrice: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary, marginTop: 8, marginBottom: 16 },
    planPeriod: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, fontWeight: '500' },
    featureList: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    featureText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginLeft: 8, flex: 1 },
    btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: Radius.md, alignItems: 'center', marginTop: 16 },
    btnText: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: '700' },
});
