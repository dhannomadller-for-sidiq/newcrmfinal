import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FinanceDashboard() {
  return (
    <View style={s.container}>
      <View style={s.card}>
        <Ionicons name="construct-outline" size={64} color="#22c55e" />
        <Text style={s.title}>Finance Module</Text>
        <Text style={s.sub}>Under Construction</Text>
        <Text style={s.text}>Your secure financial management portal is being tailored for Nomadller operations.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#1e293b', borderRadius: 24, padding: 40, alignItems: 'center', gap: 15, width: '100%', maxWidth: 400 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '900' },
  sub: { color: '#22c55e', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  text: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
