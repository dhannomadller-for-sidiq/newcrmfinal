import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';

type StatCardProps = {
  icon: string;
  label: string;
  value: string;
  color: string;
};

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { profile } = useAuth();
  const [stats, setStats] = React.useState({
    leads: '—',
    team: '—',
    destinations: '—',
    itineraries: '—',
  });

  React.useEffect(() => {
    async function fetchStats() {
      const [leads, team, dest, itin] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['sale', 'operations', 'finance']),
        supabase.from('destinations').select('*', { count: 'exact', head: true }),
        supabase.from('itineraries').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        leads: leads.count?.toString() ?? '0',
        team: team.count?.toString() ?? '0',
        destinations: dest.count?.toString() ?? '0',
        itineraries: itin.count?.toString() ?? '0',
      });
    }
    fetchStats();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetText}>Hello, {profile?.name ?? 'Admin'} 👋</Text>
        <Text style={styles.greetSub}>Welcome to the Nomadller Admin Panel</Text>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.grid}>
        <StatCard icon="people-outline" label="Total Leads" value={stats.leads} color="#6366f1" />
        <StatCard icon="person-outline" label="Team" value={stats.team} color="#10b981" />
        <StatCard icon="map-outline" label="Destinations" value={stats.destinations} color="#f59e0b" />
        <StatCard icon="document-text-outline" label="Itineraries" value={stats.itineraries} color="#ef4444" />
      </View>

      {/* Quick nav hint */}
      <View style={styles.hintCard}>
        <Ionicons name="information-circle-outline" size={20} color="#6366f1" />
        <Text style={styles.hintText}>
          Use the tabs below to manage Leads, Sales Team, Targets, Destinations & Itineraries.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, gap: 20 },
  greeting: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
  },
  greetText: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  greetSub: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    gap: 8,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statValue: { color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#94a3b8', fontSize: 12 },
  hintCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  hintText: { color: '#94a3b8', fontSize: 13, flex: 1, lineHeight: 20 },
});
