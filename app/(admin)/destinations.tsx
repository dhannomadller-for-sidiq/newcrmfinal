import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';

type Destination = { id: string; name: string; options_car: boolean; options_bike: boolean; options_cab: boolean };

export default function DestinationsScreen() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [name, setName] = useState('');
  const [car, setCar] = useState(false);
  const [bike, setBike] = useState(false);
  const [cab, setCab] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchDestinations(); }, []);

  async function fetchDestinations() {
    setLoading(true);
    const { data } = await supabase.from('destinations').select('*').order('name');
    setDestinations(data ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!name) { Alert.alert('Error', 'Destination name is required.'); return; }
    setSaving(true);
    const { error } = await supabase.from('destinations').insert({ name, options_car: car, options_bike: bike, options_cab: cab });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    fetchDestinations();
  }

  const renderItem = ({ item }: { item: Destination }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="location-outline" size={20} color="#6366f1" />
        <Text style={styles.destName}>{item.name}</Text>
      </View>
      <View style={styles.optionRow}>
        <OptionChip label="Self-Drive Car" active={item.options_car} icon="car-outline" />
        <OptionChip label="Self-Drive Bike" active={item.options_bike} icon="bicycle-outline" />
        <OptionChip label="Cab" active={item.options_cab} icon="bus-outline" />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={destinations}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No destinations added yet.</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => { setName(''); setCar(false); setBike(false); setCab(false); setModalVisible(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Destination</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Destination Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Leh Ladakh" placeholderTextColor="#475569" />
            </View>

            <Text style={styles.fieldLabel}>Available Transport Options</Text>
            <ToggleRow label="Self-Drive Car" value={car} onChange={setCar} icon="car-outline" />
            <ToggleRow label="Self-Drive Bike" value={bike} onChange={setBike} icon="bicycle-outline" />
            <ToggleRow label="Cab Service" value={cab} onChange={setCab} icon="bus-outline" />

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Destination</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function OptionChip({ label, active, icon }: { label: string; active: boolean; icon: string }) {
  return (
    <View style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Ionicons name={icon as any} size={13} color={active ? '#6366f1' : '#475569'} />
      <Text style={[styles.chipText, { color: active ? '#6366f1' : '#475569' }]}>{label}</Text>
    </View>
  );
}

function ToggleRow({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon: string }) {
  return (
    <View style={styles.toggleRow}>
      <Ionicons name={icon as any} size={18} color="#94a3b8" />
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#334155', true: '#4f46e5' }} thumbColor={value ? '#6366f1' : '#64748b'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  destName: { color: '#f8fafc', fontSize: 17, fontWeight: '700', flex: 1 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  chipActive: { backgroundColor: '#6366f122', borderColor: '#6366f1' },
  chipInactive: { backgroundColor: '#0f172a', borderColor: '#334155' },
  chipText: { fontSize: 12, fontWeight: '600' },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  modal: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modalTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  formContent: { padding: 20, gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 10, padding: 14 },
  toggleLabel: { color: '#cbd5e1', fontSize: 15, flex: 1 },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
