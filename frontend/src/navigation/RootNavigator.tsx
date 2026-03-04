// GymBro — Navigation Root
// AuthNavigator → (Login, Register, OTP)
// AppNavigator → Drawer → BottomTabs → All screens

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
    createBottomTabNavigator,
    type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { Alert, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
    DrawerContentScrollView,
    DrawerItemList,
} from '@react-navigation/drawer';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OTPScreen from '../screens/auth/OTPScreen';

// App screens
import HomeScreen from '../screens/HomeScreen';
import FormCheckerScreen from '../screens/FormCheckerScreen';
import VideoCallFormCheckerScreen from '../screens/VideoCallFormCheckerScreen';
import StrengthScreen from '../screens/StrengthScreen';
import DietScreen from '../screens/DietScreen';
import BodyScanScreen from '../screens/BodyScanScreen';
import GamificationScreen from '../screens/GamificationScreen';
import CoachesScreen from '../screens/CoachesScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileEditor from '../screens/ProfileEditor';
import WorkoutSplitScreen from '../screens/WorkoutSplitScreen';
import MusicScreen from '../screens/MusicScreen';

const AuthStack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

// ── Bottom Tabs ───────────────────────────────────────────────────────────────
function BottomTabs() {
    // Map tab names to valid Ionicons names
    type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
    const TAB_ICONS: Record<string, IoniconsName> = {
        Home: 'home',
        'AI Trainer': 'videocam',
        Diet: 'nutrition',
        Strength: 'fitness',
        'My Split': 'barbell',
    };

    return (
        <Tab.Navigator
            screenOptions={({ route }): BottomTabNavigationOptions => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: Colors.card,
                    borderTopColor: Colors.border,
                    borderTopWidth: 1,
                    height: 60,
                    paddingBottom: 8,
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textMuted,
                tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                    <Ionicons name={TAB_ICONS[route.name] ?? 'ellipse'} size={size} color={color} />
                ),
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="AI Trainer" component={VideoCallFormCheckerScreen} />
            <Tab.Screen name="Diet" component={DietScreen} />
            <Tab.Screen name="Strength" component={StrengthScreen} />
            <Tab.Screen name="My Split" component={WorkoutSplitScreen} />
        </Tab.Navigator>
    );
}

// ── Profile Stack ─────────────────────────────────────────────────────────────
function ProfileStackNavigator() {
    return (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
            <ProfileStack.Screen name="ProfileEditor" component={ProfileEditor} />
        </ProfileStack.Navigator>
    );
}

// ── Custom Drawer Content ─────────────────────────────────────────────────────
function CustomDrawerContent(props: any) {
    const logout = useAuthStore((s) => s.logout);

    const handleLogout = () => {
        Alert.alert(
            'Are You Sure?',
            "Don't leave your Bro!",
            [
                { text: 'Stay', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => logout(),
                },
            ]
        );
    };

    return (
        <View style={{ flex: 1 }}>
            <DrawerContentScrollView {...props}>
                <DrawerItemList {...props} />
            </DrawerContentScrollView>
            <View style={drawerStyles.logoutSection}>
                <TouchableOpacity style={drawerStyles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                    <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                    <Text style={drawerStyles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const drawerStyles = StyleSheet.create({
    logoutSection: {
        borderTopWidth: 1,
        borderTopColor: '#2A2A2A',
        padding: 16,
        paddingBottom: 32,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
});

// ── Drawer Navigator ──────────────────────────────────────────────────────────
function AppDrawer() {
    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerStyle: { backgroundColor: Colors.card, width: 280 },
                drawerActiveTintColor: Colors.primary,
                drawerInactiveTintColor: Colors.textSecondary,
                drawerLabelStyle: { fontSize: 16, fontWeight: '600' },
                swipeEnabled: true,
            }}
        >
            <Drawer.Screen
                name="Main"
                component={BottomTabs}
                options={{
                    title: 'GymBro',
                    drawerLabel: 'Home',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="Profile"
                component={ProfileStackNavigator}
                options={{
                    drawerLabel: 'Profile',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="Subscriptions"
                component={SubscriptionScreen}
                options={{
                    drawerLabel: 'My Subscriptions',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="card-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="BodyScan"
                component={BodyScanScreen}
                options={{
                    drawerLabel: 'AI Body Scan',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="body-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="Gamification"
                component={GamificationScreen}
                options={{
                    drawerLabel: 'Achievements',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="trophy-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="Coaches"
                component={CoachesScreen}
                options={{
                    drawerLabel: 'Find Coaches',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="people-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="YourMusic"
                component={MusicScreen}
                options={{
                    drawerLabel: 'Your Music',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="musical-notes" size={size} color={color} />
                    ),
                }}
            />
        </Drawer.Navigator>
    );
}

// ── Auth Stack ────────────────────────────────────────────────────────────────
function AuthNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
            <AuthStack.Screen name="OTP" component={OTPScreen} />
        </AuthStack.Navigator>
    );
}

// ── Root Navigator ────────────────────────────────────────────────────────────
export default function RootNavigator() {
    const isAuthenticated = useAuthStore((s: { isAuthenticated: boolean }) => s.isAuthenticated);

    return (
        <NavigationContainer>
            {isAuthenticated ? <AppDrawer /> : <AuthNavigator />}
        </NavigationContainer>
    );
}
