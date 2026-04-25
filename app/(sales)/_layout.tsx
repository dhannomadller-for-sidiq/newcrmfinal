import React, { useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { C, R } from '@/lib/theme';

export default function SalesLayout() {
  const { signOut } = useAuth();
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.textMuted,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabItem,
        headerStyle: styles.header,
        headerShadowVisible: false,
        headerTintColor: C.textPrimary,
        headerTitleStyle: styles.headerTitle,
        headerRight: () => (
          <Pressable
            onPress={() => signOutRef.current()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.logoutBtn}
          >
            <Ionicons name="log-out-outline" size={18} color={C.textMuted} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Assigned',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && [styles.tabActive, { backgroundColor: C.greenLight }]]}>
              <Ionicons name={focused ? 'people' : 'people-outline'} size={20} color={focused ? C.green : C.textMuted} />
              {focused && <Text style={[styles.tabLabel, { color: C.green }]}>Assigned</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="mine"
        options={{
          title: 'My Leads',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && [styles.tabActive, { backgroundColor: C.greenLight }]]}>
              <Ionicons name={focused ? 'person-add' : 'person-add-outline'} size={20} color={focused ? C.green : C.textMuted} />
              {focused && <Text style={[styles.tabLabel, { color: C.green }]}>Mine</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="confirmed"
        options={{
          title: 'Confirmed',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && [styles.tabActive, { backgroundColor: C.greenLight }]]}>
              <Ionicons name={focused ? 'checkmark-done-circle' : 'checkmark-done-circle-outline'} size={20} color={focused ? C.green : C.textMuted} />
              {focused && <Text style={[styles.tabLabel, { color: C.green }]}>Done</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="allocated"
        options={{
          title: 'Allocated',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && [styles.tabActive, { backgroundColor: C.purpleLight }]]}>
              <Ionicons name={focused ? 'rocket' : 'rocket-outline'} size={20} color={focused ? C.purple : C.textMuted} />
              {focused && <Text style={[styles.tabLabel, { color: C.purple }]}>Allocated</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="followups"
        options={{
          title: 'Follow-ups',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && [styles.tabActive, { backgroundColor: C.amberLight }]]}>
              <Ionicons name={focused ? 'alarm' : 'alarm-outline'} size={20} color={focused ? C.amber : C.textMuted} />
              {focused && <Text style={[styles.tabLabel, { color: C.amber }]}>Follow-ups</Text>}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    height: 68,
    paddingHorizontal: 6,
    paddingBottom: 10,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 20,
  },
  tabItem:     { height: 50, justifyContent: 'center', alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8, paddingVertical: 7,
    borderRadius: R.full, gap: 5, minWidth: 34,
  },
  tabActive:   { paddingHorizontal: 12 },
  tabLabel:    { fontSize: 11, fontWeight: '700' },
  header:      { backgroundColor: C.surface, borderBottomColor: C.border, borderBottomWidth: 1 },
  headerTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  logoutBtn:   {
    marginRight: 16, padding: 8,
    backgroundColor: C.surface2,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
});
