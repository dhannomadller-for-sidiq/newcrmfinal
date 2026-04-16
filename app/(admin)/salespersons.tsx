import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { STATUS_COLORS, FOLLOWUP_STATUSES, FUP_COLORS, FUP_LABELS, OPTION_META } from '@/lib/salesConstants';

type TeamMember = { 
  id: string; 
  name: string | null; 
  designation: string | null; 
  phone: string | null; 
  username: string | null; 
  role: 'sale' | 'operations' | 'finance' 
};
type CallStat = { total: number; totalDuration: number; today: number };

type Lead = {
  id: string;
  name: string;
  contact_no: string;
  destination: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  followup_status: string | null;
  itinerary_id: string | null;
  itinerary_option: string | null;
  itinerary_history: any[] | null;
  call_remarks: string | null;
};

type Itinerary = { id: string; title: string; pricing_data: any; description?: string };

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  sale: { label: 'Sales', color: '#6366f1', icon: 'trending-up' },
  operations: { label: 'Operations', color: '#10b981', icon: 'construct' },
  finance: { label: 'Finance', color: '#f59e0b', icon: 'cash' },
};

export default function SalespersonsScreen() {
  const [people, setPeople] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [callStats, setCallStats] = useState<Record<string, CallStat>>({});

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [password, setPassword] = useState('');
  const [fRole, setFRole] = useState<'sale' | 'operations' | 'finance'>('sale');
  const [saving, setSaving] = useState(false);

  // Salesperson Drill-down
  const [personModal, setPersonModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<TeamMember | null>(null);
  const [personLeads, setPersonLeads] = useState<Lead[]>([]);
  const [fetchingLeads, setFetchingLeads] = useState(false);

  // Lead Detail (Reused pattern)
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [detailModal, setDetailModal] = useState(false);
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [viewItinId, setViewItinId] = useState<string | null>(null);
  const [viewItinOption, setViewItinOption] = useState<string | null>(null);
  const [isViewingCurrent, setIsViewingCurrent] = useState(false);

  useEffect(() => { 
    fetchPeople(); 
    fetchCallStats(); 
    fetchItineraries();
  }, []);

  async function fetchItineraries() {
    const { data } = await supabase.from('itineraries').select('*');
    setItineraries(data ?? []);
  }

  async function fetchPeople() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').in('role', ['sale', 'operations', 'finance']);
    setPeople(data ?? []);
    setLoading(false);
  }

  async function fetchCallStats() {
    const { data } = await supabase
      .from('call_logs')
      .select('salesperson_id, duration_seconds, called_at');
    if (!data) return;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const map: Record<string, CallStat> = {};
    data.forEach(row => {
      const id = row.salesperson_id;
      if (!map[id]) map[id] = { total: 0, totalDuration: 0, today: 0 };
      map[id].total++;
      map[id].totalDuration += row.duration_seconds ?? 0;
      if (new Date(row.called_at) >= todayStart) map[id].today++;
    });
    setCallStats(map);
  }

  async function handleCreate() {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Name, email and password are required.');
      return;
    }
    setSaving(true);
    // Sign up new user with Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: undefined,
      },
    });

    if (signUpError || !signUpData.user) {
      setSaving(false);
      Alert.alert('Error', signUpError?.message ?? 'Failed to create user');
      return;
    }

    // Insert profile row
    const { error: profileError } = await supabase.from('profiles').insert({
      id: signUpData.user.id,
      role: fRole,
      name,
      phone,
      designation,
      username: email.split('@')[0],
    });
    setSaving(false);

    if (profileError) { Alert.alert('Error', profileError.message); return; }
    setModalVisible(false);
    resetForm();
    fetchPeople();
    Alert.alert('Success', `${name} has been added to the ${ROLE_CONFIG[fRole].label} Team.`);
  }

  async function openPersonDetails(person: TeamMember) {
    setSelectedPerson(person);
    setPersonModal(true);
    setFetchingLeads(true);
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', person.id)
      .order('created_at', { ascending: false });
    setPersonLeads(data ?? []);
    setFetchingLeads(false);
  }

  async function openLeadDetail(lead: Lead) {
    setViewLead(lead);
    setDetailModal(true);
    const { data } = await supabase
      .from('call_logs')
      .select('*, salesperson:profiles(name)')
      .eq('lead_id', lead.id)
      .order('called_at', { ascending: false });
    setCallHistory(data ?? []);
  }

  function resetForm() {
    setName(''); setEmail(''); setPhone(''); setDesignation(''); setPassword(''); setFRole('sale');
  }

  const renderPerson = ({ item }: { item: TeamMember }) => {
    const stat = callStats[item.id];
    let durationText = '0m';
    if (stat) {
      const h = Math.floor(stat.totalDuration / 3600);
      const m = Math.floor((stat.totalDuration % 3600) / 60);
      durationText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    const role = ROLE_CONFIG[item.role] || ROLE_CONFIG.sale;

    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => openPersonDetails(item)} style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: role.color }]}>
          <Text style={styles.avatarText}>{(item.name ?? '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.personName}>{item.name ?? '—'}</Text>
            <View style={[styles.roleBadge, { backgroundColor: role.color + '22', borderColor: role.color }]}>
              <Ionicons name={role.icon as any} size={10} color={role.color} />
              <Text style={[styles.roleText, { color: role.color }]}>{role.label.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={[styles.personSub, { color: role.color }]}>{item.designation || (role.label + ' Executive')}</Text>
          {item.phone && (
            <View style={styles.row}>
              <Ionicons name="call-outline" size={13} color="#94a3b8" />
              <Text style={styles.meta}>{item.phone}</Text>
            </View>
          )}
          {item.role === 'sale' && (
            <View style={styles.statRow}>
              <View style={styles.statBadge}>
                <Ionicons name="call-outline" size={12} color="#6366f1" />
                <Text style={styles.statText}>{stat?.total ?? 0} calls</Text>
              </View>
              <View style={styles.statBadge}>
                <Ionicons name="time-outline" size={12} color="#f59e0b" />
                <Text style={styles.statText}>{durationText} total</Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: '#10b98122' }]}>
                <Ionicons name="today-outline" size={12} color="#10b981" />
                <Text style={[styles.statText, { color: '#10b981' }]}>{stat?.today ?? 0} today</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(i) => i.id}
          renderItem={renderPerson}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No team members found.</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setModalVisible(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Team Member</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Field label="Full Name *" value={name} onChangeText={setName} placeholder="Jane Smith" />
            
            <Text style={styles.fieldLabel}>Role *</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                <TouchableOpacity 
                  key={key} 
                  style={[styles.roleChip, fRole === key && { backgroundColor: config.color, borderColor: config.color }]}
                  onPress={() => setFRole(key as any)}
                >
                  <Ionicons name={config.icon as any} size={14} color={fRole === key ? '#fff' : config.color} />
                  <Text style={[styles.roleChipText, fRole === key && { color: '#fff' }]}>{config.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field label="Email *" value={email} onChangeText={setEmail} placeholder="jane@nomadller.com" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password *" value={password} onChangeText={setPassword} placeholder="Min 6 chars" secureTextEntry />
            <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
            <Field label="Designation" value={designation} onChangeText={setDesignation} placeholder="e.g. Senior Operations" />
            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add to Team</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Salesperson Leads Modal ─────────────────────────────────────── */}
      <Modal visible={personModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{selectedPerson?.name}</Text>
              <Text style={styles.modalSub}>Assigned Leads ({personLeads.length})</Text>
            </View>
            <TouchableOpacity onPress={() => setPersonModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            {fetchingLeads ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />
            ) : personLeads.length === 0 ? (
              <Text style={styles.empty}>No leads assigned to this person yet.</Text>
            ) : (
              personLeads.map(lead => (
                <TouchableOpacity key={lead.id} style={styles.leadItemCard} onPress={() => openLeadDetail(lead)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leadItemName}>{lead.name}</Text>
                    <Text style={styles.leadItemMeta}>{lead.contact_no} • {lead.destination}</Text>
                  </View>
                  <View style={[styles.statusBadgeSmall, { backgroundColor: (STATUS_COLORS[lead.status] ?? '#6366f1') + '22' }]}>
                    <Text style={[styles.statusTextSmall, { color: STATUS_COLORS[lead.status] ?? '#6366f1' }]}>{lead.status}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#475569" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Lead Details Modal (Reused) ──────────────────────────────────── */}
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
                <Ionicons name={FOLLOWUP_STATUSES.find(f => f.key === viewLead.followup_status)?.icon as any ?? 'flag-outline'} size={16} color={FUP_COLORS[viewLead.followup_status] ?? '#6366f1'} />
                <Text style={[styles.detailText, { color: FUP_COLORS[viewLead.followup_status] ?? '#6366f1', fontWeight: '700' }]}>
                  {FUP_LABELS[viewLead.followup_status] ?? viewLead.followup_status}
                </Text>
              </View>
            )}
            {viewLead?.call_remarks && (
              <View style={styles.box}>
                <Text style={styles.subHeading}>💬 Call Remarks History</Text>
                <Text style={{ color: '#cbd5e1', fontSize: 13, fontStyle: 'italic', marginTop: 4 }}>{viewLead.call_remarks}</Text>
              </View>
            )}
            <View style={[styles.box, { marginTop: 8 }]}>
              <Text style={styles.subHeading}>📞 Call Logs ({callHistory.length})</Text>
              {callHistory.map(ch => (
                 <View key={ch.id} style={styles.callLogBtn}>
                   <Ionicons name="call" size={14} color="#64748b" />
                   <View style={{ flex: 1 }}>
                      <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                       {new Date(ch.called_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                     </Text>
                     <Text style={{ color: '#6366f1', fontSize: 10 }}>By {ch.salesperson?.name || 'Unknown'}</Text>
                   </View>
                   <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '700' }}>
                     {Math.floor(ch.duration_seconds / 60)}m {ch.duration_seconds % 60}s
                   </Text>
                 </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', autoCapitalize = 'sentences', secureTextEntry = false }: any) {
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
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

const S = StyleSheet;
const styles = S.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  info: { flex: 1, gap: 3 },
  personName: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  personSub: { color: '#6366f1', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { color: '#94a3b8', fontSize: 13 },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  modal: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modalTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  formContent: { padding: 20, gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6366f122', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  roleText: { fontSize: 9, fontWeight: '900' },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b' },
  roleChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  // Drill-down styles
  modalSub: { color: '#10b981', fontSize: 13, fontWeight: '600', marginTop: 2 },
  leadItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: '#334155' },
  leadItemName: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  leadItemMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  statusBadgeSmall: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusTextSmall: { fontSize: 10, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  detailText: { color: '#94a3b8', fontSize: 15 },
  box: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10, backgroundColor: '#1e293b22', borderColor: '#334155' },
  subHeading: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginTop: 4 },
  callLogBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#334155' },
});
