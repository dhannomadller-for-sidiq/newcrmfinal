import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Linking, Alert, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useSalesLeads, TabType } from '@/hooks/useSalesLeads';
import { Lead, Destination, Itinerary, STATUS_COLORS, OPTION_META } from '@/lib/salesConstants';
import { generatePaymentBill } from '@/utils/billGenerator';
import { AddLeadModal } from './AddLeadModal';
import { EditProfileModal } from './EditProfileModal';
import { BookingDetailModal } from './BookingDetailModal';
import { C, R, S } from '@/lib/theme';

const { width: W } = Dimensions.get('window');

const STATUS_BG: Record<string, string> = {
  New:       C.blueLight,
  Contacted: C.amberLight,
  Converted: C.greenLight,
  Lost:      C.redLight,
  Allocated: C.purpleLight,
};

export function LeadsDashboardBase({
  tabType, title, showAdd = false
}: {
  tabType: TabType; title: string; showAdd?: boolean;
}) {
  const { leads, loading, refresh } = useSalesLeads(tabType);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [itineraries,  setItineraries]  = useState<Itinerary[]>([]);
  const [addModal,     setAddModal]     = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [bookingModal, setBookingModal] = useState(false);
  const [activeLead,   setActiveLead]   = useState<Lead | null>(null);
  const [bookingData,  setBookingData]  = useState<any>(null);
  const [allBookings,  setAllBookings]  = useState<Record<string, any>>({});
  const [generatingBill, setGeneratingBill] = useState(false);

  useEffect(() => {
    async function fetchMeta() {
      const [dest, itin] = await Promise.all([
        supabase.from('destinations').select('id, name').order('name'),
        supabase.from('itineraries').select('id, title, description, important_notes, destination_id, pricing_data').order('title'),
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
    setTimeout(() => { setActiveLead(lead); setProfileModal(true); }, 800);
  };

  const handleWhatsApp = (lead: Lead) => {
    const cleanPhone = lead.contact_no.replace(/[^0-9]/g, '');
    const url = `whatsapp://send?phone=${cleanPhone}`;
    Linking.canOpenURL(url).then(supported => {
      Linking.openURL(supported ? url : `https://wa.me/${cleanPhone}`);
    });
  };

  const openBookingDetails = async (lead: Lead) => {
    setActiveLead(lead);
    const { data, error } = await supabase.from('confirmed_bookings').select('*').eq('lead_id', lead.id).maybeSingle();
    if (error) { Alert.alert('Error', 'Failed to fetch booking data: ' + error.message); return; }
    setBookingData(data);
    setBookingModal(true);
  };

  const handleGenerateBill = async (id: string) => {
    try {
      setGeneratingBill(true);
      await generatePaymentBill(id);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to generate bill: ' + e.message);
    } finally {
      setGeneratingBill(false);
    }
  };

  const shareItineraryWithGuest = async (lead: Lead, booking: any) => {
    const itin = itineraries.find(i => i.id === (booking.itinerary_id || lead.itinerary_id));
    const isBali = lead.destination?.toLowerCase().includes('bali');
    
    // Get inclusions/exclusions for the selected option
    const opt = lead.itinerary_option;
    const pricing = (itin && opt && itin.pricing_data?.[opt]) ? (itin.pricing_data[opt] as any) : null;
    const inclusions = pricing?.inclusions || [];
    const exclusions = pricing?.exclusions || [];
    
    const sep = "━━━━━━━━━━━━━━━━━━";
    
    let message = `*CONFIRMED TRIP MANIFEST – V2.1*\n\n`;
    message += `\uD83C\uDF34 *NOMADLLER PVT LTD – ${(lead.destination || 'TRIP').toUpperCase()}* \uD83C\uDDEE\uD83C\uDDE9\n\n`;
    const optionLabel = lead.itinerary_option ? (OPTION_META[lead.itinerary_option]?.label ?? lead.itinerary_option) : null;
    message += `\u2728 *${itin?.title || 'Professional Travel Itinerary'} ${optionLabel ? `WITH ${optionLabel.toUpperCase()}` : ''}*\n\n`;
    
    message += `\uD83D\uDCB0 *PACKAGE COST:*\n`;
    if (booking.total_amount_usd) {
      const advanceUSD = booking.advance_paid_usd || (booking.advance_paid ? booking.advance_paid / 95 : 0);
      const dueUSD = booking.due_amount_usd || (booking.total_amount_usd - advanceUSD);
      
      message += `• USD ${booking.total_amount_usd.toLocaleString()} per person\n`;
      message += `• Advance Paid: USD ${advanceUSD.toLocaleString()}\n`;
      message += `• Balance Due: USD ${dueUSD.toLocaleString()}\n\n`;
    } else {
      message += `• USD — (Please confirm with travel agent)\n\n`;
    }
    
    message += `\uD83D\uDC65 *Pax:* ${booking.guest_pax || lead.pax_count || '2'} Adults\n`;
    message += `\uD83D\uDCC5 *Travel Dates:* ${booking.travel_start_date || 'As per availability'} to ${booking.travel_end_date || ''}\n\n`;

    message += `${sep}\n\n`;
    message += `\uD83D\uDCCD *ROUTE*\n${lead.destination || 'Scenic Tour'}\n\n`;
    message += `${sep}\n\n`;

    if (itin?.description) {
      const days = itin.description.split('\n\n');
      days.forEach(day => {
        if (day.trim()) {
          message += `${day.trim()}\n\n`;
          message += `${sep}\n\n`;
        }
      });
    }

    // ── Sections ───────────────────────────────────────────
    if (inclusions.length > 0) {
      message += `\`INCLUSIONS:\`\n`;
      inclusions.forEach((item: string) => { message += `• ${item}\n`; });
      message += `\n${sep}\n\n`;
    }
    
    if (exclusions.length > 0) {
      message += `\`EXCLUSIONS:\`\n`;
      exclusions.forEach((item: string) => { message += `• ${item}\n`; });
      message += `\n${sep}\n\n`;
    }

    const allNotes = [];
    if (itin?.important_notes) allNotes.push(itin.important_notes);
    // Bali link always included for confirmed Bali trips
    if (isBali) {
      allNotes.push("Mandatory Electronic Customs Declaration (Arrival Card) required within 72h of arrival: https://allindonesia.imigrasi.go.id/arrival-card-submission/personal-information");
    }

    if (allNotes.length > 0) {
      message += `\`\uD83D\uDCCC IMPORTANT NOTES:\`\n`;
      allNotes.forEach(note => { message += `• ${note}\n`; });
      message += `\n${sep}\n\n`;
    }
    
    message += `*NOMADLLER PVT LTD*\n\u2728 *Explore the Unexplored*`;

    const cleanPhone = lead.contact_no.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;
    
    Linking.openURL(waUrl).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp.');
    });
  };

  // ── Standard lead card — horizontal info bar + action row ─────────────────
  const renderLead = ({ item, index }: { item: Lead; index: number }) => {
    const statusColor = STATUS_COLORS[item.status] || C.primary;
    const statusBg    = STATUS_BG[item.status]    || C.primaryLight;

    return (
      <View style={s.card}>
        {/* Top row: number badge + name + status */}
        <View style={s.cardHead}>
          <View style={[s.numBadge, { backgroundColor: statusBg }]}>
            <Text style={[s.numBadgeText, { color: statusColor }]}>
              {String(index + 1).padStart(2, '0')}
            </Text>
          </View>
          <View style={s.headInfo}>
            <Text style={s.leadName} numberOfLines={1}>{item.name}</Text>
            {item.destination ? (
              <View style={s.row}>
                <Ionicons name="location-outline" size={11} color={C.textMuted} />
                <Text style={s.subText}>{item.destination}</Text>
              </View>
            ) : null}
          </View>
          <View style={[s.statusPill, { backgroundColor: statusBg }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        {/* Contact bar */}
        <View style={s.contactBar}>
          <Ionicons name="call-outline" size={13} color={C.green} />
          <Text style={s.contactNum}>{item.contact_no}</Text>
        </View>

        {/* Action row — pill buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity style={[s.pill, { backgroundColor: C.blue }]} onPress={() => handleCall(item)}>
            <Ionicons name="call" size={13} color="#fff" />
            <Text style={s.pillTxt}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.pill, { backgroundColor: C.green }]} onPress={() => handleWhatsApp(item)}>
            <Ionicons name="logo-whatsapp" size={13} color="#141414" />
            <Text style={[s.pillTxt, { color: '#141414' }]}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.pill, { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }]}
            onPress={() => { setActiveLead(item); setProfileModal(true); }}
          >
            <Ionicons name="create-outline" size={13} color={C.textSecond} />
            <Text style={[s.pillTxt, { color: C.textSecond }]}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getOpsProgress = (leadId: string) => {
    const b = allBookings[leadId];
    if (!b?.checklist) return 0;
    const keys = ['passport','pan','flights','itinerary','inc_exc','hotels','important_info','payment','pdf'];
    return Math.round((keys.filter(k => !!b.checklist[k]).length / keys.length) * 100);
  };

  // ── Booking card — progress bar + detail button ───────────────────────────
  const renderBookingLead = ({ item }: { item: Lead }) => {
    const progress    = getOpsProgress(item.id);
    const isAllocated = item.status === 'Allocated';
    const accent      = isAllocated ? C.purple : C.green;
    const accentBg    = isAllocated ? C.purpleLight : C.greenLight;
    const hasBooking  = !!allBookings[item.id];

    return (
      <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: accent }]}>
        <View style={s.cardHead}>
          <View style={[s.numBadge, { backgroundColor: accentBg }]}>
            <Text style={[s.numBadgeText, { color: accent }]}>{item.name[0]?.toUpperCase()}</Text>
          </View>
          <View style={s.headInfo}>
            <Text style={s.leadName} numberOfLines={1}>{item.name}</Text>
            <View style={s.row}>
              <Ionicons name="map-outline" size={11} color={C.textMuted} />
              <Text style={s.subText}>{item.destination}</Text>
            </View>
          </View>
          <View style={s.bookingActions}>
            <TouchableOpacity
              style={[s.detailBtn, { borderColor: accent + '50' }]}
              onPress={() => openBookingDetails(item)}
            >
              <Text style={[s.detailBtnTxt, { color: accent }]}>Details</Text>
              <Ionicons name="chevron-forward" size={11} color={accent} />
            </TouchableOpacity>

            {hasBooking && (
              <TouchableOpacity
                style={[s.billBtn, { backgroundColor: '#25D36620' }]}
                onPress={() => shareItineraryWithGuest(item, allBookings[item.id])}
              >
                <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.billBtn, generatingBill && { opacity: 0.5 }]}
              onPress={() => handleGenerateBill(item.id)}
              disabled={generatingBill}
            >
              {generatingBill
                ? <ActivityIndicator size="small" color={C.green} />
                : <Ionicons name="receipt-outline" size={15} color={C.green} />
              }
            </TouchableOpacity>
          </View>
        </View>

        {hasBooking && (
          <View style={s.progressBlock}>
            <View style={s.progressHeader}>
              <Text style={s.progressLabel}>OPS PROGRESS</Text>
              <Text style={[s.progressPct, { color: accent }]}>{progress}%</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: accent }]} />
            </View>
          </View>
        )}

        {item.ops_itinerary_edited && (
          <View style={s.warningBar}>
            <Ionicons name="warning-outline" size={13} color={C.amber} />
            <Text style={s.warningTxt}>Itinerary modified by Operations</Text>
          </View>
        )}
      </View>
    );
  };

  // ── Screen header bar (since headerShown=false) ────────────────────────────
  const ListHeader = () => (
    <View style={s.screenHeader}>
      <Text style={s.screenTitle}>{title}</Text>
      <View style={s.screenMeta}>
        <Text style={s.screenCount}>{leads.length}</Text>
        <Text style={s.screenCountLabel}>leads</Text>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={i => i.id}
          renderItem={(tabType === 'confirmed' || tabType === 'allocated') ? renderBookingLead : renderLead}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <View style={s.emptyCircle}>
                <Ionicons name="layers-outline" size={42} color={C.primary} />
              </View>
              <Text style={s.emptyNum}>0</Text>
              <Text style={s.emptyTitle}>No leads yet</Text>
              <Text style={s.emptyHint}>Add your first lead using the + button</Text>
            </View>
          }
        />
      )}

      {showAdd && (
        <TouchableOpacity style={s.fab} onPress={() => setAddModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={30} color="#141414" />
        </TouchableOpacity>
      )}

      <AddLeadModal visible={addModal} onClose={() => setAddModal(false)} onSuccess={refresh} styles={s} />
      <EditProfileModal visible={profileModal} onClose={() => setProfileModal(false)} lead={activeLead} destinations={destinations} itineraries={itineraries} onSuccess={refresh} styles={s} />
      <BookingDetailModal visible={bookingModal} onClose={() => setBookingModal(false)} lead={activeLead} bookingData={bookingData} itineraries={itineraries} destinations={destinations} onSuccess={refresh} styles={s} />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:        { padding: S.lg, paddingBottom: 120, gap: S.sm },

  // Screen header (replaces expo nav header)
  screenHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingBottom: S.lg,
  },
  screenTitle:      { color: C.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  screenMeta:       { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 3 },
  screenCount:      { color: C.primary, fontSize: 22, fontWeight: '900' },
  screenCountLabel: { color: C.textMuted, fontSize: 12, fontWeight: '600' },

  // Lead card
  card: {
    backgroundColor: C.surface,
    borderRadius: R.xl, padding: S.lg, gap: S.md,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  cardHead: { flexDirection: 'row', gap: S.md, alignItems: 'center' },

  // Numbered badge (like reference "09", "06" priority numbers)
  numBadge: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  numBadgeText: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },

  headInfo:  { flex: 1, gap: 3 },
  leadName:  { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subText:   { color: C.textMuted, fontSize: 11 },

  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: R.full, alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '800' },

  // Contact bar
  contactBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface2, borderRadius: R.sm,
    paddingHorizontal: S.md, paddingVertical: 8,
  },
  contactNum: { color: C.green, fontSize: 13, fontWeight: '700', flex: 1 },

  // Pill action buttons
  actionRow: { flexDirection: 'row', gap: S.xs },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: R.full,
  },
  pillTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Booking card extras
  bookingActions: { flexDirection: 'row', gap: S.xs, alignItems: 'center' },
  detailBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: R.sm, borderWidth: 1,
    backgroundColor: C.surface2,
  },
  detailBtnTxt: { fontSize: 12, fontWeight: '800' },
  billBtn: {
    width: 32, height: 32, borderRadius: R.sm,
    backgroundColor: C.greenLight,
    justifyContent: 'center', alignItems: 'center',
  },

  // Progress bar
  progressBlock:  { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:  { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  progressPct:    { fontSize: 10, fontWeight: '800' },
  progressTrack:  { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 3 },

  warningBar: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    backgroundColor: C.amberLight, padding: S.sm, borderRadius: R.xs,
  },
  warningTxt: { color: C.amber, fontSize: 11, fontWeight: '700', flex: 1 },

  // Empty state
  emptyWrap:  { alignItems: 'center', marginTop: 60, gap: S.md },
  emptyCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  emptyNum:   { color: C.primary, fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  emptyTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  emptyHint:  { color: C.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 200 },

  // FAB — coral with dark icon
  fab: {
    position: 'absolute', bottom: 30, right: 24,
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 20, elevation: 14,
  },

  // ── Shared modal styles passed as prop ─────────────────────────────────────
  overlay:     { flex: 1, backgroundColor: '#00000085', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: C.surface, padding: S.xl, paddingBottom: 40,
    borderTopLeftRadius: R.xxxl, borderTopRightRadius: R.xxxl,
  },
  modal:       { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: S.xl, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface,
  },
  modalTitle:  { color: C.textPrimary, fontSize: 22, fontWeight: '900' },
  formContent: { padding: S.xl, gap: S.lg, paddingBottom: 60 },
  fieldGroup:  { gap: S.xs },
  fieldLabel:  { color: C.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },

  input: {
    backgroundColor: C.surface2, color: C.textPrimary,
    borderRadius: R.sm, padding: S.md, fontSize: 15,
    borderWidth: 1.5, borderColor: C.border,
  },

  // Booking modal shared styles
  bookSection:   { gap: S.lg },
  bookHeader:    { alignItems: 'center', gap: 4, marginBottom: S.xs },
  bookBadge:     { backgroundColor: C.primaryLight, color: C.primary, fontSize: 10, fontWeight: '800', paddingHorizontal: S.xs, paddingVertical: 2, borderRadius: 4 },
  bookMainTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  bookSubTitle:  { color: C.textMuted, fontSize: 14, textAlign: 'center' },
  bookCard:      { backgroundColor: C.surface2, borderRadius: R.xl, padding: S.lg, gap: S.lg, borderWidth: 1, borderColor: C.border },
  bookGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: S.lg },
  bookGridItem:  { flex: 1, minWidth: '40%' },
  bookGridLabel: { color: C.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  bookGridValue: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  bookRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  bookLabel:     { color: C.textSecond, fontSize: 14, fontWeight: '600' },
  bookValue:     { color: C.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'right', flex: 1 },

  saveBtn: {
    backgroundColor: C.primary, borderRadius: R.full, paddingVertical: 18,
    alignItems: 'center', marginTop: S.xs,
    flexDirection: 'row', justifyContent: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 10,
  },
  saveBtnText: { color: '#141414', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },

  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.surface2, borderRadius: R.sm, padding: S.md,
    borderWidth: 1.5, borderColor: C.border,
  },
  dateBtnText: { color: C.textSecond, fontSize: 15 },

  chipRow:       { flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' },
  chip:          { borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.sm, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  chipActive:    { backgroundColor: C.primaryLight, borderColor: C.primary },
  chipText:      { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.primary, fontWeight: '800' },

  pickerTitle:    { color: C.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: S.sm },
  pickerItem:     { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 13, paddingHorizontal: S.sm, borderRadius: R.sm },
  pickerItemText: { flex: 1, color: C.textSecond, fontSize: 15 },
});
