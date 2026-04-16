import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { STATUS_COLORS, FOLLOWUP_STATUSES, FUP_COLORS, FUP_LABELS, OPTION_META } from '@/lib/salesConstants';

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
  itinerary_id: string | null;
  itinerary_option: string | null;
  itinerary_history: any[] | null;
  call_remarks: string | null;
  assigned_to_profile?: { name: string | null };
};

type Itinerary = { id: string; title: string; pricing_data: any; description?: string };

type Profile = { id: string; name: string | null };

// (Remove old STATUS_COLORS as it's now imported)

export default function LeadsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [returnedLeads, setReturnedLeads] = useState<Lead[]>([]);
  const [salespersons, setSalespersons] = useState<Profile[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Detail Modal state
  const [detailModal, setDetailModal] = useState(false);
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [viewItinId, setViewItinId] = useState<string | null>(null);
  const [viewItinOption, setViewItinOption] = useState<string | null>(null);
  const [isViewingCurrent, setIsViewingCurrent] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchSalespersons();
    fetchItineraries();
  }, []);

  async function fetchItineraries() {
    const { data } = await supabase.from('itineraries').select('*');
    setItineraries(data ?? []);
  }

  async function fetchLeads() {
    setLoading(true);
    const [all, returned] = await Promise.all([
      supabase.from('leads').select('*, assigned_to_profile:profiles(name)').eq('returned_to_admin', false).order('created_at', { ascending: false }),
      supabase.from('leads').select('*, assigned_to_profile:profiles(name)').eq('returned_to_admin', true).order('created_at', { ascending: false }),
    ]);
    setLeads(all.data as any[] ?? []);
    setReturnedLeads(returned.data as any[] ?? []);
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

  async function openDetailModal(lead: Lead) {
    setViewLead(lead);
    setDetailModal(true);
    const { data } = await supabase
      .from('call_logs')
      .select('*, salesperson:profiles(name)')
      .eq('lead_id', lead.id)
      .order('called_at', { ascending: false });
    setCallHistory(data ?? []);
  }

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.contact_no.includes(searchQuery)
  );
  
  const filteredReturned = returnedLeads.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.contact_no.includes(searchQuery)
  );

  const renderLead = ({ item }: { item: Lead }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={() => openDetailModal(item)} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.leadName}>{item.name}</Text>
          {item.assigned_to_profile?.name && (
            <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '700' }}>👤 {item.assigned_to_profile.name}</Text>
          )}
        </View>
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
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* Search Bar */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#475569" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search leads by name or number..."
              placeholderTextColor="#475569"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#475569" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ── Return from Sale section ───────────────────────── */}
          {filteredReturned.length > 0 && (
            <View style={styles.returnSection}>
              <View style={styles.returnHeader}>
                <Ionicons name="arrow-undo-outline" size={16} color="#f59e0b" />
                <Text style={styles.returnHeaderText}>↩ Return from Sale ({filteredReturned.length})</Text>
              </View>
              {filteredReturned.map(item => (
                <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => openDetailModal(item)} style={styles.returnCard}>
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
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Main leads list ────────────────────────────────── */}
          {filteredLeads.map(item => renderLead({ item }))}
          {filteredLeads.length === 0 && filteredReturned.length === 0 && (
            <Text style={styles.empty}>No leads found matching your search.</Text>
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

      {/* ── Lead Details Modal ──────────────────────────────────────────────── */}
      <Modal visible={detailModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{viewLead?.name}</Text>
              <Text style={styles.modalSub}>{viewLead?.contact_no}</Text>
            </View>
            <TouchableOpacity onPress={() => setDetailModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <View style={styles.detailRow}>
              <Ionicons name="map-outline" size={16} color="#94a3b8" />
              <Text style={styles.detailText}>{viewLead?.destination}</Text>
            </View>
            
            {viewLead?.followup_status && (
              <View style={styles.detailRow}>
                <Ionicons 
                  name={FOLLOWUP_STATUSES.find(f => f.key === viewLead.followup_status)?.icon as any ?? 'flag-outline'} 
                  size={16} 
                  color={FUP_COLORS[viewLead.followup_status] ?? '#6366f1'} 
                />
                <Text style={[styles.detailText, { color: FUP_COLORS[viewLead.followup_status] ?? '#6366f1', fontWeight: '700' }]}>
                  {FUP_LABELS[viewLead.followup_status] ?? viewLead.followup_status}
                </Text>
              </View>
            )}

            {viewLead?.assigned_to_profile?.name && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color="#6366f1" />
                <Text style={[styles.detailText, { color: '#6366f1', fontWeight: '600' }]}>Assigned to: {viewLead.assigned_to_profile.name}</Text>
              </View>
            )}

            {viewLead?.call_remarks && (
              <View style={styles.box}>
                <Text style={styles.subHeading}>💬 Call Remarks History</Text>
                <Text style={{ color: '#cbd5e1', fontSize: 13, fontStyle: 'italic', marginTop: 4 }}>{viewLead.call_remarks}</Text>
              </View>
            )}

            {(viewLead?.itinerary_id || (viewLead?.itinerary_history && viewLead.itinerary_history.length > 0)) && (
              <View style={styles.box}>
                <Text style={styles.subHeading}>🗺️ Itinerary History</Text>
                {viewLead.itinerary_id && (
                  <TouchableOpacity 
                    onPress={() => { setViewItinId(viewLead.itinerary_id!); setViewItinOption(viewLead.itinerary_option); setIsViewingCurrent(true); }} 
                    style={[styles.detailRow, { marginTop: 8 }]}
                  >
                    <Ionicons name="location" size={14} color="#10b981" />
                    <Text style={[styles.detailText, { color: '#10b981' }]}>
                      Current: {itineraries.find(i => i.id === viewLead.itinerary_id)?.title}
                      {viewLead.itinerary_option && ` (${OPTION_META[viewLead.itinerary_option]?.label ?? viewLead.itinerary_option})`}
                    </Text>
                  </TouchableOpacity>
                )}
                {viewLead.itinerary_history?.map((h, i) => (
                  <TouchableOpacity key={i} onPress={() => { setViewItinId(h.id); setViewItinOption(h.option ?? null); setIsViewingCurrent(false); }} style={[styles.detailRow, { marginTop: 10 }]}>
                    <Ionicons name="archive-outline" size={14} color="#64748b" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailText}>Previous: {h.title}</Text>
                      {h.option_label && <Text style={{ color: '#64748b', fontSize: 11 }}>Option: {h.option_label}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={[styles.box, { marginTop: 8 }]}>
              <Text style={styles.subHeading}>📞 Call Logs ({callHistory.length})</Text>
              {callHistory.length === 0 ? (
                <Text style={{ color: '#475569', fontSize: 13, marginTop: 10 }}>No calls logged yet.</Text>
              ) : (
                callHistory.map(ch => (
                  <View key={ch.id} style={styles.callLogBtn}>
                    <Ionicons name="call" size={14} color="#64748b" />
                    <View style={{ flex: 1 }}>
                       <Text style={{ color: '#cbd5e1', fontSize: 14 }}>
                        {new Date(ch.called_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={{ color: '#6366f1', fontSize: 11 }}>By {ch.salesperson?.name || 'Unknown'}</Text>
                    </View>
                    <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '700' }}>
                      {Math.floor(ch.duration_seconds / 60)}m {ch.duration_seconds % 60}s
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── View Full Itinerary Modal ────────────────────────────────────── */}
      <Modal visible={!!viewItinId} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{itineraries.find(i => i.id === viewItinId)?.title}</Text>
              <Text style={styles.modalSub}>Itinerary Details</Text>
            </View>
            <TouchableOpacity onPress={() => { setViewItinId(null); setViewItinOption(null); setIsViewingCurrent(false); }} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            {(() => {
              const itin = itineraries.find(i => i.id === viewItinId);
              if (!itin || !itin.pricing_data) return null;
              return (
                <View style={{ gap: 12 }}>
                  {!!itin.description && (
                    <Text style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
                      {itin.description}
                    </Text>
                  )}
                  {(Object.keys(itin.pricing_data) as string[])
                    .filter(k => {
                      const opt = isViewingCurrent ? (viewItinOption || viewLead?.itinerary_option) : viewItinOption;
                      return (opt && opt.trim() !== '') ? k === opt : true;
                    })
                    .map(k => {
                      const data = itin.pricing_data[k] as any;
                      const meta = OPTION_META[k];
                      if (!data || !meta) return null;
                      return (
                        <View key={k} style={{ borderWidth: 1, borderColor: meta.color + '44', borderRadius: 12, padding: 12, backgroundColor: '#0f172a' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 8, marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                              <Text style={{ color: meta.color, fontSize: 13, fontWeight: '700' }}>{meta.label}</Text>
                            </View>
                            {data.price ? (
                              <Text style={{ color: '#10b981', fontSize: 15, fontWeight: '800' }}>₹{data.price.toLocaleString()}</Text>
                            ) : null}
                          </View>
                          {data.inclusions?.length > 0 && (
                            <View style={{ marginBottom: 6 }}>
                              <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>INCLUSIONS</Text>
                              {data.inclusions.map((inc: string, i: number) => (
                                <Text key={`inc-${i}`} style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 1 }}>• {inc}</Text>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                </View>
              );
            })()}
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
  // Lead Details
  modalSub: { color: '#10b981', fontSize: 13, fontWeight: '600', marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  detailText: { color: '#94a3b8', fontSize: 15 },
  box: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10, backgroundColor: '#1e293b22', borderColor: '#334155' },
  subHeading: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginTop: 4 },
  callLogBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#334155' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  searchInput: { flex: 1, color: '#f8fafc', fontSize: 14 },
});
