// GymBro — Root App Entry Point
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/authStore';
import { Colors } from './src/theme';

export default function App() {
    const { loadUser, isInitializing } = useAuthStore();

    useEffect(() => {
        loadUser();
    }, []);

    if (isInitializing) {
        return (
            <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <>
            <StatusBar style="light" backgroundColor={Colors.bg} />
            <RootNavigator />
        </>
    );
}
