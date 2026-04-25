import React, { useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { C, R } from '@/lib/theme';

export default function AdminLayout() {
  const { signOut } = useAuth();
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabItem,
        // Keep header visible so logout button works on every tab
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
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && styles.tabActive]}>
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={20} color={focused ? C.primary : C.textMuted} />
              {focused && <Text style={styles.tabLabel}>Home</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && styles.tabActive]}>
              <Ionicons name={focused ? 'people' : 'people-outline'} size={20} color={focused ? C.primary : C.textMuted} />
              {focused && <Text style={styles.tabLabel}>Leads</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="salespersons"
        options={{
          title: 'Team',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && styles.tabActive]}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={20} color={focused ? C.primary : C.textMuted} />
              {focused && <Text style={styles.tabLabel}>Team</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="targets"
        options={{
          title: 'Targets',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && styles.tabActive]}>
              <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={20} color={focused ? C.primary : C.textMuted} />
              {focused && <Text style={styles.tabLabel}>Targets</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="destinations"
        options={{
          title: 'Places',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && styles.tabActive]}>
              <Ionicons name={focused ? 'map' : 'map-outline'} size={20} color={focused ? C.primary : C.textMuted} />
              {focused && <Text style={styles.tabLabel}>Places</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: 'Operations',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && styles.tabActive]}>
              <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={20} color={focused ? C.primary : C.textMuted} />
              {focused && <Text style={styles.tabLabel}>Ops</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="itineraries"
        options={{
          title: 'Itineraries',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tab, focused && styles.tabActive]}>
              <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={20} color={focused ? C.primary : C.textMuted} />
              {focused && <Text style={styles.tabLabel}>Plans</Text>}
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
    shadowRadius: 16,
    elevation: 20,
  },
  tabItem:  { height: 50, justifyContent: 'center', alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8, paddingVertical: 7,
    borderRadius: R.full, gap: 5, minWidth: 34,
  },
  tabActive: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 12,
  },
  tabLabel: { color: C.primary, fontSize: 11, fontWeight: '700' },

  header:      { backgroundColor: C.surface, borderBottomColor: C.border, borderBottomWidth: 1 },
  headerTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  logoutBtn: {
    marginRight: 16, padding: 8,
    backgroundColor: C.surface2,
    borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
  },
});
