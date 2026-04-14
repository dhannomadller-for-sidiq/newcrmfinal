import React, { useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function SalesLayout() {
  const { signOut } = useAuth();
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        headerStyle: { backgroundColor: '#070a13' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '900', fontSize: 20 },
        headerRight: () => (
          <Pressable
            onPress={() => signOutRef.current()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginRight: 16, padding: 6 }}
          >
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Assigned',
          tabBarLabel: 'Assigned',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mine"
        options={{
          title: 'My Leads',
          tabBarLabel: 'Mine',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-add" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="confirmed"
        options={{
          title: 'Confirmed',
          tabBarLabel: 'Confirmed',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="allocated"
        options={{
          title: 'Allocated',
          tabBarLabel: 'Allocated',
          tabBarIcon: ({ color, size }) => <Ionicons name="rocket" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="followups"
        options={{
          title: 'Follow-ups',
          tabBarLabel: 'Followups',
          tabBarIcon: ({ color, size }) => <Ionicons name="alarm" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

