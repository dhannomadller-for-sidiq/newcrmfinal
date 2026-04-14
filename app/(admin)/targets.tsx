import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';

type Target = { id: string; salesperson_id: string; target_month: string; target_amount: number; achieved_amount: number };
type Profile = { id: string; name: string | null };

export default function TargetsScreen() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [salespersons, setSalespersons] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [salesperson, setSalesperson] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTargets(); fetchSalespersons(); }, []);

  async function fetchTargets() {
    setLoading(true);
    const { data } = await supabase.from('targets').select('*').order('target_month', { ascending: false });
    setTargets(data ?? []);
    setLoading(false);
  }

  async function fetchSalespersons() {
    const { data } = await supabase.from('profiles').select('id, name').eq('role', 'sale');
    setSalespersons(data ?? []);
  }

  async function handleCreate() {
    if (!salesperson || !month || !amount) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('targets').insert({
      salesperson_id: salesperson,
      target_month: month + '-01',
      target_amount: parseFloat(amount),
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    fetchTargets();
  }

  function getName(id: string) {
    return salespersons.find(s => s.id === id)?.name ?? 'Unknown';
  }

  function getProgress(achieved: number, target: number) {
    if (target === 0) return 0;
    return Math.min(achieved / target, 1);
  }

  const renderTarget = ({ item }: { item: Target }) => {
    const progress = getProgress(item.achieved_amount, item.target_amount);
    const pct = Math.round(progress * 100);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.personName}>{getName(item.salesperson_id)}</Text>
            <Text style={styles.monthText}>{item.target_month.slice(0, 7)}</Text>
          </View>
          <View style={styles.pctBadge}>
            <Text style={[styles.pctText, { color: pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }]}>{pct}%</Text>
          </View>
        </View>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#6366f1' }]} />
        </View>
        <View style={styles.amountsRow}>
          <Text style={styles.amountLabel}>₹{item.achieved_amount.toLocaleString()} achieved</Text>
          <Text style={styles.amountLabel}>₹{item.target_amount.toLocaleString()} target</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={targets}
          keyExtractor={(i) => i.id}
          renderItem={renderTarget}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No targets set yet.</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => { setSalesperson(''); setMonth(''); setAmount(''); setModalVisible(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Monthly Target</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.fieldLabel}>Salesperson *</Text>
            <View style={styles.chipRow}>
              {salespersons.map((sp) => (
                <TouchableOpacity
                  key={sp.id}
                  style={[styles.chip, salesperson === sp.id && styles.chipActive]}
                  onPress={() => setSalesperson(sp.id)}
                >
                  <Text style={[styles.chipText, salesperson === sp.id && styles.chipTextActive]}>{sp.name ?? sp.id}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Month (YYYY-MM) *</Text>
              <TextInput style={styles.input} value={month} onChangeText={setMonth} placeholder="2026-04" placeholderTextColor="#475569" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Target Amount (₹) *</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="100000" placeholderTextColor="#475569" keyboardType="numeric" />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Set Target</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  personName: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  monthText: { color: '#94a3b8', fontSize: 13 },
  pctBadge: { backgroundColor: '#0f172a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pctText: { fontSize: 14, fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  amountsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  amountLabel: { color: '#64748b', fontSize: 12 },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  modal: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modalTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  formContent: { padding: 20, gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
