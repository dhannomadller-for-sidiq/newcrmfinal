import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Linking, Alert, Modal, ScrollView, TextInput, AppState, AppStateStatus, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';

const NativeDTP = Platform.OS !== 'web'
  ? require('@react-native-community/datetimepicker').default : null;

// ─── Types ────────────────────────────────────────────────────────────────────
type Lead = {
  id: string; name: string; contact_no: string; destination: string;
  status: string; followup_status: string | null; next_followup_at: string | null;
  call_remarks: string | null; itinerary_id: string | null; itinerary_option: string | null;
  itinerary_history: Array<{ id: string; title: string; option?: string | null; option_label?: string | null }>;
};
type Itinerary = { id: string; title: string; destination_id: string; pricing_data: Record<string, unknown>; description?: string };

const OPTION_META: Record<string, { label: string; icon: string; color: string }> = {
  car:  { label: 'Self-Drive Car',  icon: 'car',     color: '#6366f1' },
  bike: { label: 'Self-Drive Bike', icon: 'bicycle', color: '#f59e0b' },
  cab:  { label: 'Cab Service',     icon: 'bus',     color: '#10b981' },
};

const FOLLOWUP_STATUSES = [
  { key: 'itinerary_sent',     label: '1. Itinerary Sent',           icon: 'send-outline',             color: '#6366f1' },
  { key: 'itinerary_updated',  label: '2. Itinerary Updated',        icon: 'refresh-outline',          color: '#f59e0b' },
  { key: 'followup',           label: '3. Follow-up',                icon: 'chatbubble-outline',       color: '#10b981' },
  { key: 'different_location', label: '4. Different Location',       icon: 'location-outline',         color: '#8b5cf6' },
  { key: 'advance_paid',       label: '5. Advance Paid & Confirmed', icon: 'checkmark-circle-outline', color: '#10b981' },
  { key: 'dead',               label: '6. Dead Lead',                icon: 'skull-outline',             color: '#ef4444' },
];
const FUP_COLORS: Record<string, string> = {
  itinerary_sent: '#6366f1', itinerary_updated: '#f59e0b', followup: '#10b981',
  different_location: '#8b5cf6', advance_paid: '#10b981', dead: '#ef4444',
};
const FUP_LABELS: Record<string, string> = {
  itinerary_sent: 'Itinerary Sent', itinerary_updated: 'Itinerary Updated',
  followup: 'Follow-up', different_location: 'Diff. Location',
  advance_paid: 'Advance Paid', dead: 'Dead Lead',
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function FollowupsScreen() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);

  // ── Call tracking ──────────────────────────────────────────────────────────
  const callStartRef = useRef<number | null>(null);
  const callLeadRef = useRef<Lead | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // ── Update modal state ─────────────────────────────────────────────────────
  const [updateModal, setUpdateModal] = useState(false);
  const [updateLead, setUpdateLead] = useState<Lead | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [fStatus, setFStatus] = useState('');
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [fNextDate, setFNextDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fNextTime, setFNextTime] = useState('');
  const [fRemarks, setFRemarks] = useState('');
  const [fNewItinId, setFNewItinId] = useState('');
  const [fNewItinOption, setFNewItinOption] = useState('');
  const [itinFilter, setItinFilter] = useState('');
  const [fDiffDestination, setFDiffDestination] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Details modal state ────────────────────────────────────────────────────
  const [detailModal, setDetailModal] = useState(false);
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [viewItinId, setViewItinId] = useState<string | null>(null);
  const [viewItinOption, setViewItinOption] = useState<string | null>(null);
  const [isViewingCurrent, setIsViewingCurrent] = useState(false);
  const [callHistory, setCallHistory] = useState<Array<{ id: string; called_at: string; duration_seconds: number }>>([]);

  // ── Advance paid fields ──────────────────────────────────────────────────
  const [fTotal, setFTotal] = useState('');
  const [fAdvance, setFAdvance] = useState('');
  const [fPassportNo, setFPassportNo] = useState('');
  const [fPassportName, setFPassportName] = useState('');
  const [fArrPNR, setFArrPNR] = useState('');
  const [fArrFlight, setFArrFlight] = useState('');
  const [fArrDepPlace, setFArrDepPlace] = useState('Cochin Airport');
  const [fArrDepDate, setFArrDepDate] = useState('');
  const [fArrDepTime, setFArrDepTime] = useState('');
  const [fArrArrAirport, setFArrArrAirport] = useState('Denpasar Airport');
  const [fArrArrDate, setFArrArrDate] = useState('');
  const [fArrArrTime, setFArrArrTime] = useState('');
  const [fDepPNR, setFDepPNR] = useState('');
  const [fDepFlight, setFDepFlight] = useState('');
  const [fDepDepPlace, setFDepDepPlace] = useState('Denpasar Airport');
  const [fDepDepDate, setFDepDepDate] = useState('');
  const [fDepDepTime, setFDepDepTime] = useState('');
  const [fDepArrAirport, setFDepArrAirport] = useState('Cochin Airport');
  const [fDepArrDate, setFDepArrDate] = useState('');
  const [fDepArrTime, setFDepArrTime] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchFollowups = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('id, name, contact_no, destination, status, followup_status, next_followup_at, call_remarks, itinerary_id, itinerary_option, itinerary_history')
      .not('next_followup_at', 'is', null)
      .or(`assigned_to.eq.${profile.id},added_by.eq.${profile.id}`)
      .not('status', 'in', '("Lost","Converted")')
      .order('next_followup_at', { ascending: true });
    setLeads(data ?? []);
    setLoading(false);
  }, [profile]);

  const fetchItineraries = useCallback(async () => {
    const { data } = await supabase.from('itineraries').select('id, title, description, destination_id, pricing_data').order('title');
    setItineraries(data ?? []);
  }, []);

  useEffect(() => { fetchFollowups(); fetchItineraries(); }, [fetchFollowups, fetchItineraries]);

  // Sync viewLead if leads list updates (prevents stale data in modal)
  useEffect(() => {
    if (viewLead && leads.length > 0) {
      const updated = leads.find(l => l.id === viewLead.id);
      if (updated) setViewLead(updated);
    }
  }, [leads]);

  // ── AppState — detect when call ends ──────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        if (callLeadRef.current && callStartRef.current) {
          const duration = Math.round((Date.now() - callStartRef.current) / 1000);
          const lead = callLeadRef.current;
          callStartRef.current = null;
          callLeadRef.current = null;
          saveCallLog(lead, duration);
          openUpdateModal(lead, duration);
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [profile]);

  async function saveCallLog(lead: Lead, duration: number) {
    if (!profile) return;
    await supabase.from('call_logs').insert({
      lead_id: lead.id,
      salesperson_id: profile.id,
      duration_seconds: duration,
    });
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleCall(lead: Lead) {
    callStartRef.current = Date.now();
    callLeadRef.current = lead;
    Linking.openURL(`tel:${lead.contact_no}`).catch(() =>
      Alert.alert('Error', 'Could not initiate call.'));
  }

  function handleWhatsApp(lead: Lead) {
    const n = lead.contact_no.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${n}`).catch(() =>
      Alert.alert('WhatsApp not installed'));
  }

  async function openDetailModal(lead: Lead) {
    setViewLead(lead);
    setDetailModal(true);
    const { data } = await supabase.from('call_logs').select('id, called_at, duration_seconds').eq('lead_id', lead.id).order('called_at', { ascending: false });
    setCallHistory(data ?? []);
  }

  function openUpdateModal(lead: Lead, duration = 0) {
    setUpdateLead(lead);
    setCallDuration(duration);
    setFStatus(lead.followup_status ?? '');
    setFNextDate(null); setFNextTime('');
    setFRemarks(''); // reset to empty so we only type NEW remarks
    setFNewItinId(lead.itinerary_id || '');
    setFNewItinOption(lead.itinerary_option || '');
    setItinFilter('');
    setFDiffDestination('');
    // reset advance paid
    setFTotal(''); setFAdvance('');
    setFPassportNo(''); setFPassportName('');
    setFPassportNo(''); setFPassportName('');
    setFArrPNR(''); setFArrFlight(''); setFArrDepPlace('Cochin Airport'); setFArrDepDate(''); setFArrDepTime('');
    setFArrArrAirport('Denpasar Airport'); setFArrArrDate(''); setFArrArrTime('');
    setFDepPNR(''); setFDepFlight(''); setFDepDepPlace('Denpasar Airport'); setFDepDepDate(''); setFDepDepTime('');
    setFDepArrAirport('Cochin Airport'); setFDepArrDate(''); setFDepArrTime('');
    setUpdateModal(true);
  }

  function getNextFollowupTs(): string | null {
    if (!fNextDate) return null;
    const d = new Date(fNextDate);
    let h = 0, m = 0;
    const timeMatch = fNextTime.trim().match(/^(\d{1,2})[.: ]?(\d{0,2})\s*(am|pm)?$/i);
    if (timeMatch) {
      h = parseInt(timeMatch[1], 10) || 0;
      m = parseInt(timeMatch[2], 10) || 0;
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
    }
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  function formatDuration(secs: number) {
    if (secs < 10) return 'Missed / Short';
    const m = Math.floor(secs / 60); const s = secs % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }

  function handleShareItinerary() {
    if (!viewLead || !viewItinId) return;
    const itin = itineraries.find(i => i.id === viewItinId);
    if (!itin) return;

    let text = `🌍 *${itin.title.toUpperCase()}*`;
    if (itin.description) text += `\n\n${itin.description}`;

    if (viewItinOption && itin.pricing_data[viewItinOption]) {
      const data: any = itin.pricing_data[viewItinOption];
      const meta = OPTION_META[viewItinOption];
      text += `\n\n*💰 PRICING (${(meta?.label ?? viewItinOption).toUpperCase()}):* ₹${(data?.price ?? data)?.toLocaleString?.() ?? data}`;
      
      if (data.inclusions && data.inclusions.length > 0) {
        text += `\n\n*✅ Inclusions:*\n` + data.inclusions.map((i: string) => `- ${i}`).join('\n');
      }
      if (data.exclusions && data.exclusions.length > 0) {
        text += `\n\n*❌ Exclusions:*\n` + data.exclusions.map((e: string) => `- ${e}`).join('\n');
      }
    } else {
      const pricing = Object.entries(itin.pricing_data as Record<string, any>)
        .map(([k, v]) => `• ${OPTION_META[k]?.label ?? k}: ₹${(v?.price ?? v)?.toLocaleString?.() ?? v}`)
        .join('\n');
      text += `\n\n*💰 Pricing:*\n${pricing}`;
    }

    text += `\n\n📞 *Contact us to confirm!*`;

    const msg = encodeURIComponent(text);
    const n = viewLead.contact_no.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${n}&text=${msg}`).catch(() =>
      Alert.alert('WhatsApp not installed'));
  }

  function handleShareNewItinerary() {
    if (!updateLead || !fNewItinId) {
      // If it's sent status, we use existing lead's itin
      if (fStatus === 'itinerary_sent' && updateLead?.itinerary_id) {
        const itin = itineraries.find(i => i.id === updateLead.itinerary_id);
        if (!itin) return;
        let text = `🌍 *${itin.title.toUpperCase()}*`;
        if (itin.description) text += `\n\n${itin.description}`;
        if (updateLead.itinerary_option && itin.pricing_data[updateLead.itinerary_option]) {
          const data: any = itin.pricing_data[updateLead.itinerary_option];
          const meta = OPTION_META[updateLead.itinerary_option];
          text += `\n\n*💰 PRICING (${(meta?.label ?? updateLead.itinerary_option).toUpperCase()}):* ₹${(data?.price ?? data)?.toLocaleString?.() ?? data}`;
          if (data.inclusions?.length > 0) text += `\n\n*✅ Inclusions:*\n` + data.inclusions.map((i: string) => `- ${i}`).join('\n');
          if (data.exclusions?.length > 0) text += `\n\n*❌ Exclusions:*\n` + data.exclusions.map((e: string) => `- ${e}`).join('\n');
        }
        text += `\n\n📞 *Contact us to confirm!*`;
        const msg = encodeURIComponent(text);
        const n = updateLead.contact_no.replace(/\D/g, '');
        Linking.openURL(`whatsapp://send?phone=${n}&text=${msg}`).catch(() => Alert.alert('WhatsApp not installed'));
        return;
      }
      Alert.alert('Selection Required', 'Please select an itinerary first.');
      return;
    }

    const itin = itineraries.find(i => i.id === fNewItinId);
    if (!itin) return;

    let text = `🌍 *${itin.title.toUpperCase()}*`;
    if (itin.description) text += `\n\n${itin.description}`;

    if (fNewItinOption && itin.pricing_data[fNewItinOption]) {
      const data: any = itin.pricing_data[fNewItinOption];
      const meta = OPTION_META[fNewItinOption];
      text += `\n\n*💰 PRICING (${(meta?.label ?? fNewItinOption).toUpperCase()}):* ₹${(data?.price ?? data)?.toLocaleString?.() ?? data}`;
      
      if (data.inclusions && data.inclusions.length > 0) {
        text += `\n\n*✅ Inclusions:*\n` + data.inclusions.map((i: string) => `- ${i}`).join('\n');
      }
      if (data.exclusions && data.exclusions.length > 0) {
        text += `\n\n*❌ Exclusions:*\n` + data.exclusions.map((e: string) => `- ${e}`).join('\n');
      }
    } else {
      const pricing = Object.entries(itin.pricing_data as Record<string, any>)
        .map(([k, v]) => `• ${OPTION_META[k]?.label ?? k}: ₹${(v?.price ?? v)?.toLocaleString?.() ?? v}`)
        .join('\n');
      text += `\n\n*💰 Pricing:*\n${pricing}`;
    }

    text += `\n\n📞 *Contact us to confirm!*`;

    const msg = encodeURIComponent(text);
    const n = updateLead.contact_no.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${n}&text=${msg}`).catch(() =>
      Alert.alert('WhatsApp not installed'));
  }

  async function handleSaveUpdate() {
    if (!updateLead) return;
    setSaving(true);
    const update: Record<string, unknown> = { followup_status: fStatus };

    switch (fStatus) {
      case 'itinerary_sent':
      case 'itinerary_updated': {
        const isItinSent = fStatus === 'itinerary_sent';
        const isItinUpdated = fStatus === 'itinerary_updated';
        
        // Centralized history tracking: push current itinerary to history ONLY if it's changing
        const history = Array.isArray(updateLead.itinerary_history) ? [...updateLead.itinerary_history] : [];
        const hasItinChanged = (fNewItinId && fNewItinId !== updateLead.itinerary_id) || 
                              (fNewItinOption && fNewItinOption !== updateLead.itinerary_option);

        if (hasItinChanged && updateLead.itinerary_id) {
          const prevItin = itineraries.find(i => i.id === updateLead.itinerary_id);
          history.push({
            id: updateLead.itinerary_id,
            title: prevItin?.title ?? 'Previous',
            option: updateLead.itinerary_option,
            option_label: updateLead.itinerary_option ? (OPTION_META[updateLead.itinerary_option]?.label ?? updateLead.itinerary_option) : null
          });
          update.itinerary_history = history;
        }

        if (fNewItinId) {
          // Both statuses can set a new itinerary, but Updated requires an option check
          if (isItinUpdated && !fNewItinOption) {
            Alert.alert('Selection Required', 'Please select a travel option.');
            setSaving(false);
            return;
          }
          update.itinerary_id = fNewItinId;
          update.itinerary_option = fNewItinOption;
        }
        update.next_followup_at = getNextFollowupTs() ?? updateLead.next_followup_at;
        break;
      }
      case 'followup': {
        if (fRemarks.trim()) {
          const ds = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const newRemark = `[${ds}] ${fRemarks.trim()}`;
          update.call_remarks = updateLead.call_remarks ? `${updateLead.call_remarks}\n${newRemark}` : newRemark;
        } else {
          update.call_remarks = updateLead.call_remarks;
        }
        update.next_followup_at = getNextFollowupTs() ?? updateLead.next_followup_at;
        break;
      }
      case 'different_location':
        update.returned_to_admin = true;
        update.status = 'New';
        update.next_followup_at = null;
        if (fDiffDestination.trim()) update.destination = fDiffDestination.trim();
        break;
      case 'advance_paid':
        update.status = 'Converted'; update.next_followup_at = null;
        break;
      case 'dead':
        update.status = 'Lost'; update.next_followup_at = null;
        break;
    }

    await supabase.from('leads').update(update).eq('id', updateLead.id);

    // For advance_paid → insert confirmed booking
    if (fStatus === 'advance_paid') {
      const total = parseFloat(fTotal) || 0;
      const advance = parseFloat(fAdvance) || 0;
      await supabase.from('confirmed_bookings').insert({
        lead_id: updateLead.id,
        itinerary_id: updateLead.itinerary_id || null,
        total_amount: total, advance_paid: advance, due_amount: total - advance,
        passport_no: fPassportNo, passport_name: fPassportName,
        arr_pnr: fArrPNR,
        arr_flight_no: fArrFlight, arr_dep_place: fArrDepPlace,
        arr_dep_date: fArrDepDate || null, arr_dep_time: fArrDepTime || null,
        arr_arr_airport: fArrArrAirport, arr_arr_date: fArrArrDate || null, arr_arr_time: fArrArrTime || null,
        dep_pnr: fDepPNR,
        dep_flight_no: fDepFlight, dep_dep_place: fDepDepPlace,
        dep_dep_date: fDepDepDate || null, dep_dep_time: fDepDepTime || null,
        dep_arr_airport: fDepArrAirport, dep_arr_date: fDepArrDate || null, dep_arr_time: fDepArrTime || null,
      });
    }

    setSaving(false); setUpdateModal(false); fetchFollowups();
    const msgs: Record<string, string> = {
      followup: 'Follow-up rescheduled!', itinerary_sent: 'Follow-up rescheduled.',
      itinerary_updated: 'Itinerary updated!', different_location: 'Lead returned to Admin.',
      advance_paid: '🎉 Booking Confirmed!', dead: 'Lead marked as Dead.',
    };
    Alert.alert('✅ Saved', msgs[fStatus] ?? 'Updated!');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getCountdown(ts: string) {
    const d = new Date(ts); const now = new Date();
    const diff = d.getTime() - now.getTime();
    const diffH = Math.round(diff / 3600000);
    const diffD = Math.round(diff / 86400000);
    if (diff < 0) return { label: 'Overdue', color: '#ef4444' };
    if (diffH < 1) return { label: `${Math.round(diff / 60000)}m`, color: '#f59e0b' };
    if (diffH < 24) return { label: `${diffH}h`, color: '#f59e0b' };
    return { label: `${diffD}d`, color: '#10b981' };
  }

  const filteredItins = itineraries.filter(i =>
    !itinFilter || i.title.toLowerCase().includes(itinFilter.toLowerCase()));

  const selectedStatusMeta = FOLLOWUP_STATUSES.find(s => s.key === fStatus);

  // ── Premium card render ────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Lead }) => {
    const countdown = item.next_followup_at ? getCountdown(item.next_followup_at) : null;
    const fColor = FUP_COLORS[item.followup_status ?? ''] ?? '#6366f1';
    const fLabel = FUP_LABELS[item.followup_status ?? ''] ?? item.followup_status;
    const nextDt = item.next_followup_at ? new Date(item.next_followup_at) : null;

    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => openDetailModal(item)} style={[s.card, { borderLeftColor: fColor }]}>
        {/* ─ Top row ─ */}
        <View style={s.cardTop}>
          {/* Avatar */}
          <View style={[s.avatar, { borderColor: fColor }]}>
            <Text style={s.avatarText}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
          </View>

          {/* Info */}
          <View style={s.cardMid}>
            <Text style={s.leadName} numberOfLines={1}>{item.name}</Text>
            <View style={s.row}>
              <Ionicons name="call-outline" size={13} color="#10b981" />
              <Text style={s.contact}>{item.contact_no}</Text>
            </View>
            {item.destination !== 'TBD' && (
              <View style={s.row}>
                <Ionicons name="map-outline" size={13} color="#94a3b8" />
                <Text style={s.meta}>{item.destination}</Text>
              </View>
            )}
          </View>

          {/* Countdown badge */}
          {countdown && nextDt && (
            <View style={[s.countdownBadge, { borderColor: countdown.color + '88' }]}>
              <Text style={[s.countdownDate, { color: countdown.color }]}>
                {nextDt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </Text>
              <Text style={[s.countdownLabel, { color: countdown.color }]}>{countdown.label}</Text>
              <Text style={[s.countdownTime, { color: '#64748b' }]}>
                {nextDt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        {/* ─ Status + remarks ─ */}
        <View style={s.cardMeta}>
          {item.followup_status && (
            <View style={[s.pill, { backgroundColor: fColor + '22', borderColor: fColor + '55' }]}>
              <Ionicons name={FOLLOWUP_STATUSES.find(f => f.key === item.followup_status)?.icon as any ?? 'flag-outline'} size={11} color={fColor} />
              <Text style={[s.pillText, { color: fColor }]}>{fLabel}</Text>
            </View>
          )}
          {item.call_remarks ? (
            <Text style={s.remarksText} numberOfLines={1}>💬 {item.call_remarks}</Text>
          ) : null}
        </View>

        {/* ─ Action buttons ─ */}
        <View style={s.actionRow}>
          <TouchableOpacity style={[s.btn, s.callBtn]} onPress={() => handleCall(item)}>
            <Ionicons name="call" size={15} color="#fff" />
            <Text style={s.btnText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.waBtn]} onPress={() => handleWhatsApp(item)}>
            <Ionicons name="logo-whatsapp" size={15} color="#fff" />
            <Text style={s.btnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.updateBtn]} onPress={() => openUpdateModal(item)}>
            <Ionicons name="create-outline" size={15} color="#fff" />
            <Text style={s.btnText}>Update</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      {loading ? <ActivityIndicator color="#10b981" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={leads}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          onRefresh={fetchFollowups}
          refreshing={loading}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="alarm-outline" size={52} color="#334155" />
              <Text style={s.emptyTitle}>No Follow-ups Yet</Text>
              <Text style={s.emptyText}>Schedule follow-ups when updating a lead profile.</Text>
            </View>
          }
        />
      )}

      {/* ── Lead Details Modal ──────────────────────────────────────────────── */}
      <Modal visible={detailModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{viewLead?.name}</Text>
              <Text style={s.modalSub}>{viewLead?.contact_no}</Text>
            </View>
            <TouchableOpacity onPress={() => setDetailModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.formContent}>
            {viewLead?.destination !== 'TBD' && (
              <View style={s.detailRow}>
                <Ionicons name="map-outline" size={16} color="#94a3b8" />
                <Text style={s.detailText}>{viewLead?.destination}</Text>
              </View>
            )}
            {viewLead?.followup_status && (
              <View style={s.detailRow}>
                <Ionicons name={FOLLOWUP_STATUSES.find(f => f.key === viewLead.followup_status)?.icon as any ?? 'flag-outline'} size={16} color={FUP_COLORS[viewLead.followup_status] ?? '#6366f1'} />
                <Text style={[s.detailText, { color: FUP_COLORS[viewLead.followup_status] ?? '#6366f1', fontWeight: '700' }]}>
                  {FUP_LABELS[viewLead.followup_status] ?? viewLead.followup_status}
                </Text>
              </View>
            )}
            {viewLead?.next_followup_at && (
              <View style={s.detailRow}>
                <Ionicons name="alarm-outline" size={16} color="#f59e0b" />
                <Text style={[s.detailText, { color: '#f59e0b' }]}>
                  Next: {new Date(viewLead.next_followup_at).toLocaleDateString()} at {new Date(viewLead.next_followup_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {viewLead?.call_remarks && (
              <View style={s.box}>
                <Text style={s.subHeading}>💬 All Call Remarks</Text>
                <Text style={{ color: '#cbd5e1', fontSize: 14, fontStyle: 'italic', marginTop: 4 }}>{viewLead.call_remarks}</Text>
              </View>
            )}
            {(viewLead?.itinerary_id || (viewLead?.itinerary_history && viewLead.itinerary_history.length > 0)) && (
              <View style={s.box}>
                <Text style={s.subHeading}>🗺️ Itinerary History</Text>
                {viewLead.itinerary_id && (
                  <TouchableOpacity onPress={() => { setViewItinId(viewLead.itinerary_id!); setViewItinOption(viewLead.itinerary_option); setIsViewingCurrent(true); }} style={[s.detailRow, { marginTop: 8 }]}>
                    <Ionicons name="location" size={14} color="#10b981" />
                    <Text style={[s.detailText, { color: '#10b981' }]}>
                      Current: {itineraries.find(i => i.id === viewLead.itinerary_id)?.title}
                      {viewLead.itinerary_option && ` (${OPTION_META[viewLead.itinerary_option]?.label ?? viewLead.itinerary_option})`}
                    </Text>
                  </TouchableOpacity>
                )}
                {viewLead.itinerary_history?.map((h, i) => (
                  <TouchableOpacity key={i} onPress={() => { setViewItinId(h.id); setViewItinOption(h.option ?? null); setIsViewingCurrent(false); }} style={[s.detailRow, { marginTop: 10 }]}>
                    <Ionicons name="archive-outline" size={14} color="#64748b" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailText}>Previous: {h.title}</Text>
                      {h.option_label && <Text style={{ color: '#64748b', fontSize: 11, marginLeft: 0 }}>Option: {h.option_label}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={[s.box, { marginTop: 8 }]}>
              <Text style={s.subHeading}>📞 Call History ({callHistory.length})</Text>
              {callHistory.length === 0 ? (
                <Text style={{ color: '#475569', fontSize: 13, marginTop: 10 }}>No calls logged yet.</Text>
              ) : (
                callHistory.map(ch => (
                  <View key={ch.id} style={s.callLogBtn}>
                    <Ionicons name="call" size={14} color="#64748b" />
                    <Text style={{ color: '#cbd5e1', fontSize: 14, flex: 1 }}>
                      {new Date(ch.called_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '700' }}>
                      {formatDuration(ch.duration_seconds)}
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
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{itineraries.find(i => i.id === viewItinId)?.title}</Text>
              <Text style={s.modalSub}>Itinerary Details</Text>
            </View>
            <TouchableOpacity onPress={() => { setViewItinId(null); setViewItinOption(null); setIsViewingCurrent(false); }} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.formContent}>
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
                              <Text style={{ color: '#10b981', fontSize: 15, fontWeight: '800' }}>₹{data.price}</Text>
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
                          {data.exclusions?.length > 0 && (
                            <View style={{ marginBottom: 10 }}>
                              <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>EXCLUSIONS</Text>
                              {data.exclusions.map((exc: string, i: number) => (
                                <Text key={`exc-${i}`} style={{ color: '#64748b', fontSize: 12, marginBottom: 1 }}>• {exc}</Text>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  <TouchableOpacity style={[s.btn, s.waBtn, { marginTop: 12, height: 48 }]} onPress={handleShareItinerary}>
                    <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                    <Text style={[s.btnText, { fontSize: 16 }]}>Share via WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Follow-up Update Modal ──────────────────────────────────────────── */}
      <Modal visible={updateModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{updateLead?.name ?? 'Update Follow-up'}</Text>
              <Text style={s.modalSub}>{updateLead?.contact_no}</Text>
            </View>
            {callDuration > 0 && (
              <View style={s.durationBadge}>
                <Ionicons name="call" size={13} color="#10b981" />
                <Text style={s.durationText}>{formatDuration(callDuration)}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setUpdateModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">

            {/* Status dropdown */}
            <Text style={s.fieldLabel}>Follow-up Status</Text>
            <TouchableOpacity style={[s.dropdown, selectedStatusMeta && { borderColor: selectedStatusMeta.color }]}
              onPress={() => setStatusPickerOpen(true)}>
              {selectedStatusMeta
                ? <><Ionicons name={selectedStatusMeta.icon as any} size={16} color={selectedStatusMeta.color} />
                    <Text style={[s.dropdownText, { color: selectedStatusMeta.color, flex: 1 }]}>{selectedStatusMeta.label}</Text></>
                : <Text style={[s.dropdownText, { flex: 1 }]}>Select status…</Text>
              }
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* ─ Status 1 & 2: next follow-up ─ */}
            {(fStatus === 'itinerary_sent' || fStatus === 'itinerary_updated') && (
              <View style={[s.box, { borderColor: (FUP_COLORS[fStatus] ?? '#6366f1') + '55' }]}>
                {fStatus === 'itinerary_sent' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>SELECTED ITINERARY</Text>
                    {updateLead?.itinerary_id ? (
                      <Text style={{ color: '#10b981', fontSize: 15, fontWeight: '700' }}>
                        ✅ {itineraries.find(i => i.id === updateLead.itinerary_id)?.title}
                        {updateLead.itinerary_option ? ` (${OPTION_META[updateLead.itinerary_option]?.label ?? updateLead.itinerary_option})` : ''}
                      </Text>
                    ) : <Text style={{ color: '#ef4444', fontSize: 13 }}>⚠️ No itinerary selected</Text>}
                  </View>
                )}
                {fStatus === 'itinerary_updated' && (
                  <>
                    <Text style={s.fieldLabel}>New Itinerary</Text>
                    <View style={s.filterRow}>
                      <Ionicons name="search-outline" size={14} color="#64748b" />
                      <TextInput style={s.filterInput} value={itinFilter} onChangeText={setItinFilter}
                        placeholder="Search itinerary..." placeholderTextColor="#475569" />
                    </View>
                    {filteredItins.map(itin => (
                      <TouchableOpacity key={itin.id} style={[s.itinRow, fNewItinId === itin.id && s.itinRowActive]}
                        onPress={() => { setFNewItinId(itin.id); setFNewItinOption(''); }}>
                        <Ionicons name={fNewItinId === itin.id ? 'radio-button-on' : 'radio-button-off'} size={16}
                          color={fNewItinId === itin.id ? '#f59e0b' : '#475569'} />
                        <Text style={[s.itinRowText, fNewItinId === itin.id && { color: '#f59e0b' }]}>{itin.title}</Text>
                      </TouchableOpacity>
                    ))}

                    {/* Show travel options for the selected itinerary */}
                    {fNewItinId ? (() => {
                      const selItin = itineraries.find(i => i.id === fNewItinId);
                      const opts = selItin?.pricing_data ? Object.keys(selItin.pricing_data) : [];
                      if (opts.length > 0) {
                        return (
                          <View style={{ marginTop: 8, padding: 12, backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}>
                            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', marginBottom: 8 }}>SELECT TRAVEL OPTION</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                              {opts.map(opt => {
                                const meta = OPTION_META[opt];
                                if (!meta) return null;
                                const isSel = fNewItinOption === opt;
                                return (
                                  <TouchableOpacity key={opt} onPress={() => setFNewItinOption(opt)}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: isSel ? meta.color : '#334155', backgroundColor: isSel ? meta.color + '22' : 'transparent' }}>
                                    <Ionicons name={meta.icon as any} size={14} color={isSel ? meta.color : '#64748b'} />
                                    <Text style={{ color: isSel ? meta.color : '#cbd5e1', fontSize: 13, fontWeight: '600' }}>{meta.label}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        );
                      }
                      return null;
                    })() : null}

                    <TouchableOpacity style={[s.btn, s.waBtn, { marginTop: 12, height: 44 }]} onPress={handleShareNewItinerary}>
                      <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                      <Text style={s.btnText}>Send via WhatsApp</Text>
                    </TouchableOpacity>
                  </>
                )}
                <Text style={[s.fieldLabel, { marginTop: fStatus === 'itinerary_updated' ? 8 : 0 }]}>📅 Next Follow-up Date</Text>

                <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={17} color="#94a3b8" />
                  <Text style={[s.dateBtnText, fNextDate && { color: '#f8fafc' }]}>
                    {fNextDate ? fNextDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Date'}
                  </Text>
                </TouchableOpacity>
                <DateField value={fNextDate} onChange={setFNextDate} showPicker={showDatePicker} setShowPicker={setShowDatePicker} />
                <Text style={[s.fieldLabel, { marginTop: 6 }]}>🕐 Time (HH:MM)</Text>
                <TextInput style={s.input} value={fNextTime} onChangeText={setFNextTime}
                  placeholder="10:00" placeholderTextColor="#475569" keyboardType="numbers-and-punctuation" />
              </View>
            )}

            {/* ─ Status 3: Follow-up ─ */}
            {fStatus === 'followup' && (
              <View style={[s.box, { borderColor: '#10b98155' }]}>
                {updateLead?.call_remarks ? (
                  <View style={{ marginBottom: 10, padding: 10, backgroundColor: '#0f172a', borderRadius: 8 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Previous Remarks:</Text>
                    <Text style={{ color: '#cbd5e1', fontSize: 13, fontStyle: 'italic' }}>{updateLead.call_remarks}</Text>
                  </View>
                ) : null}
                <Text style={s.fieldLabel}>Add New Call Remarks</Text>
                <TextInput style={[s.input, { minHeight: 85, textAlignVertical: 'top' }]}
                  value={fRemarks} onChangeText={setFRemarks}
                  placeholder="Notes from this call..." placeholderTextColor="#475569" multiline numberOfLines={4} />
                <Text style={[s.fieldLabel, { marginTop: 8 }]}>📅 Next Follow-up Date</Text>
                <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={17} color="#94a3b8" />
                  <Text style={[s.dateBtnText, fNextDate && { color: '#f8fafc' }]}>
                    {fNextDate ? fNextDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Date'}
                  </Text>
                </TouchableOpacity>
                <DateField value={fNextDate} onChange={setFNextDate} showPicker={showDatePicker} setShowPicker={setShowDatePicker} />
                <Text style={[s.fieldLabel, { marginTop: 6 }]}>🕐 Time (HH:MM)</Text>
                <TextInput style={s.input} value={fNextTime} onChangeText={setFNextTime}
                  placeholder="10:00" placeholderTextColor="#475569" keyboardType="numbers-and-punctuation" />
              </View>
            )}

            {/* ─ Status 4: Different location ─ */}
            {fStatus === 'different_location' && (
              <View style={[s.box, { borderColor: '#8b5cf655', gap: 10 }]}>
                <Text style={s.fieldLabel}>Requested Destination</Text>
                <TextInput
                  style={s.input}
                  value={fDiffDestination}
                  onChangeText={setFDiffDestination}
                  placeholder="e.g. Maldives, Thailand..."
                  placeholderTextColor="#475569"
                />
                <Text style={s.hint}>This lead will be returned to Admin under "Return from Sale". The destination above helps the admin reassign it correctly.</Text>
              </View>
            )}

            {/* ─ Status 5: Advance Paid ─ */}
            {fStatus === 'advance_paid' && (
              <View style={[s.box, { borderColor: '#10b98155', gap: 10 }]}>
                <View style={s.boxHeader}>
                  <Ionicons name="checkmark-circle" size={15} color="#10b981" />
                  <Text style={s.boxTitle}>Advance Paid & Confirmed</Text>
                </View>

                <Text style={s.subHeading}>💰 Payment</Text>
                <FField label="Total Amount (₹)" value={fTotal} onChange={setFTotal} placeholder="100000" keyboardType="numeric" />
                <FField label="Advance Paid (₹)" value={fAdvance} onChange={setFAdvance} placeholder="50000" keyboardType="numeric" />
                {fTotal && fAdvance ? (
                  <View style={s.dueRow}>
                    <Text style={s.dueLabel}>Due Amount</Text>
                    <Text style={s.dueAmt}>₹{(parseFloat(fTotal) - parseFloat(fAdvance)).toLocaleString()}</Text>
                  </View>
                ) : null}

                <Text style={s.subHeading}>🛂 Passport</Text>
                <FField label="Passport No" value={fPassportNo} onChange={setFPassportNo} placeholder="A1234567" />
                <FField label="Name (as on Passport)" value={fPassportName} onChange={setFPassportName} placeholder="JOHN DOE" autoCapitalize="characters" />

                <Text style={s.subHeading}>✈️ Arrival Flight (India → Destination)</Text>
                <View style={s.rowTwo}>
                  <View style={{ flex: 1 }}><FField label="Arrival PNR" value={fArrPNR} onChange={setFArrPNR} placeholder="PNR" autoCapitalize="characters" /></View>
                  <View style={{ flex: 1 }}><FField label="Flight No" value={fArrFlight} onChange={setFArrFlight} placeholder="6E 2345" autoCapitalize="characters" /></View>
                </View>
                <FField label="Departure Place" value={fArrDepPlace} onChange={setFArrDepPlace} placeholder="Cochin Airport" />
                <View style={s.rowTwo}>
                  <View style={{ flex: 1 }}><FField label="Dep Date (YYYY-MM-DD)" value={fArrDepDate} onChange={setFArrDepDate} placeholder="2026-05-10" /></View>
                  <View style={{ width: 105 }}><FField label="Dep Time" value={fArrDepTime} onChange={setFArrDepTime} placeholder="06:30" /></View>
                </View>
                <FField label="Arrival Airport" value={fArrArrAirport} onChange={setFArrArrAirport} placeholder="Denpasar Airport" />
                <View style={s.rowTwo}>
                  <View style={{ flex: 1 }}><FField label="Arr Date (YYYY-MM-DD)" value={fArrArrDate} onChange={setFArrArrDate} placeholder="2026-05-10" /></View>
                  <View style={{ width: 105 }}><FField label="Arr Time" value={fArrArrTime} onChange={setFArrArrTime} placeholder="10:30" /></View>
                </View>

                <Text style={s.subHeading}>✈️ Departure Flight (Destination → India)</Text>
                <View style={s.rowTwo}>
                  <View style={{ flex: 1 }}><FField label="Departure PNR" value={fDepPNR} onChange={setFDepPNR} placeholder="PNR" autoCapitalize="characters" /></View>
                  <View style={{ flex: 1 }}><FField label="Flight No" value={fDepFlight} onChange={setFDepFlight} placeholder="6E 2346" autoCapitalize="characters" /></View>
                </View>
                <FField label="Departure Place" value={fDepDepPlace} onChange={setFDepDepPlace} placeholder="Denpasar Airport" />
                <View style={s.rowTwo}>
                  <View style={{ flex: 1 }}><FField label="Dep Date (YYYY-MM-DD)" value={fDepDepDate} onChange={setFDepDepDate} placeholder="2026-05-15" /></View>
                  <View style={{ width: 105 }}><FField label="Dep Time" value={fDepDepTime} onChange={setFDepDepTime} placeholder="14:00" /></View>
                </View>
                <FField label="Arrival Airport" value={fDepArrAirport} onChange={setFDepArrAirport} placeholder="Cochin Airport" />
                <View style={s.rowTwo}>
                  <View style={{ flex: 1 }}><FField label="Arr Date (YYYY-MM-DD)" value={fDepArrDate} onChange={setFDepArrDate} placeholder="2026-05-15" /></View>
                  <View style={{ width: 105 }}><FField label="Arr Time" value={fDepArrTime} onChange={setFDepArrTime} placeholder="19:30" /></View>
                </View>
              </View>
            )}
            {fStatus === 'dead' && (
              <View style={[s.box, { borderColor: '#ef444455' }]}>
                <Text style={s.hint}>This lead will be marked as Dead and removed from follow-ups.</Text>
              </View>
            )}

            <TouchableOpacity style={[s.saveBtn, !fStatus && { opacity: 0.5 }]}
              onPress={handleSaveUpdate} disabled={saving || !fStatus}>
              {saving ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnText}>Save Follow-up Update</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Status picker */}
      <Modal visible={statusPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setStatusPickerOpen(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Select Follow-up Status</Text>
            {FOLLOWUP_STATUSES.map(fs => (
              <TouchableOpacity key={fs.key}
                style={[s.pickerItem, fStatus === fs.key && { backgroundColor: fs.color + '22' }]}
                onPress={() => { setFStatus(fs.key); setStatusPickerOpen(false); }}>
                <Ionicons name={fs.icon as any} size={18} color={fs.color} />
                <Text style={[s.pickerItemText, fStatus === fs.key && { color: fs.color, fontWeight: '700' }]}>{fs.label}</Text>
                {fStatus === fs.key && <Ionicons name="checkmark" size={18} color={fs.color} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Shared form field ────────────────────────────────────────────────────────
function FField({ label, value, onChange, placeholder, keyboardType = 'default', autoCapitalize = 'sentences' }: any) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor="#475569" keyboardType={keyboardType} autoCapitalize={autoCapitalize} />
    </View>
  );
}

// ─── Cross-platform date picker ───────────────────────────────────────────────
function DateField({ value, onChange, showPicker, setShowPicker }: {
  value: Date | null; onChange: (d: Date) => void;
  showPicker: boolean; setShowPicker: (v: boolean) => void;
}) {
  if (!showPicker) return null;
  if (Platform.OS === 'web') {
    return (
      <TextInput style={[s.input, { marginTop: 4 }]} placeholder="YYYY-MM-DD"
        placeholderTextColor="#475569" autoFocus
        defaultValue={value ? value.toISOString().split('T')[0] : ''}
        onChangeText={(t) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
            const d = new Date(t); if (!isNaN(d.getTime())) { onChange(d); setShowPicker(false); }
          }
        }} />
    );
  }
  return (
    <NativeDTP mode="date" value={value ?? new Date()} minimumDate={new Date()}
      onChange={(_e: any, d: Date | undefined) => {
        setShowPicker(Platform.OS === 'ios'); if (d) onChange(d);
      }}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'} themeVariant="dark" />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16, gap: 14, paddingBottom: 40 },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyTitle: { color: '#475569', fontSize: 17, fontWeight: '700' },
  emptyText: { color: '#334155', fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  // ── Card ──
  card: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 16, gap: 12,
    borderLeftWidth: 3, borderLeftColor: '#6366f1',
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#0f172a',
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#94a3b8', fontSize: 20, fontWeight: '700' },
  cardMid: { flex: 1, gap: 4 },
  leadName: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  contact: { color: '#10b981', fontSize: 13, fontWeight: '600' },
  meta: { color: '#94a3b8', fontSize: 13 },
  countdownBadge: {
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
    alignItems: 'center', gap: 2, minWidth: 68,
  },
  countdownDate: { fontSize: 13, fontWeight: '800' },
  countdownLabel: { fontSize: 12, fontWeight: '700' },
  countdownTime: { fontSize: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  remarksText: { color: '#475569', fontSize: 12, fontStyle: 'italic', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  callBtn: { backgroundColor: '#2563eb' },
  waBtn: { backgroundColor: '#16a34a' },
  updateBtn: { backgroundColor: '#6366f1' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Modal ──
  modal: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#1e293b', gap: 12 },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  modalSub: { color: '#10b981', fontSize: 13, fontWeight: '600', marginTop: 2 },
  durationBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#10b98122', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#10b98155' },
  durationText: { color: '#10b981', fontSize: 12, fontWeight: '700' },
  formContent: { padding: 20, gap: 14, paddingBottom: 40 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 10, padding: 14, borderWidth: 1.5, borderColor: '#334155' },
  dropdownText: { color: '#475569', fontSize: 14 },
  box: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0f172a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#334155' },
  filterInput: { flex: 1, color: '#f8fafc', fontSize: 14 },
  itinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0f172a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155' },
  itinRowActive: { borderColor: '#f59e0b' },
  itinRowText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600', flex: 1 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', borderRadius: 10, padding: 13, borderWidth: 1, borderColor: '#334155' },
  dateBtnText: { color: '#475569', fontSize: 14 },
  input: { backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: 10, padding: 13, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  hint: { color: '#475569', fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
  saveBtn: { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 2, paddingBottom: 40 },
  pickerTitle: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10 },
  pickerItemText: { flex: 1, color: '#cbd5e1', fontSize: 15 },
  boxHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boxTitle: { color: '#10b981', fontSize: 14, fontWeight: '700' },
  subHeading: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginTop: 4 },
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, padding: 12 },
  dueLabel: { color: '#94a3b8', fontSize: 13 },
  dueAmt: { color: '#f59e0b', fontSize: 17, fontWeight: '700' },
  rowTwo: { flexDirection: 'row', gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  detailText: { color: '#94a3b8', fontSize: 15 },
  callLogBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#334155' },
});
