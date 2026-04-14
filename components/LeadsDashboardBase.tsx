import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useSalesLeads, TabType } from '@/hooks/useSalesLeads';
import { Lead, Destination, Itinerary, STATUS_COLORS } from '@/lib/salesConstants';
import { AddLeadModal } from './AddLeadModal';
import { EditProfileModal } from './EditProfileModal';
import { BookingDetailModal } from './BookingDetailModal';

export function LeadsDashboardBase({ 
  tabType, 
  title,
  showAdd = false 
}: { 
  tabType: TabType; 
  title: string;
  showAdd?: boolean;
}) {
  const { leads, loading, refresh } = useSalesLeads(tabType);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  
  // Modal states
  const [addModal, setAddModal] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [bookingModal, setBookingModal] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [bookingData, setBookingData] = useState<any>(null);
  const [allBookings, setAllBookings] = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchMeta() {
      const [dest, itin] = await Promise.all([
        supabase.from('destinations').select('id, name').order('name'),
        supabase.from('itineraries').select('id, title, description, destination_id, pricing_data').order('title'),
      ]);
      setDestinations(dest.data ?? []);
      setItineraries(itin.data ?? []);

      if (leads.length > 0) {
        const { data: bData } = await supabase.from('confirmed_bookings').select('*').in('lead_id', leads.map(l => l.id));
        const bMap: Record<string, any> = {};
        bData?.forEach(b => { bMap[b.lead_id] = b; });
        setAllBookings(bMap);
      }
    }
    fetchMeta();
  }, [leads]);

  const handleCall = (lead: Lead) => {
    Linking.openURL(`tel:${lead.contact_no}`).catch(() => {});
    setTimeout(() => {
      setActiveLead(lead);
      setProfileModal(true);
    }, 800);
  };

  const handleWhatsApp = (lead: Lead) => {
    const cleanPhone = lead.contact_no.replace(/[^0-9]/g, '');
    const url = `whatsapp://send?phone=${cleanPhone}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        return Linking.openURL(url);
      } else {
        return Linking.openURL(`https://wa.me/${cleanPhone}`);
      }
    });
  };

  const openBookingDetails = async (lead: Lead) => {
    setActiveLead(lead);
    const { data, error } = await supabase
      .from('confirmed_bookings')
      .select('*')
      .eq('lead_id', lead.id)
      .single();
    
    if (error) {
      Alert.alert('Error', 'Booking data not found.');
      return;
    }
    setBookingData(data);
    setBookingModal(true);
  };

  const renderLead = ({ item }: { item: Lead }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={s.cardInfo}>
          <Text style={s.leadName}>{item.name}</Text>
          <View style={s.row}><Ionicons name="call" size={13} color="#10b981" /><Text style={s.contactText}>{item.contact_no}</Text></View>
          <View style={s.statusBadge}>
            <Text style={[s.statusText, { color: STATUS_COLORS[item.status] || '#10b981' }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[item.status] ?? '#6366f1' }]} />
      </View>
      <View style={s.actionRow}>
        <TouchableOpacity style={[s.actionBtn, s.callBtn]} onPress={() => handleCall(item)}>
          <Ionicons name="call" size={16} color="#fff" /><Text style={s.actionBtnText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.whatsappBtn]} onPress={() => handleWhatsApp(item)}>
          <Ionicons name="logo-whatsapp" size={16} color="#fff" /><Text style={s.actionBtnText}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.editBtn]} onPress={() => { setActiveLead(item); setProfileModal(true); }}>
          <Ionicons name="pencil-outline" size={16} color="#fff" /><Text style={s.actionBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getOpsProgress = (leadId: string) => {
    const b = allBookings[leadId];
    if (!b || !b.checklist) return 0;
    const opsSteps = ['passport', 'pan', 'flights', 'itinerary', 'inc_exc', 'hotels', 'important_info', 'payment', 'pdf'];
    const done = opsSteps.filter(key => !!b.checklist?.[key]).length;
    return Math.round((done / opsSteps.length) * 100);
  };

  const renderBookingLead = ({ item }: { item: Lead }) => {
    const progress = getOpsProgress(item.id);
    const hasBooking = !!allBookings[item.id];

    return (
      <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: item.status === 'Allocated' ? '#8b5cf6' : '#10b981' }]}>
        <View style={s.cardTop}>
          <View style={[s.avatar, { backgroundColor: item.status === 'Allocated' ? '#8b5cf622' : '#10b98122' }]}>
            <Text style={[s.avatarText, { color: item.status === 'Allocated' ? '#8b5cf6' : '#10b981' }]}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={s.cardInfo}>
            <Text style={s.leadName}>{item.name}</Text>
            <View style={s.row}><Ionicons name="map" size={13} color="#64748b" /><Text style={s.meta}>{item.destination}</Text></View>
            <View style={[s.statusBadge, { backgroundColor: item.status === 'Allocated' ? '#8b5cf615' : '#10b98115' }]}>
              <Text style={[s.statusText, { color: item.status === 'Allocated' ? '#8b5cf6' : '#10b981' }]}>
                {item.status === 'Allocated' ? 'ALLOCATED' : 'CONFIRMED'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.viewDetailsBtn} onPress={() => openBookingDetails(item)}>
            <Text style={s.viewDetailsBtnText}>Details</Text>
            <Ionicons name="chevron-forward" size={14} color="#818cf8" />
          </TouchableOpacity>
        </View>
        
        {/* Operations Progress Bar */}
        {hasBooking && (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800' }}>OPERATIONS PROGRESS</Text>
              <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>{progress}%</Text>
            </View>
            <View style={{ height: 4, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ height: '100%', backgroundColor: '#10b981', width: `${progress}%` }} />
            </View>
          </View>
        )}

        {/* Itinerary Modified Alert */}
        {item.ops_itinerary_edited && (
          <View style={{ marginTop: 10, backgroundColor: '#ef444415', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ef444433' }}>
            <Ionicons name="warning" size={16} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Itinerary modified by Operations!</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{title}</Text>
        <Ionicons name="notifications-outline" size={24} color="#94a3b8" />
      </View>

      {loading ? <ActivityIndicator color="#10b981" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={leads}
          keyExtractor={i => i.id}
          renderItem={(tabType === 'confirmed' || tabType === 'allocated') ? renderBookingLead : renderLead}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <View style={s.emptyGlow}><Ionicons name="layers-outline" size={48} color="#10b981" /></View>
              <Text style={s.emptyText}>No leads found in this category.</Text>
            </View>
          }
        />
      )}

      {showAdd && (
        <TouchableOpacity style={s.fab} onPress={() => setAddModal(true)}>
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      <AddLeadModal visible={addModal} onClose={() => setAddModal(false)} onSuccess={refresh} styles={s} />
      <EditProfileModal visible={profileModal} onClose={() => setProfileModal(false)} lead={activeLead} destinations={destinations} itineraries={itineraries} onSuccess={refresh} styles={s} />
      <BookingDetailModal visible={bookingModal} onClose={() => setBookingModal(false)} lead={activeLead} bookingData={bookingData} itineraries={itineraries} onSuccess={refresh} styles={s} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070a13' },
  header: { padding: 20, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  list: { paddingHorizontal: 16, paddingBottom: 120, gap: 16 },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1e293b', gap: 14 },
  cardTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  cardInfo: { flex: 1, gap: 4 },
  leadName: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#1e293b', marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { color: '#10b981', fontSize: 13, fontWeight: '700' },
  meta: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  statusDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#070a13' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  callBtn: { backgroundColor: '#2563eb' },
  whatsappBtn: { backgroundColor: '#22c55e' },
  editBtn: { backgroundColor: '#334155' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  viewDetailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366f115', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#6366f133' },
  viewDetailsBtnText: { color: '#818cf8', fontSize: 13, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 20 },
  emptyGlow: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#10b98111', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#475569', fontSize: 15, fontWeight: '600', textAlign: 'center', maxWidth: 220 },
  fab: { position: 'absolute', bottom: 30, right: 24, width: 64, height: 64, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#1e293b', padding: 20, paddingBottom: 40 },
  modal: { flex: 1, backgroundColor: '#070a13' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  modalTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '900' },
  formContent: { padding: 20, gap: 18, paddingBottom: 60 },
  fieldGroup: { gap: 8 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  input: { backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: 14, padding: 16, fontSize: 15, borderWidth: 1, borderColor: '#1e293b' },
  bookSection: { gap: 16 },
  bookHeader: { alignItems: 'center', gap: 4, marginBottom: 8 },
  bookBadge: { backgroundColor: '#6366f122', color: '#6366f1', fontSize: 10, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  bookMainTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  bookSubTitle: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  bookCard: { backgroundColor: '#0f172a', borderRadius: 20, padding: 20, gap: 16, borderWidth: 1, borderColor: '#1e293b' },
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  bookGridItem: { flex: 1, minWidth: '40%' },
  bookGridLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  bookGridValue: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  bookRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  bookLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  bookValue: { color: '#f8fafc', fontSize: 14, fontWeight: '700', textAlign: 'right', flex: 1 },
  saveBtn: { backgroundColor: '#10b981', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  dateBtnText: { color: '#475569', fontSize: 15 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  pickerTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10 },
  pickerItemText: { flex: 1, color: '#cbd5e1', fontSize: 15 },
});
