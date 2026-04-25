import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { STATUS_COLORS, FOLLOWUP_STATUSES, FUP_COLORS, FUP_LABELS, OPTION_META } from '@/lib/salesConstants';
import { C, R, S as Sp } from '@/lib/theme';

type TeamMember = { 
  id: string; 
  name: string | null; 
  designation: string | null; 
  phone: string | null; 
  username: string | null; 
  role: 'sale' | 'operations' | 'finance';
  status: 'active' | 'suspended' | 'deleted';
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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['sale', 'operations', 'finance'])
      .neq('status', 'deleted');
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
      let msg = signUpError?.message || 'Failed to create user';
      if (msg.includes('already registered')) {
        msg = 'This email is already registered in Supabase Auth. Please delete the old user from the Supabase Dashboard before re-adding them.';
      }
      Alert.alert('Auth Error', msg);
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
    console.log('openPersonDetails (Managing & Managed) for:', person.id, person.name);
    setSelectedPerson(person);
    setPersonModal(true);
    setFetchingLeads(true);
    try {
      // 1. Fetch leads where they are directly assigned or added by them
      const { data: directLeads, error: directError } = await supabase
        .from('leads')
        .select('*')
        .or(`assigned_to.eq.${person.id},added_by.eq.${person.id}`)
        .order('created_at', { ascending: false });

      if (directError) console.error('Error fetching direct leads:', directError);

      // 2. Fetch unique lead IDs from call logs
      const { data: logs, error: logsError } = await supabase
        .from('call_logs')
        .select('lead_id')
        .eq('salesperson_id', person.id);
      
      if (logsError) console.error('Error fetching logs lead IDs:', logsError);

      let allLeads = [...(directLeads ?? [])];
      
      const logLeadIds = Array.from(new Set((logs ?? []).map(l => l.lead_id).filter(id => !!id)));
      
      // 3. Find IDs that we haven't already fetched
      const missingIds = logLeadIds.filter(id => !allLeads.some(al => al.id === id));
      
      if (missingIds.length > 0) {
        const { data: logLeads, error: logLeadsError } = await supabase
          .from('leads')
          .select('*')
          .in('id', missingIds);
        
        if (logLeadsError) console.error('Error fetching log leads:', logLeadsError);
        if (logLeads) allLeads = [...allLeads, ...logLeads];
      }

      // Sort by created_at (most recent first)
      allLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('Fetched total managed/managing leads:', allLeads.length);
      setPersonLeads(allLeads);
    } catch (err: any) {
      console.error('Catch error in openPersonDetails:', err);
      Alert.alert('Error', err.message || 'Failed to fetch leads');
    }
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

  const showAlert = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', style: 'destructive', onPress: onConfirm }
      ]);
    }
  };

  async function handleRedistributeAndRemove(personId: string, newStatus: 'suspended' | 'deleted') {
    setSaving(true);
    try {
      // 1. Find all leads for this person
      const { data: leadsToMove } = await supabase
        .from('leads')
        .select('id')
        .eq('assigned_to', personId);

      // 2. Find other active salespersons
      const { data: others } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'sale')
        .eq('status', 'active')
        .neq('id', personId);

      if (leadsToMove && leadsToMove.length > 0 && others && others.length > 0) {
        Alert.alert(
          'Redistributing Leads',
          `Moving ${leadsToMove.length} leads to ${others.length} other team members...`
        );

        // Equally distribute
        for (let i = 0; i < leadsToMove.length; i++) {
          const targetSalesman = others[i % others.length];
          await supabase
            .from('leads')
            .update({ assigned_to: targetSalesman.id })
            .eq('id', leadsToMove[i].id);
        }
      }

      // 3. Update profile status
      await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', personId);

      Alert.alert('Success', `Person ${newStatus === 'suspended' ? 'suspended' : 'deleted'} and leads redistributed.`);
      setPersonModal(false);
      fetchPeople();
    } catch (err: any) {
      console.error("Redistribution error:", err);
      Alert.alert('Error', err.message);
    }
    setSaving(false);
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
              {item.status === 'suspended' && (
                <View style={{ backgroundColor: '#ef444422', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                  <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '800' }}>SUSPENDED</Text>
                </View>
              )}
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
              <Text style={styles.modalSub}>Managed Leads ({personLeads.length})</Text>
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

            {selectedPerson && selectedPerson.status !== 'deleted' && (
              <View style={{ marginTop: 30, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 20, gap: 10 }}>
                <Text style={[styles.subHeading, { color: '#94a3b8' }]}>DANGER ZONE</Text>
                
                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: selectedPerson.status === 'suspended' ? C.green : '#f59e0b', marginTop: 0 }]}
                  onPress={() => {
                    console.log("Suspend button pressed for:", selectedPerson.id);
                    if (selectedPerson.status === 'suspended') {
                      supabase.from('profiles').update({ status: 'active' }).eq('id', selectedPerson.id).then(() => fetchPeople());
                      setPersonModal(false);
                    } else {
                      showAlert(
                        'Suspend User?', 
                        'Leads will be equally redistributed to others. Continue?',
                        () => handleRedistributeAndRemove(selectedPerson.id, 'suspended')
                      );
                    }
                  }}
                >
                  <Text style={styles.saveBtnText}>
                    {selectedPerson.status === 'suspended' ? 'Re-Activate User' : 'Suspend & Redistribute Leads'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: '#ef4444', marginTop: 10 }]}
                  onPress={() => {
                    console.log("Delete button pressed for:", selectedPerson.id);
                    showAlert(
                      'Delete User?', 
                      'This can ONLY be undone by an admin. Leads will be redistributed. Continue?',
                      () => handleRedistributeAndRemove(selectedPerson.id, 'deleted')
                    );
                  }}
                >
                  <Text style={styles.saveBtnText}>Delete & Redistribute Leads</Text>
                </TouchableOpacity>
              </View>
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

      {/* ── View Full Itinerary Modal (Reused) ───────────────────────────── */}
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
                        <View key={k} style={{ borderWidth: 1, borderColor: meta.color + '33', borderRadius: R.md, padding: 12, backgroundColor: C.surface2 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 8, marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                              <Text style={{ color: meta.color, fontSize: 13, fontWeight: '700' }}>{meta.label}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              {data.price ? (
                                <Text style={{ color: '#10b981', fontSize: 15, fontWeight: '800' }}>₹{data.price.toLocaleString()}</Text>
                              ) : null}
                              {data.price_usd ? (
                                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 1 }}>${data.price_usd}</Text>
                              ) : null}
                            </View>
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

const ST = StyleSheet;
const styles = ST.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  info: { flex: 1, gap: 3 },
  personName: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  personSub: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { color: C.textMuted, fontSize: 13 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 60, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  formContent: { padding: 20, gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: C.textSecond, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.surface2, color: C.textPrimary, borderRadius: R.sm, padding: 14, fontSize: 15, borderWidth: 1.5, borderColor: C.border },
  saveBtn: { backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', marginTop: 8, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryLight, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statText: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  roleText: { fontSize: 9, fontWeight: '900' },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2 },
  roleChipText: { color: C.textMuted, fontSize: 13, fontWeight: '700' },
  modalSub: { color: C.green, fontSize: 13, fontWeight: '600', marginTop: 2 },
  leadItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: R.sm, padding: 14, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: C.border },
  leadItemName: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  leadItemMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  statusBadgeSmall: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusTextSmall: { fontSize: 10, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  detailText: { color: C.textSecond, fontSize: 15 },
  box: { borderWidth: 1, borderRadius: R.lg, padding: 14, gap: 10, backgroundColor: C.surface, borderColor: C.border },
  subHeading: { color: C.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 4 },
  callLogBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: C.border },
});
