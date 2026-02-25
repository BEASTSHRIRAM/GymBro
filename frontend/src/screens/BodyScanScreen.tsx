// GymBro — Body Scan Screen
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { Colors, Spacing, Radius, Fonts } from '../theme';

interface ScanReport {
    id: string;
    body_fat_estimate?: number;
    posture_analysis?: string;
    imbalance_scores?: Record<string, number>;
    corrective_exercises?: string[];
}

export default function BodyScanScreen() {
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState<ScanReport | null>(null);

    const pickAndAnalyze = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission', 'Photo library access required');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
            quality: 0.5,
        });
        if (result.canceled) return;

        setIsLoading(true);
        try {
            const asset = result.assets[0];
            const formData = new FormData();
            formData.append('video', {
                uri: asset.uri,
                name: 'body_scan.mp4',
                type: 'video/mp4',
            } as any);

            const { data } = await api.post('/body-scan/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            });
            setReport(data);
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail ?? 'Body scan failed. Try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={st.header}>
                <Text style={st.title}>🔍 AI Body Scan</Text>
            </View>

            {/* Instructions */}
            <View style={st.infoCard}>
                <Text style={st.infoTitle}>📹 How to Record</Text>
                {[
                    '1. Stand 2–3 meters from camera',
                    '2. Record a slow 360° rotation',
                    '3. Wear tight-fitted clothing',
                    '4. Keep good lighting',
                ].map((l, i) => (
                    <Text key={i} style={st.infoItem}>{l}</Text>
                ))}
            </View>

            {/* Scan Button */}
            <TouchableOpacity style={st.scanBtn} onPress={pickAndAnalyze} disabled={isLoading}>
                {isLoading ? (
                    <>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={st.scanBtnText}>Analyzing with AI…</Text>
                    </>
                ) : (
                    <>
                        <Text style={st.scanBtnIcon}>🎥</Text>
                        <Text style={st.scanBtnText}>Record 360° Video</Text>
                        <Text style={st.scanBtnSub}>Opens camera</Text>
                    </>
                )}
            </TouchableOpacity>

            {/* Report */}
            {report && (
                <>
                    <Text style={st.sectionTitle}>Your Report</Text>

                    {/* Body Fat */}
                    {report.body_fat_estimate != null && (
                        <View style={st.card}>
                            <Text style={st.cardTitle}>Body Fat Estimate</Text>
                            <Text style={st.bigNumber}>{report.body_fat_estimate?.toFixed(1)}%</Text>
                            <Text style={st.note}>Approximate — based on visual analysis</Text>
                        </View>
                    )}

                    {/* Posture Analysis */}
                    {report.posture_analysis && (
                        <View style={st.card}>
                            <Text style={st.cardTitle}>🧍 Posture Analysis</Text>
                            <Text style={st.analysisText}>{report.posture_analysis}</Text>
                        </View>
                    )}

                    {/* Imbalance Scores */}
                    {report.imbalance_scores && Object.keys(report.imbalance_scores).length > 0 && (
                        <View style={st.card}>
                            <Text style={st.cardTitle}>⚖️ Imbalance Scores</Text>
                            {Object.entries(report.imbalance_scores).map(([key, val]) => (
                                <View key={key} style={st.imbalRow}>
                                    <Text style={st.imbalKey}>{key.replace(/_/g, ' ')}</Text>
                                    <View style={st.imbalBarBg}>
                                        <View style={[st.imbalBarFill, { width: `${Math.min(val, 100)}%` }]} />
                                    </View>
                                    <Text style={st.imbalVal}>{typeof val === 'number' ? val.toFixed(0) : val}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Corrective Exercises */}
                    {report.corrective_exercises && report.corrective_exercises.length > 0 && (
                        <View style={st.card}>
                            <Text style={st.cardTitle}>💪 Corrective Exercises</Text>
                            {report.corrective_exercises.map((ex, i) => (
                                <View key={i} style={st.exerciseRow}>
                                    <View style={st.numBadge}><Text style={st.numText}>{i + 1}</Text></View>
                                    <Text style={st.exerciseText}>{ex}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: 16 },
    title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
    infoCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    },
    infoTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
    infoItem: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginBottom: 4 },
    scanBtn: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
        padding: Spacing.xl, alignItems: 'center',
        borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed',
    },
    scanBtnIcon: { fontSize: 48, marginBottom: 8 },
    scanBtnText: { fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
    scanBtnSub: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
    sectionTitle: {
        fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.textPrimary,
        marginHorizontal: Spacing.lg, marginBottom: 12,
    },
    card: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
    },
    cardTitle: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
    bigNumber: { fontSize: Fonts.sizes.display, fontWeight: '900', color: Colors.primary },
    note: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 4 },
    analysisText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, lineHeight: 22 },
    imbalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    imbalKey: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, width: 90, textTransform: 'capitalize' },
    imbalBarBg: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
    imbalBarFill: { height: '100%', backgroundColor: Colors.warning, borderRadius: Radius.full },
    imbalVal: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, width: 30, textAlign: 'right' },
    exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
    numBadge: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
    },
    numText: { fontSize: Fonts.sizes.xs, color: Colors.primary, fontWeight: '700' },
    exerciseText: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.textPrimary, lineHeight: 20 },
});
