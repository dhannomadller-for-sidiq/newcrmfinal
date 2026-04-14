import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { TouchableOpacity } from 'react-native';

export default function FinanceLayout() {
  const { signOut } = useAuth();

  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: '#1e293b', borderTopWidth: 0, height: 65, paddingBottom: 10 },
      tabBarActiveTintColor: '#22c55e',
      tabBarInactiveTintColor: '#64748b',
      headerStyle: { backgroundColor: '#0f172a' },
      headerTitleStyle: { color: '#f8fafc', fontWeight: '900' },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Finance Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
          headerRight: () => (
            <TouchableOpacity onPress={signOut} style={{ marginRight: 15 }}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}
