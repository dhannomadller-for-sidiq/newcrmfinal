import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';

type Lead = {
  id: string;
  name: string;
  contact_no: string;
  destination: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  returned_to_admin: boolean;
  followup_status: string | null;
};

type Profile = { id: string; name: string | null };

const STATUS_COLORS: Record<string, string> = {
  New: '#6366f1',
  Contacted: '#f59e0b',
  Converted: '#10b981',
  Lost: '#ef4444',
};

export default function LeadsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [returnedLeads, setReturnedLeads] = useState<Lead[]>([]);
  const [salespersons, setSalespersons] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [reassignModal, setReassignModal] = useState(false);
  const [reassignLeadId, setReassignLeadId] = useState('');
  const [reassignTo, setReassignTo] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [destination, setDestination] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchSalespersons();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    const [all, returned] = await Promise.all([
      supabase.from('leads').select('*').eq('returned_to_admin', false).order('created_at', { ascending: false }),
      supabase.from('leads').select('*').eq('returned_to_admin', true).order('created_at', { ascending: false }),
    ]);
    setLeads(all.data ?? []);
    setReturnedLeads(returned.data ?? []);
    setLoading(false);
  }

  async function fetchSalespersons() {
    const { data } = await supabase.from('profiles').select('id, name').eq('role', 'sale');
    setSalespersons(data ?? []);
  }

  async function handleCreate() {
    if (!name || !contact || !destination) {
      Alert.alert('Error', 'Name, contact, and destination are required.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('leads').insert({
      name, contact_no: contact, destination,
      assigned_to: assignedTo || null,
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    resetForm();
    fetchLeads();
  }

  function resetForm() {
    setName(''); setContact(''); setDestination(''); setAssignedTo('');
  }

  async function handleReassign() {
    if (!reassignTo) { Alert.alert('Error', 'Select a salesperson first.'); return; }
    await supabase.from('leads').update({
      assigned_to: reassignTo,
      returned_to_admin: false,
      status: 'New',
    }).eq('id', reassignLeadId);
    setReassignModal(false);
    fetchLeads();
  }

  function openModal() { resetForm(); setModalVisible(true); }

  const renderLead = ({ item }: { item: Lead }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.leadName}>{item.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? '#6366f1') + '33' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? '#6366f1' }]}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.cardRow}>
        <Ionicons name="call-outline" size={14} color="#94a3b8" />
        <Text style={styles.cardMeta}>{item.contact_no}</Text>
      </View>
      <View style={styles.cardRow}>
        <Ionicons name="map-outline" size={14} color="#94a3b8" />
        <Text style={styles.cardMeta}>{item.destination}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* ── Return from Sale section ───────────────────────── */}
          {returnedLeads.length > 0 && (
            <View style={styles.returnSection}>
              <View style={styles.returnHeader}>
                <Ionicons name="arrow-undo-outline" size={16} color="#f59e0b" />
                <Text style={styles.returnHeaderText}>↩ Return from Sale ({returnedLeads.length})</Text>
              </View>
              {returnedLeads.map(item => (
                <View key={item.id} style={styles.returnCard}>
                  <View style={styles.returnCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leadName}>{item.name}</Text>
                      <Text style={styles.cardMeta}>{item.contact_no}</Text>
                      <Text style={[styles.cardMeta, { color: '#8b5cf6' }]}>{item.destination}</Text>
                    </View>
                    <TouchableOpacity style={styles.reassignBtn} onPress={() => {
                      setReassignLeadId(item.id);
                      setReassignTo('');
                      setReassignModal(true);
                    }}>
                      <Ionicons name="person-add-outline" size={14} color="#fff" />
                      <Text style={styles.reassignBtnText}>Reassign</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Main leads list ────────────────────────────────── */}
          {leads.map(item => renderLead({ item }))}
          {leads.length === 0 && returnedLeads.length === 0 && (
            <Text style={styles.empty}>No leads yet. Add your first lead!</Text>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Reassign Modal */}
      <Modal visible={reassignModal} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setReassignModal(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Reassign to Salesperson</Text>
            {salespersons.map(sp => (
              <TouchableOpacity key={sp.id} style={[styles.pickerItem, reassignTo === sp.id && styles.pickerItemActive]}
                onPress={() => setReassignTo(sp.id)}>
                <Ionicons name="person-outline" size={16} color={reassignTo === sp.id ? '#6366f1' : '#64748b'} />
                <Text style={[styles.pickerItemText, reassignTo === sp.id && { color: '#6366f1', fontWeight: '700' }]}>{sp.name ?? sp.id}</Text>
                {reassignTo === sp.id && <Ionicons name="checkmark" size={16} color="#6366f1" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={handleReassign}>
              <Text style={styles.saveBtnText}>Reassign Lead</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Lead Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Lead</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <FormField label="Full Name *" value={name} onChangeText={setName} placeholder="John Doe" />
            <FormField label="Contact No *" value={contact} onChangeText={setContact} placeholder="+91 98765 43210" keyboardType="phone-pad" />
            <FormField label="Destination *" value={destination} onChangeText={setDestination} placeholder="Leh Ladakh" />

            <Text style={styles.fieldLabel}>Assign Salesperson</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !assignedTo && styles.chipActive]}
                onPress={() => setAssignedTo('')}
              >
                <Text style={[styles.chipText, !assignedTo && styles.chipTextActive]}>Unassigned</Text>
              </TouchableOpacity>
              {salespersons.map((sp) => (
                <TouchableOpacity
                  key={sp.id}
                  style={[styles.chip, assignedTo === sp.id && styles.chipActive]}
                  onPress={() => setAssignedTo(sp.id)}
                >
                  <Text style={[styles.chipText, assignedTo === sp.id && styles.chipTextActive]}>{sp.name ?? sp.id}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Lead</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType = 'default' }: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leadName: { color: '#f8fafc', fontSize: 16, fontWeight: '700', flex: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMeta: { color: '#94a3b8', fontSize: 13 },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
  // Return from Sale
  returnSection: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, gap: 10, borderWidth: 1.5, borderColor: '#f59e0b44' },
  returnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  returnHeaderText: { color: '#f59e0b', fontSize: 14, fontWeight: '700' },
  returnCard: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12 },
  returnCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reassignBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  reassignBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Picker
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4, paddingBottom: 40 },
  pickerTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10 },
  pickerItemActive: { backgroundColor: '#6366f122' },
  pickerItemText: { flex: 1, color: '#cbd5e1', fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
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
