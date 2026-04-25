import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { C, R } from '@/lib/theme';

export default function OperationsLayout() {
  const { signOut } = useAuth();

  return (
    <Tabs screenOptions={{
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: C.teal,
      tabBarInactiveTintColor: C.textMuted,
      tabBarShowLabel: false,
      tabBarItemStyle: styles.tabItem,
      headerStyle: styles.header,
      headerShadowVisible: false,
      headerTitleStyle: styles.headerTitle,
      headerTintColor: C.textPrimary,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Operations',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && [styles.tabActive, { backgroundColor: C.tealLight }]]}>
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={20} color={focused ? C.teal : C.textMuted} />
              {focused && <Text style={[styles.tabLabel, { color: C.teal }]}>Ops</Text>}
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={signOut}
              style={[styles.logoutBtn, { marginRight: 15 }]}
            >
              <Ionicons name="log-out-outline" size={18} color={C.textMuted} />
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.border,
    height: 68, paddingBottom: 10, paddingTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 20,
  },
  tabItem:     { height: 50, justifyContent: 'center', alignItems: 'center' },
  tab:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 7, borderRadius: R.full, gap: 5, minWidth: 34 },
  tabActive:   { paddingHorizontal: 12 },
  tabLabel:    { fontSize: 11, fontWeight: '700' },
  header:      { backgroundColor: C.surface, borderBottomColor: C.border, borderBottomWidth: 1 },
  headerTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  logoutBtn:   { padding: 8, backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border },
});
