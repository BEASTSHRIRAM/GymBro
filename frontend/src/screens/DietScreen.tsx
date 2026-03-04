// GymBro — Diet Coach & Supplement Coach Screen
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDietStore } from '../stores/dietStore';
import { useAuthStore } from '../stores/authStore';
import { Colors, Spacing, Radius, Fonts } from '../theme';
import api from '../services/api';

const GOALS = [
    { key: 'lose_fat', label: 'Lose Fat' },
    { key: 'build_muscle', label: 'Build Muscle' },
    { key: 'maintain', label: 'Maintain' },
];

const ACTIVITY = [
    { key: 'sedentary', label: 'Sedentary' },
    { key: 'light', label: 'Light' },
    { key: 'moderate', label: 'Moderate' },
    { key: 'active', label: 'Active' },
    { key: 'very_active', label: 'Very Active' },
];

const MACRO_COLOR = { protein: '#FF6B35', carbs: '#3B82F6', fat: '#F59E0B' };

export default function DietScreen({ navigation }: any) {
    const { user } = useAuthStore();
    const { plan, isLoading, generate, fetchCurrent, getSupplementAdvice, supplementAdvice, error } = useDietStore();

    const [activeTab, setActiveTab] = useState<'diet' | 'supplement'>('diet');
    const [status, setStatus] = useState<any>(null);
    const [supplementReq, setSupplementReq] = useState('');

    const [form, setForm] = useState({
        age: user?.age?.toString() ?? '',
        height: user?.height?.toString() ?? '',
        weight: user?.weight?.toString() ?? '',
        gender: 'male',
        goal: user?.goal ?? 'build_muscle',
        activity_level: 'moderate',
    });
    const [showForm, setShowForm] = useState(!plan);

    useEffect(() => {
        fetchCurrent();
        fetchQuotaStatus();
    }, []);

    const fetchQuotaStatus = async () => {
        try {
            const { data } = await api.get('/subscription/status');
            setStatus(data);
        } catch (e: any) {
            console.error('Failed to fetch quota', e);
        }
    };

    const handleGenerate = async () => {
        // Quota check
        if (status && status.tier === 'free' && status.usage?.diet_coach?.remaining <= 0) {
            Alert.alert(
                'Limit Reached',
                'You have used your free AI Diet generation. Upgrade to Premium for 10 per month!'
            );
            return;
        }

        if (!form.age || !form.height || !form.weight) {
            Alert.alert('GymBro', 'Please fill in age, height, and weight');
            return;
        }
        await generate({
            age: parseInt(form.age),
            height: parseFloat(form.height),
            weight: parseFloat(form.weight),
            gender: form.gender,
            goal: form.goal,
            activity_level: form.activity_level,
        });
        fetchQuotaStatus();
        setShowForm(false);
    };

    const handleGetSupplements = async () => {
        if (status && status.tier === 'free') {
            Alert.alert('Premium Feature', 'Supplement Coach is only available for Premium members. Subscribe to unlock!', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'View Plans', onPress: () => navigation.navigate('Subscriptions') }
            ]);
            return;
        }

        if (status && status.usage?.supplement_coach?.remaining <= 0) {
            Alert.alert('Limit Reached', 'You have used all your supplement coach sessions for this month.');
            return;
        }

        if (!supplementReq.trim()) {
            Alert.alert('GymBro', 'Please enter your requirements or struggles.');
            return;
        }

        try {
            await getSupplementAdvice(supplementReq);
            fetchQuotaStatus();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to get advice');
        }
    };

    const MacroBar = ({ label, g, color, totalCal }: any) => {
        const cal = label === 'fat' ? g * 9 : g * 4;
        const pct = totalCal > 0 ? Math.round((cal / totalCal) * 100) : 0;
        return (
            <View style={st.macroRow}>
                <Text style={[st.macroLabel, { color }]}>{label.toUpperCase()}</Text>
                <View style={st.macroBarBg}>
                    <View style={[st.macroBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
                <Text style={st.macroVal}>{g}g <Text style={st.macroPct}>({pct}%)</Text></Text>
            </View>
        );
    };

    const dietQuotaExhausted = status?.tier === 'free' && status?.usage?.diet_coach?.remaining <= 0;
    const isPremium = status?.tier === 'premium';

    return (
        <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={st.header}>
                <Text style={st.title}>Nutrition Coach</Text>
                {activeTab === 'diet' && (
                    <TouchableOpacity onPress={() => setShowForm(!showForm)} style={st.editBtn}>
                        <Ionicons name={showForm ? 'close' : 'create'} size={20} color={Colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Tab Toggler */}
            <View style={st.tabContainer}>
                <TouchableOpacity
                    style={[st.tab, activeTab === 'diet' && st.tabActive]}
                    onPress={() => setActiveTab('diet')}
                >
                    <Ionicons name="restaurant" size={16} color={activeTab === 'diet' ? '#fff' : Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={[st.tabText, activeTab === 'diet' && st.tabTextActive]}>Diet Coach</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[st.tab, activeTab === 'supplement' && st.tabActive]}
                    onPress={() => setActiveTab('supplement')}
                >
                    <Ionicons name="medkit" size={16} color={activeTab === 'supplement' ? '#fff' : Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={[st.tabText, activeTab === 'supplement' && st.tabTextActive]}>Supplement Coach</Text>
                </TouchableOpacity>
            </View>

            {/* ──── DIET COACH TAB ──── */}
            {activeTab === 'diet' && (
                <>
                    {/* Input Form */}
                    {showForm && (
                        <View style={st.card}>
                            <Text style={st.cardTitle}>Your Metrics</Text>
                            <View style={st.row3}>
                                {[['Age', 'age', 'numeric'], ['Height (cm)', 'height', 'decimal-pad'], ['Weight (kg)', 'weight', 'decimal-pad']].map(([ph, key, kb]) => (
                                    <View key={key} style={[st.inputGroup, { flex: 1, marginHorizontal: 3 }]}>
                                        <TextInput
                                            style={st.input}
                                            placeholder={ph}
                                            placeholderTextColor={Colors.textMuted}
                                            keyboardType={kb as any}
                                            value={(form as any)[key]}
                                            onChangeText={(v) => setForm(f => ({ ...f, [key]: v }))}
                                        />
                                    </View>
                                ))}
                            </View>

                            <Text style={st.subLabel}>Goal</Text>
                            <View style={st.chipRow}>
                                {GOALS.map(g => (
                                    <TouchableOpacity
                                        key={g.key}
                                        style={[st.chip, form.goal === g.key && st.chipActive]}
                                        onPress={() => setForm(f => ({ ...f, goal: g.key }))}
                                    >
                                        <Text style={[st.chipText, form.goal === g.key && st.chipTextActive]}>{g.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={st.subLabel}>Activity Level</Text>
                            <View style={st.chipRow}>
                                {ACTIVITY.map(a => (
                                    <TouchableOpacity
                                        key={a.key}
                                        style={[st.chip, form.activity_level === a.key && st.chipActive]}
                                        onPress={() => setForm(f => ({ ...f, activity_level: a.key }))}
                                    >
                                        <Text style={[st.chipText, form.activity_level === a.key && st.chipTextActive]}>{a.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[st.genBtn, dietQuotaExhausted && st.genBtnDisabled]}
                                onPress={handleGenerate}
                                disabled={isLoading || dietQuotaExhausted}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="sparkles" size={18} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={st.genBtnText}>
                                            {dietQuotaExhausted ? 'Upgrade to Regenerate' : 'Generate My Plan'}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            {dietQuotaExhausted && (
                                <Text style={st.quotaMsg}>You have used your free AI Diet generation.</Text>
                            )}
                        </View>
                    )}

                    {/* Diet Plan Output */}
                    {plan && !showForm && (
                        <>
                            {plan.status === 'generating' && (
                                <View style={st.generatingCard}>
                                    <ActivityIndicator color={Colors.primary} size="large" />
                                    <Text style={st.generatingText}>AI is crafting your meal plan…</Text>
                                </View>
                            )}

                            {plan.status === 'ready' && (
                                <>
                                    {/* Macro Summary */}
                                    <View style={st.card}>
                                        <Text style={st.cardTitle}>Daily Targets</Text>
                                        <View style={st.calRow}>
                                            <Text style={st.calValue}>{Math.round(plan.calories)}</Text>
                                            <Text style={st.calLabel}> kcal / day</Text>
                                        </View>
                                        <MacroBar label="protein" g={plan.protein_g} color={MACRO_COLOR.protein} totalCal={plan.calories} />
                                        <MacroBar label="carbs" g={plan.carbs_g} color={MACRO_COLOR.carbs} totalCal={plan.calories} />
                                        <MacroBar label="fat" g={plan.fat_g} color={MACRO_COLOR.fat} totalCal={plan.calories} />
                                    </View>

                                    {/* Meals */}
                                    <Text style={st.sectionTitle}>Meal Plan</Text>
                                    {plan.meals.map((meal: any, i: number) => (
                                        <View key={i} style={st.mealCard}>
                                            <View style={st.mealHeader}>
                                                <Text style={st.mealName}>{meal.name}</Text>
                                                <Text style={st.mealCal}>{meal.calories} kcal</Text>
                                            </View>
                                            <View style={st.mealMacros}>
                                                {[['P', meal.protein_g, MACRO_COLOR.protein], ['C', meal.carbs_g, MACRO_COLOR.carbs], ['F', meal.fat_g, MACRO_COLOR.fat]].map(([l, v, c]) => (
                                                    <View key={String(l)} style={[st.mealMacroChip, { backgroundColor: String(c) + '22' }]}>
                                                        <Text style={[st.mealMacroText, { color: String(c) }]}>{l}: {Number(v).toFixed(0)}g</Text>
                                                    </View>
                                                ))}
                                            </View>
                                            {(meal.items ?? []).map((item: string, j: number) => (
                                                <Text key={j} style={st.mealItem}>• {item}</Text>
                                            ))}
                                        </View>
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </>
            )}

            {/* ──── SUPPLEMENT COACH TAB ──── */}
            {activeTab === 'supplement' && (
                <View style={st.card}>
                    {!isPremium ? (
                        <View style={st.upsellBox}>
                            <Ionicons name="lock-closed" size={48} color={Colors.primary} style={{ marginBottom: 16 }} />
                            <Text style={st.upsellTitle}>Premium Feature</Text>
                            <Text style={st.upsellDesc}>
                                Subscribe to GymBro Premium to unlock the AI Supplement Coach. Get personalized recommendations based on your goals and struggles.
                            </Text>
                            <TouchableOpacity style={st.genBtn} onPress={() => navigation.navigate('Subscriptions')}>
                                <Text style={st.genBtnText}>View Plans</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <Text style={st.cardTitle}>Your Requirements</Text>
                            <Text style={st.subLabel}>Describe your struggles or goals (e.g., "I get sore easily", "Hard time hitting protein steps")</Text>
                            <View style={st.reqInputGroup}>
                                <TextInput
                                    style={st.reqInput}
                                    placeholder="I want to improve..."
                                    placeholderTextColor={Colors.textMuted}
                                    multiline
                                    value={supplementReq}
                                    onChangeText={setSupplementReq}
                                />
                            </View>
                            <TouchableOpacity
                                style={st.genBtn}
                                onPress={handleGetSupplements}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="sparkles" size={18} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={st.genBtnText}>Get Recommendations</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {supplementAdvice && (
                                <View style={st.adviceBox}>
                                    <Text style={st.adviceTitle}>AI Recommendations:</Text>
                                    <Text style={st.adviceText}>{supplementAdvice}</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>
            )}
        </ScrollView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: 16,
    },
    title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
    editBtn: { padding: 8, backgroundColor: Colors.primaryGlow, borderRadius: Radius.full },

    // Tabs
    tabContainer: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.full, padding: 4 },
    tab: { flex: 1, flexDirection: 'row', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
    tabActive: { backgroundColor: Colors.primary },
    tabText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontWeight: '600' },
    tabTextActive: { color: '#fff', fontWeight: '700' },

    card: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
    },
    cardTitle: { fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
    row3: { flexDirection: 'row', marginBottom: 4 },
    inputGroup: {
        backgroundColor: Colors.surface, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8,
    },
    input: { color: Colors.textPrimary, fontSize: Fonts.sizes.sm, paddingVertical: 10, textAlign: 'center' },
    reqInputGroup: {
        backgroundColor: Colors.surface, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, minHeight: 100,
    },
    reqInput: { color: Colors.textPrimary, fontSize: Fonts.sizes.md, paddingVertical: 12, textAlignVertical: 'top' },

    subLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, fontWeight: '600', marginTop: 12, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
        borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
    },
    chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs },
    chipTextActive: { color: '#fff', fontWeight: '700' },

    genBtn: {
        flexDirection: 'row', justifyContent: 'center',
        backgroundColor: Colors.primary, borderRadius: Radius.md,
        paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md,
    },
    genBtnDisabled: { backgroundColor: Colors.border },
    genBtnText: { color: '#fff', fontWeight: '800', fontSize: Fonts.sizes.md },
    quotaMsg: { color: Colors.warning, fontSize: Fonts.sizes.xs, textAlign: 'center', marginTop: 8, fontWeight: '600' },

    generatingCard: {
        alignItems: 'center', padding: 40, margin: Spacing.lg,
        backgroundColor: Colors.card, borderRadius: Radius.xl,
    },
    generatingText: { color: Colors.textSecondary, marginTop: 12, fontSize: Fonts.sizes.md },
    calRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
    calValue: { fontSize: Fonts.sizes.display, fontWeight: '900', color: Colors.primary },
    calLabel: { fontSize: Fonts.sizes.md, color: Colors.textSecondary },
    macroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    macroLabel: { fontSize: Fonts.sizes.xs, fontWeight: '700', width: 50 },
    macroBarBg: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
    macroBarFill: { height: '100%', borderRadius: Radius.full },
    macroVal: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, width: 64, textAlign: 'right' },
    macroPct: { color: Colors.textMuted },
    sectionTitle: {
        fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.textPrimary,
        marginHorizontal: Spacing.lg, marginBottom: 12,
    },
    mealCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: 12,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    },
    mealHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    mealName: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
    mealCal: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: '700' },
    mealMacros: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    mealMacroChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    mealMacroText: { fontSize: Fonts.sizes.xs, fontWeight: '700' },
    mealItem: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },

    // Upsell
    upsellBox: { alignItems: 'center', paddingVertical: 20 },
    upsellTitle: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
    upsellDesc: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },

    // Advice
    adviceBox: { marginTop: Spacing.lg, padding: Spacing.md, backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
    adviceTitle: { fontSize: Fonts.sizes.sm, fontWeight: '800', color: Colors.primary, marginBottom: 8 },
    adviceText: { fontSize: Fonts.sizes.sm, color: Colors.textPrimary, lineHeight: 20 },
});
