import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { C, R, S } from '@/lib/theme';

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
            <Text style={[styles.pctText, { color: pct >= 100 ? C.green : pct >= 50 ? C.amber : C.red }]}>{pct}%</Text>
          </View>
        </View>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 100 ? C.green : pct >= 50 ? C.amber : C.primary }]} />
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
  container: { flex: 1, backgroundColor: C.bg },
  list: { padding: S.lg, gap: S.sm },
  card: {
    backgroundColor: C.surface, borderRadius: R.lg, padding: S.lg, gap: S.md,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  personName: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  monthText: { color: C.textMuted, fontSize: 13, marginTop: 2 },
  pctBadge: { backgroundColor: C.bg, borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  pctText: { fontSize: 15, fontWeight: '900' },
  progressTrack: { height: 8, backgroundColor: C.bg, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  progressFill: { height: '100%', borderRadius: 4 },
  amountsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  amountLabel: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 60, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: S.xl, paddingTop: S.xxl, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  formContent: { padding: S.xl, gap: S.lg },
  fieldGroup: { gap: S.xs },
  fieldLabel: { color: C.textSecond, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.surface2, color: C.textPrimary, borderRadius: R.sm, padding: S.md, fontSize: 15, borderWidth: 1.5, borderColor: C.border },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  chip: { borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 8, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  chipText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.primary, fontWeight: '800' },
  saveBtn: { backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', marginTop: S.xs, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
