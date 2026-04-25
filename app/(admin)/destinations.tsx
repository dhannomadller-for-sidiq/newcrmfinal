import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { C, R, S } from '@/lib/theme';

const CHECKLIST_MODULES = [
  { id: 'guests', label: '1. Guest Details', icon: 'people-outline' },
  { id: 'id_card', label: '2. ID Card Details', icon: 'card-outline' },
  { id: 'passport', label: '3. Passport Details', icon: 'book-outline' },
  { id: 'flights', label: '4. Flight Details', icon: 'airplane-outline' },
  { id: 'train', label: '5. Train Details', icon: 'train-outline' },
  { id: 'bus', label: '6. Bus Details', icon: 'bus-outline' },
  { id: 'itinerary', label: '7. Confirmed Itinerary', icon: 'location-outline' },
  { id: 'inc_exc', label: '8. Check Inclusions/Exclusions', icon: 'list-outline' },
  { id: 'hotels', label: '9. Hotel Accommodations', icon: 'bed-outline' },
  { id: 'info', label: '10. Important Info', icon: 'information-circle-outline' },
  { id: 'payment', label: '11. Payment & Settlement', icon: 'cash-outline' },
  { id: 'pdf', label: '12. PDF Share with Team', icon: 'share-social-outline' },
];

const DEFAULT_CHECKLIST_MODULES = ['guests', 'itinerary', 'inc_exc', 'hotels', 'info', 'payment', 'pdf'];

type Destination = { 
  id: string; 
  name: string; 
  options_car: boolean; 
  options_bike: boolean; 
  options_cab: boolean;
  checklist?: string | null;
};

export default function DestinationsScreen() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [name, setName] = useState('');
  const [car, setCar] = useState(false);
  const [bike, setBike] = useState(false);
  const [cab, setCab] = useState(false);
  const [checklist, setChecklist] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchDestinations(); }, []);

  async function fetchDestinations() {
    setLoading(true);
    const { data } = await supabase.from('destinations').select('*').order('name');
    setDestinations(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!name) { Alert.alert('Error', 'Destination name is required.'); return; }
    setSaving(true);
    
    const payload = { 
      name, 
      options_car: car, 
      options_bike: bike, 
      options_cab: cab,
      checklist
    };

    let error;
    if (editingId) {
      const res = await supabase.from('destinations').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('destinations').insert(payload);
      error = res.error;
    }
    
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    fetchDestinations();
  }

  function openEdit(dest: Destination) {
    setEditingId(dest.id);
    setName(dest.name);
    setCar(dest.options_car);
    setBike(dest.options_bike);
    setCab(dest.options_cab);
    setChecklist(dest.checklist || '');
    setModalVisible(true);
  }

  const toggleModule = (id: string) => {
    const current = checklist.split(',').filter(Boolean);
    if (current.includes(id)) {
      setChecklist(current.filter(x => x !== id).join(','));
    } else {
      setChecklist([...current, id].join(','));
    }
  };

  const renderItem = ({ item }: { item: Destination }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
      <View style={styles.cardHeader}>
        <Ionicons name="location-outline" size={20} color="#6366f1" />
        <Text style={styles.destName}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={18} color="#475569" />
      </View>
      <View style={styles.optionRow}>
        <OptionChip label="Car" active={item.options_car} icon="car-outline" />
        <OptionChip label="Bike" active={item.options_bike} icon="bicycle-outline" />
        <OptionChip label="Cab" active={item.options_cab} icon="bus-outline" />
      </View>
      {item.checklist && (
        <View style={styles.checklistPreview}>
          <Ionicons name="list" size={12} color="#94a3b8" />
          <Text style={styles.checklistPreviewText} numberOfLines={1}>
            {item.checklist.split(',').filter(Boolean).map(id => CHECKLIST_MODULES.find(m => m.id === id)?.label.split('. ')[1] || id).join(', ')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
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

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => { 
          setEditingId(null); 
          setName(''); 
          setCar(false); 
          setBike(false); 
          setCab(false); 
          setChecklist(DEFAULT_CHECKLIST_MODULES.join(',')); 
          setModalVisible(true); 
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Destination' : 'Add Destination'}</Text>
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
            
            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>Operations Checklist Modules</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {CHECKLIST_MODULES.map(m => (
                  <ToggleRow 
                    key={m.id}
                    label={m.label}
                    value={checklist.split(',').includes(m.id)}
                    onChange={() => toggleModule(m.id)}
                    icon={m.icon}
                  />
                ))}
              </View>
              <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 8 }}>
                * Enabled modules will show up for bookings of this destination in the Operations tab.
              </Text>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingId ? 'Save Changes' : 'Add Destination'}</Text>}
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
      <Ionicons name={icon as any} size={13} color={active ? C.primary : C.textMuted} />
      <Text style={[styles.chipText, { color: active ? C.primary : C.textMuted }]}>{label}</Text>
    </View>
  );
}

function ToggleRow({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon: string }) {
  return (
    <View style={styles.toggleRow}>
      <Ionicons name={icon as any} size={18} color={value ? C.primary : C.textMuted} />
      <Text style={[styles.toggleLabel, { color: value ? C.textPrimary : C.textSecond }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: C.border, true: C.primaryGlow }} thumbColor={value ? C.primary : C.textMuted} />
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  destName: { color: C.textPrimary, fontSize: 17, fontWeight: '800', flex: 1 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 5, borderWidth: 1 },
  chipActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  chipInactive: { backgroundColor: C.bg, borderColor: C.border },
  chipText: { fontSize: 12, fontWeight: '600' },
  checklistPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: C.surface2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  checklistPreviewText: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic', flex: 1 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 60, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: S.xl, paddingTop: S.xxl, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  formContent: { padding: S.xl, gap: S.lg },
  fieldGroup: { gap: S.xs },
  fieldLabel: { color: C.textSecond, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.surface2, color: C.textPrimary, borderRadius: R.sm, padding: S.md, fontSize: 15, borderWidth: 1.5, borderColor: C.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.surface2, borderRadius: R.sm, padding: S.md, borderWidth: 1, borderColor: C.border },
  toggleLabel: { fontSize: 15, flex: 1, fontWeight: '600' },
  saveBtn: { backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', marginTop: S.xs, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
