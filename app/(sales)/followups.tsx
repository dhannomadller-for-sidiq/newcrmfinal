import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Linking, Alert, Modal, ScrollView, TextInput, AppState, AppStateStatus, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { C, R, S } from '@/lib/theme';
import { STATUS_COLORS, FOLLOWUP_STATUSES, TRIP_PLACE_SUGGESTIONS, FUP_COLORS, FUP_LABELS, OPTION_META } from '@/lib/salesConstants';
import { useAuth } from '@/contexts/AuthContext';

const NativeDTP = Platform.OS !== 'web'
  ? require('@react-native-community/datetimepicker').default : null;

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { parseTicketFile } from '@/utils/ticketParser';

// ─── Types ────────────────────────────────────────────────────────────────────
type Lead = {
  id: string; name: string; contact_no: string; destination: string;
  status: string; followup_status: string | null; next_followup_at: string | null;
  call_remarks: string | null; itinerary_id: string | null; itinerary_option: string | null;
  itinerary_history: Array<{ id: string; title: string; option?: string | null; option_label?: string | null }>;
  created_at?: string;
};
type Itinerary = { id: string; title: string; destination_id: string; pricing_data: Record<string, unknown>; description?: string; important_notes?: string };



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
  const [fPax, setFPax] = useState('');
  const [fPassportNo, setFPassportNo] = useState('');
  const [fPassportName, setFPassportName] = useState('');
  const [fPanNo, setFPanNo] = useState('');
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
  const [fRegion, setFRegion] = useState('Indian');
  const [fGuestList, setFGuestList] = useState('');

  // ── Train fields ────────────────────────────────────────────────────────
  const [fArrTrainPnr, setFArrTrainPnr] = useState('');
  const [fArrTrainNo, setFArrTrainNo] = useState('');
  const [fArrTrainName, setFArrTrainName] = useState('');
  const [fArrTrainDepPlace, setFArrTrainDepPlace] = useState('');
  const [fArrTrainDepDate, setFArrTrainDepDate] = useState('');
  const [fArrTrainDepTime, setFArrTrainDepTime] = useState('');
  const [fArrTrainArrStation, setFArrTrainArrStation] = useState('');
  const [fArrTrainArrDate, setFArrTrainArrDate] = useState('');
  const [fArrTrainArrTime, setFArrTrainArrTime] = useState('');

  const [fDepTrainPnr, setFDepTrainPnr] = useState('');
  const [fDepTrainNo, setFDepTrainNo] = useState('');
  const [fDepTrainName, setFDepTrainName] = useState('');
  const [fDepTrainDepPlace, setFDepTrainDepPlace] = useState('');
  const [fDepTrainDepDate, setFDepTrainDepDate] = useState('');
  const [fDepTrainDepTime, setFDepTrainDepTime] = useState('');
  const [fDepTrainArrStation, setFDepTrainArrStation] = useState('');
  const [fDepTrainArrDate, setFDepTrainArrDate] = useState('');
  const [fDepTrainArrTime, setFDepTrainArrTime] = useState('');

  // ── Bus fields ────────────────────────────────────────────────────────
  const [fArrBusName, setFArrBusName] = useState('');
  const [fArrBusDepStation, setFArrBusDepStation] = useState('');
  const [fArrBusDepDate, setFArrBusDepDate] = useState('');
  const [fArrBusDepTime, setFArrBusDepTime] = useState('');
  const [fArrBusArrStation, setFArrBusArrStation] = useState('');
  const [fArrBusArrDate, setFArrBusArrDate] = useState('');
  const [fArrBusArrTime, setFArrBusArrTime] = useState('');
  const [fArrBusOperatorContact, setFArrBusOperatorContact] = useState('');

  const [fDepBusName, setFDepBusName] = useState('');
  const [fDepBusDepStation, setFDepBusDepStation] = useState('');
  const [fDepBusDepDate, setFDepBusDepDate] = useState('');
  const [fDepBusDepTime, setFDepBusDepTime] = useState('');
  const [fDepBusArrStation, setFDepBusArrStation] = useState('');
  const [fDepBusArrDate, setFDepBusArrDate] = useState('');
  const [fDepBusArrTime, setFDepBusArrTime] = useState('');
  const [fDepBusOperatorContact, setFDepBusOperatorContact] = useState('');

  const [fTransportMode, setFTransportMode] = useState<'flights' | 'train' | 'bus' | null>(null);

  const [parsing, setParsing] = useState(false);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [liveRate, setLiveRate] = useState(95);

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
      .order('created_at', { ascending: false });
    setLeads(data ?? []);
    setLoading(false);
  }, [profile]);

  const fetchItineraries = useCallback(async () => {
    const { data } = await supabase.from('itineraries').select('id, title, description, important_notes, destination_id, pricing_data').order('title');
    setItineraries(data ?? []);

    const { data: dests } = await supabase.from('destinations').select('id, name, checklist');
    setDestinations(dests ?? []);

    const { data: setts } = await supabase.from('settings').select('*').eq('key', 'usd_rate').maybeSingle();
    if (setts?.value) setLiveRate(parseFloat(setts.value) || 95);
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
    setFTotal(''); setFAdvance(''); setFPax('');
    setFPassportNo(''); setFPassportName(''); setFPanNo('');
    setFArrPNR(''); setFArrFlight(''); setFArrDepPlace('Cochin Airport'); setFArrDepDate(''); setFArrDepTime('');
    setFArrArrAirport('Denpasar Airport'); setFArrArrDate(''); setFArrArrTime('');
    setFDepPNR(''); setFDepFlight(''); setFDepDepPlace('Denpasar Airport'); setFDepDepDate(''); setFDepDepTime('');
    setFDepArrAirport('Cochin Airport'); setFDepArrDate(''); setFDepArrTime('');
    setFArrTrainPnr(''); setFArrTrainNo(''); setFArrTrainName(''); setFArrTrainDepPlace(''); setFArrTrainDepDate(''); setFArrTrainDepTime(''); setFArrTrainArrStation(''); setFArrTrainArrDate(''); setFArrTrainArrTime('');
    setFDepTrainPnr(''); setFDepTrainNo(''); setFDepTrainName(''); setFDepTrainDepPlace(''); setFDepTrainDepDate(''); setFDepTrainDepTime(''); setFDepTrainArrStation(''); setFDepTrainArrDate(''); setFDepTrainArrTime('');
    setFArrBusName(''); setFArrBusDepStation(''); setFArrBusDepDate(''); setFArrBusDepTime(''); setFArrBusArrStation(''); setFArrBusArrDate(''); setFArrBusArrTime(''); setFArrBusOperatorContact('');
    setFDepBusName(''); setFDepBusDepStation(''); setFDepBusDepDate(''); setFDepBusDepTime(''); setFDepBusArrStation(''); setFDepBusArrDate(''); setFDepBusArrTime(''); setFDepBusOperatorContact('');
    setFRegion('Indian'); setFGuestList('');
    setUpdateModal(true);
  }

  function handleArrDepDateChange(val: string) {
    const prev = fArrDepDate;
    setFArrDepDate(val);
    if (val) {
      if (!fArrArrDate || fArrArrDate === prev) setFArrArrDate(val);
      if (!fDepDepDate || fDepDepDate === prev) setFDepDepDate(val);
      if (!fDepArrDate || fDepArrDate === prev) setFDepArrDate(val);
    }
  }

  function handleArrTrainDepDateChange(val: string) {
    const prev = fArrTrainDepDate;
    setFArrTrainDepDate(val);
    if (val) {
      if (!fDepTrainDepDate || fDepTrainDepDate === prev) setFDepTrainDepDate(val);
    }
  }

  function handleArrBusDepDateChange(val: string) {
    const prev = fArrBusDepDate;
    setFArrBusDepDate(val);
    if (val) {
      if (!fDepBusDepDate || fDepBusDepDate === prev) setFDepBusDepDate(val);
    }
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

    const isBali = (viewLead.destination || '').toLowerCase().includes('bali');
    const sep = "━━━━━━━━━━━━━━━━━━";
    
    let text = `\u2728 *PREMIUM TRAVEL ITINERARY* \u2728\n\n`;
    text += `\uD83C\uDF34 *NOMADLLER PVT LTD – ${(viewLead.destination || 'TRIP').toUpperCase()}* \uD83C\uDDEE\uD83C\uDDE9\n\n`;
    const optionLabel = viewItinOption ? (OPTION_META[viewItinOption]?.label ?? viewItinOption) : null;
    text += `\u2728 *${itin.title} ${optionLabel ? `WITH ${optionLabel.toUpperCase()}` : ''}*\n\n`;
    
    // Pricing
    if (viewItinOption && itin.pricing_data[viewItinOption]) {
      const data: any = itin.pricing_data[viewItinOption];
      const priceUSD = data?.price_usd;
      const priceINR = data?.price ?? data;
      
      text += `\uD83D\uDCB0 *PACKAGE COST:*\n`;
      if (priceUSD) {
        text += `• USD ${priceUSD.toLocaleString()} per person\n\n`;
      } else {
        text += `• USD — (Please confirm with travel agent)\n\n`;
      }
      
      text += `\uD83D\uDC65 *Pax:* 2 Adults (Standard)\n`;
      text += `\uD83D\uDCC5 *Travel Dates:* As per availability\n\n`;
      text += `${sep}\n\n`;
      text += `\uD83D\uDCCD *ROUTE*\n${viewLead.destination || 'Scenic Tour'}\n\n`;
      text += `${sep}\n\n`;

      if (itin.description) {
        const days = itin.description.split('\n\n');
        days.forEach(day => {
          if (day.trim()) {
            text += `${day.trim()}\n\n`;
            text += `${sep}\n\n`;
          }
        });
      }

      if (data.inclusions && data.inclusions.length > 0) {
        text += `\`INCLUSIONS:\`\n`;
        data.inclusions.forEach((item: string) => { text += `• ${item}\n`; });
        text += `\n${sep}\n\n`;
      }
      
      if (data.exclusions && data.exclusions.length > 0) {
        text += `\`EXCLUSIONS:\`\n`;
        data.exclusions.forEach((item: string) => { text += `• ${item}\n`; });
        text += `\n${sep}\n\n`;
      }
    } else {
      // General list pricing if no option selected
      text += `\uD83D\uDCB0 *PRICING OPTIONS:*\n`;
      Object.entries(itin.pricing_data as Record<string, any>).forEach(([k, v]) => {
        text += `• ${OPTION_META[k]?.label ?? k}: $${v?.price_usd ?? '—'} / ₹${(v?.price ?? v)?.toLocaleString()}\n`;
      });
      text += `\n${sep}\n\n`;
    }

    const allNotes = [];
    if (itin.important_notes) allNotes.push(itin.important_notes);
    // Link for Bali Arrival Card removed from Sales/Followup stage (pre-confirmation)

    if (allNotes.length > 0) {
      text += `\`\uD83D\uDCCC IMPORTANT NOTES:\`\n`;
      allNotes.forEach(note => { text += `• ${note}\n`; });
      text += `\n${sep}\n\n`;
    }
    
    text += `*NOMADLLER PVT LTD*\n\u2728 *Explore the Unexplored*`;

    const msg = encodeURIComponent(text);
    const n = viewLead.contact_no.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${n}&text=${msg}`).catch(() =>
      Alert.alert('WhatsApp not installed'));
  }

  function handleShareNewItinerary() {
    // Re-use logic for consistency
    const targetLead = updateLead;
    const targetItinId = fNewItinId || updateLead?.itinerary_id;
    const targetOption = fNewItinOption || updateLead?.itinerary_option;

    if (!targetLead || !targetItinId) {
      Alert.alert('Selection Required', 'Please select an itinerary first.');
      return;
    }

    const itin = itineraries.find(i => i.id === targetItinId);
    if (!itin) return;

    const isBali = (targetLead.destination || '').toLowerCase().includes('bali');
    const sep = "━━━━━━━━━━━━━━━━━━";
    
    let text = `🌴 *NOMADLLER PVT LTD – ${(targetLead.destination || 'TRIP').toUpperCase()}* 🇮🇩\n\n`;
    const optionLabel = targetOption ? (OPTION_META[targetOption]?.label ?? targetOption) : null;
    text += `✨ *${itin.title} ${optionLabel ? `WITH ${optionLabel.toUpperCase()}` : ''}*\n\n`;
    
    if (targetOption && itin.pricing_data[targetOption]) {
      const data: any = itin.pricing_data[targetOption];
      text += `💰 *PACKAGE COST:*\n`;
      if (data?.price_usd) {
        text += `• USD ${data.price_usd.toLocaleString()} per person\n\n`;
      } else {
        text += `• ₹${(data?.price ?? data)?.toLocaleString()}\n\n`;
      }
      
      text += `👥 *Pax:* 2 Adults (Standard)\n`;
      text += `📅 *Travel Dates:* As per availability\n\n`;
      text += `${sep}\n\n`;
      text += `📍 *ROUTE*\n${targetLead.destination || 'Scenic Tour'}\n\n`;
      text += `${sep}\n\n`;

      if (itin.description) {
        const days = itin.description.split('\n\n');
        days.forEach(day => {
          if (day.trim()) {
            text += `${day.trim()}\n\n`;
            text += `${sep}\n\n`;
          }
        });
      }

      if (data.inclusions && data.inclusions.length > 0) {
        text += `\`INCLUSIONS:\`\n`;
        data.inclusions.forEach((item: string) => { text += `• ${item}\n`; });
        text += `\n${sep}\n\n`;
      }
      
      if (data.exclusions && data.exclusions.length > 0) {
        text += `\`EXCLUSIONS:\`\n`;
        data.exclusions.forEach((item: string) => { text += `• ${item}\n`; });
        text += `\n${sep}\n\n`;
      }
    } else {
      text += `💰 *PRICING OPTIONS:*\n`;
      Object.entries(itin.pricing_data as Record<string, any>).forEach(([k, v]) => {
        text += `• ${OPTION_META[k]?.label ?? k}: $${v?.price_usd ?? '—'} / ₹${(v?.price ?? v)?.toLocaleString()}\n`;
      });
      text += `\n${sep}\n\n`;
    }

    const allNotes = [];
    if (itin.important_notes) allNotes.push(itin.important_notes);
    // Bali Arrival Card link removed from Sales Update stage

    if (allNotes.length > 0) {
      text += `\`📌 IMPORTANT NOTES:\`\n`;
      allNotes.forEach(note => { text += `• ${note}\n`; });
      text += `\n${sep}\n\n`;
    }
    
    text += `*NOMADLLER PVT LTD*\n✨ *Explore the Unexplored*`;

    const msg = encodeURIComponent(text);
    const n = targetLead.contact_no.replace(/\D/g, '');
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
      const totalUSD = parseFloat(fTotal) || 0;
      const advanceUSD = parseFloat(fAdvance) || 0;
      const dueUSD = totalUSD - advanceUSD;
      
      // Auto-populate INR fields using liveRate for backend consistency
      const totalINR = Math.round(totalUSD * liveRate);
      const advanceINR = Math.round(advanceUSD * liveRate);

      const destObj = destinations.find(d => d.name === updateLead.destination);
      const ids = destObj?.checklist?.split(',').filter(Boolean) || [];
      const hasFlights = ids.includes('flights');
      const hasTrain = ids.includes('train');
      const hasBus = ids.includes('bus');
      let activeMode = fTransportMode;
      // If none selected, fallback to whatever is available
      if (!activeMode) {
        if (hasFlights) activeMode = 'flights';
        else if (hasTrain) activeMode = 'train';
        else if (hasBus) activeMode = 'bus';
      }

      const { error: insertError } = await supabase.from('confirmed_bookings').insert({
        lead_id: updateLead.id,
        itinerary_id: updateLead.itinerary_id || null,
        total_amount: totalINR, 
        advance_paid: advanceINR, 
        due_amount: totalINR - advanceINR,
        total_amount_usd: totalUSD,
        due_amount_usd: dueUSD,
        passport_no: fPassportNo, passport_name: fPassportName, pan_no: fPanNo,
        arr_pnr: fArrPNR,
        arr_flight_no: fArrFlight, arr_dep_place: fArrDepPlace,
        arr_dep_date: fArrDepDate || null, arr_dep_time: fArrDepTime || null,
        arr_arr_airport: fArrArrAirport, arr_arr_date: fArrArrDate || null, arr_arr_time: fArrArrTime || null,
        dep_pnr: fDepPNR,
        dep_flight_no: fDepFlight, dep_dep_place: fDepDepPlace,
        dep_dep_date: fDepDepDate || null, dep_dep_time: fDepDepTime || null,
        dep_arr_airport: fDepArrAirport, dep_arr_date: fDepArrDate || null, dep_arr_time: fDepArrTime || null,
        arr_train_pnr: fArrTrainPnr, arr_train_no: fArrTrainNo, arr_train_name: fArrTrainName,
        arr_train_dep_place: fArrTrainDepPlace,
        arr_train_arr_station: fArrTrainArrStation,
        arr_train_dep_date: fArrTrainDepDate || null, 
        arr_train_dep_time: fArrTrainDepTime,
        arr_train_arr_date: fArrTrainArrDate || null,
        arr_train_arr_time: fArrTrainArrTime,
        dep_train_pnr: fDepTrainPnr, dep_train_no: fDepTrainNo, dep_train_name: fDepTrainName,
        dep_train_dep_place: fDepTrainDepPlace,
        dep_train_dep_date: fDepTrainDepDate || null, 
        dep_train_dep_time: fDepTrainDepTime,
        dep_train_arr_station: fDepTrainArrStation, 
        dep_train_arr_date: fDepTrainArrDate || null,
        dep_train_arr_time: fDepTrainArrTime,
        arr_bus_name: fArrBusName, arr_bus_dep_station: fArrBusDepStation, arr_bus_dep_date: fArrBusDepDate || null, arr_bus_dep_time: fArrBusDepTime,
        arr_bus_arr_station: fArrBusArrStation, arr_bus_arr_date: fArrBusArrDate || null, arr_bus_arr_time: fArrBusArrTime, arr_bus_operator_contact: fArrBusOperatorContact,
        dep_bus_name: fDepBusName, dep_bus_dep_station: fDepBusDepStation, dep_bus_dep_date: fDepBusDepDate || null, dep_bus_dep_time: fDepBusDepTime,
        dep_bus_arr_station: fDepBusArrStation, dep_bus_arr_date: fDepBusArrDate || null, dep_bus_arr_time: fDepBusArrTime, dep_bus_operator_contact: fDepBusOperatorContact,
        region: fRegion, guest_list: fGuestList, guest_pax: fPax,
        travel_start_date: (activeMode === 'flights' ? fArrDepDate : (activeMode === 'train' ? fArrTrainDepDate : (activeMode === 'bus' ? fArrBusDepDate : null))) || null,
        travel_end_date: (activeMode === 'flights' ? fDepArrDate : (activeMode === 'train' ? fDepTrainDepDate : (activeMode === 'bus' ? fDepBusDepDate : null))) || null,
        checklist: activeMode ? { transport_mode: activeMode } : (
          (fArrPNR || fDepPNR) ? { transport_mode: 'flights' } : (
            (fArrTrainNo || fDepTrainNo) ? { transport_mode: 'train' } : (
              (fArrBusName || fDepBusName) ? { transport_mode: 'bus' } : {}
            )
          )
        ),
      });

      if (insertError) {
        console.error('Insert Booking Error:', insertError);
        Alert.alert('Error Saving Booking', 'Lead was converted but booking details failed to save: ' + insertError.message);
      }
    }

    setSaving(false); setUpdateModal(false); fetchFollowups();
    const msgs: Record<string, string> = {
      followup: 'Follow-up rescheduled!', itinerary_sent: 'Follow-up rescheduled.',
      itinerary_updated: 'Itinerary updated!', different_location: 'Lead returned to Admin.',
      advance_paid: '🎉 Booking Confirmed!', dead: 'Lead marked as Dead.',
    };
    Alert.alert('✅ Saved', msgs[fStatus] ?? 'Updated!');
  }

  // ── Ticket Parser Logic ──────────────────────────────────────────────────
  async function handleAutoFill(type: 'arrival' | 'departure') {
    console.log("AI Auto-fill triggered for:", type);
    pickFile(type);
  }

  async function pickImage(type: 'arrival' | 'departure') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) {
      processTicket(result.assets[0].uri, 'image/jpeg', type);
    }
  }

  async function pickFile(type: 'arrival' | 'departure') {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
    });
    if (!result.canceled) {
      processTicket(result.assets[0].uri, result.assets[0].mimeType || 'application/pdf', type);
    }
  }

  async function processTicket(uri: string, mime: string, type: 'arrival' | 'departure') {
    setParsing(true);
    const data = await parseTicketFile(uri, mime);
    setParsing(false);

    console.log("✨ AI Raw Data:", data);

    if (data) {
      const legs = Array.isArray(data) ? data : [data];
      console.log("🛠️ Processing Legs:", legs);

      legs.forEach((leg, index) => {
        if (!leg) return;
        
        // Auto-switch transport mode based on the first valid leg
        if (index === 0) {
          if (leg.transport_type === 'flight') setFTransportMode('flights');
          else if (leg.transport_type === 'train') setFTransportMode('train');
          else if (leg.transport_type === 'bus') setFTransportMode('bus');
        }

        // If we have multiple legs, and this is the second one (index 1), 
        // OR if the source/destination names suggest it's the return trip,
        // we fill the Departure section.
        const isReturn = index === 1 || (legs.length === 1 && type === 'departure');

        if (!isReturn) {
          // Fill Arrival Section
          if (leg.pnr) { setFArrPNR(leg.pnr); setFArrTrainPnr(leg.pnr); }
          if (leg.number) { setFArrFlight(leg.number); setFArrTrainNo(leg.number); }
          if (leg.name) { setFArrTrainName(leg.name); setFArrBusName(leg.name); }
          if (leg.operator_contact) { setFArrBusOperatorContact(leg.operator_contact); }
          if (leg.dep_place) { setFArrDepPlace(leg.dep_place); setFArrTrainDepPlace(leg.dep_place); setFArrBusDepStation(leg.dep_place); }
          if (leg.dep_date) { setFArrDepDate(leg.dep_date); setFArrTrainDepDate(leg.dep_date); setFArrBusDepDate(leg.dep_date); }
          if (leg.dep_time) { setFArrDepTime(leg.dep_time); setFArrTrainDepTime(leg.dep_time); setFArrBusDepTime(leg.dep_time); }
          if (leg.arr_place) { setFArrArrAirport(leg.arr_place); setFArrTrainArrStation(leg.arr_place); setFArrBusArrStation(leg.arr_place); }
          if (leg.arr_date) { setFArrArrDate(leg.arr_date); setFArrTrainArrDate(leg.arr_date); setFArrBusArrDate(leg.arr_date); }
          if (leg.arr_time) { setFArrArrTime(leg.arr_time); setFArrTrainArrTime(leg.arr_time); setFArrBusArrTime(leg.arr_time); }
        } else {
          // Fill Departure Section
          if (leg.pnr) { setFDepPNR(leg.pnr); setFDepTrainPnr(leg.pnr); }
          if (leg.number) { setFDepFlight(leg.number); setFDepTrainNo(leg.number); }
          if (leg.name) { setFDepTrainName(leg.name); setFDepBusName(leg.name); }
          if (leg.operator_contact) { setFDepBusOperatorContact(leg.operator_contact); }
          if (leg.dep_place) { setFDepDepPlace(leg.dep_place); setFDepTrainDepPlace(leg.dep_place); setFDepBusDepStation(leg.dep_place); }
          if (leg.dep_date) { setFDepDepDate(leg.dep_date); setFDepTrainDepDate(leg.dep_date); setFDepBusDepDate(leg.dep_date); }
          if (leg.dep_time) { setFDepDepTime(leg.dep_time); setFDepTrainDepTime(leg.dep_time); setFDepBusDepTime(leg.dep_time); }
          if (leg.arr_place) { setFDepArrAirport(leg.arr_place); setFDepTrainArrStation(leg.arr_place); setFDepBusArrStation(leg.arr_place); }
          if (leg.arr_date) { setFDepArrDate(leg.arr_date); setFDepTrainArrDate(leg.arr_date); setFDepBusArrDate(leg.arr_date); }
          if (leg.arr_time) { setFDepArrTime(leg.arr_time); setFDepTrainArrTime(leg.arr_time); setFDepBusArrTime(leg.arr_time); }
        }
      });
      Alert.alert('✨ Success', ` Extracted ${legs.length} journey legs successfully!`);
    } else {
      Alert.alert('Error', 'Failed to extract data. Please ensure the ticket is clear.');
    }
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
                        <View key={k} style={{ borderWidth: 1, borderColor: meta.color + '33', borderRadius: R.md, padding: 12, backgroundColor: C.surface2 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 8, marginBottom: 8 }}>
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
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={s.modal}
        >
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
                          <View style={{ marginTop: 8, padding: 12, backgroundColor: C.surface2, borderRadius: R.sm, borderWidth: 1, borderColor: C.border }}>
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
                  <View style={{ marginBottom: 10, padding: 10, backgroundColor: C.surface2, borderRadius: R.xs, borderWidth: 1, borderColor: C.border }}>
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
                <FField label="Region / Citizens (e.g. Indian, Europe)" value={fRegion} onChange={setFRegion} placeholder="Indian" />
                <View style={{ gap: 5 }}>
                  <Text style={s.fieldLabel}>Guest List (Names - one per line)</Text>
                  <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} value={fGuestList} onChangeText={setFGuestList} placeholder="Siby Khader&#10;Yasmin Khader" multiline numberOfLines={4} placeholderTextColor="#475569" />
                </View>
                <FField label="No of PAX" value={fPax} onChange={setFPax} placeholder="2" keyboardType="numeric" />
               <FField label="Total Amount ($)" value={fTotal} onChange={setFTotal} placeholder="1000" keyboardType="numeric" />
                <FField label="Advance Paid ($)" value={fAdvance} onChange={setFAdvance} placeholder="500" keyboardType="numeric" />
                {fTotal && fAdvance ? (
                  <View style={s.dueRow}>
                    <Text style={s.dueLabel}>Due Amount</Text>
                    <Text style={s.dueAmt}>${(parseFloat(fTotal) - parseFloat(fAdvance)).toLocaleString()}</Text>
                  </View>
                ) : null}

                <Text style={s.subHeading}>🛂 Passport</Text>
                <FField label="Passport No" value={fPassportNo} onChange={setFPassportNo} placeholder="A1234567" />
                <FField label="Name (as on Passport)" value={fPassportName} onChange={setFPassportName} placeholder="JOHN DOE" autoCapitalize="characters" />
                <FField label="PAN Card No" value={fPanNo} onChange={setFPanNo} placeholder="ABCDE1234F" autoCapitalize="characters" />

                {(() => {
                  const leadDest = (updateLead?.destination || '').trim().toLowerCase();
                  const destObj = destinations.find(d => (d.name || '').trim().toLowerCase() === leadDest);
                  const rawChecklist = destObj?.checklist || '';
                  const ids = rawChecklist.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);

                  const hasFlights = ids.includes('flights');
                  const hasTrain = ids.includes('train');
                  const hasBus = ids.includes('bus');

                  const transportCount = [hasFlights, hasTrain, hasBus].filter(Boolean).length;
                  const showSelector = transportCount > 1;

                  const showFlights = hasFlights && (!showSelector || fTransportMode === 'flights');
                  const showTrain = hasTrain && (!showSelector || fTransportMode === 'train');
                  const showBus = hasBus && (!showSelector || fTransportMode === 'bus');

                  return (
                    <>
                      {transportCount > 0 && !showSelector && <View style={{ height: 10 }} />}
                      {transportCount > 1 && (
                        <View style={{ gap: 10, marginTop: 10 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.subHeading}>🔄 Select Transport Mode</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                             {hasFlights && (
                             <TouchableOpacity 
                               style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: fTransportMode === 'flights' ? C.primary : C.border, backgroundColor: fTransportMode === 'flights' ? C.primaryLight : C.surface, alignItems: 'center' }}
                               onPress={() => setFTransportMode('flights')}
                             >
                                <Ionicons name="airplane" size={24} color={fTransportMode === 'flights' ? C.primary : C.textMuted} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: fTransportMode === 'flights' ? C.primary : C.textSecond, marginTop: 4 }}>FLIGHT</Text>
                             </TouchableOpacity>
                             )}
                             {hasTrain && (
                             <TouchableOpacity 
                               style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: fTransportMode === 'train' ? C.primary : C.border, backgroundColor: fTransportMode === 'train' ? C.primaryLight : C.surface, alignItems: 'center' }}
                               onPress={() => setFTransportMode('train')}
                             >
                                <Ionicons name="train" size={24} color={fTransportMode === 'train' ? C.primary : C.textMuted} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: fTransportMode === 'train' ? C.primary : C.textSecond, marginTop: 4 }}>TRAIN</Text>
                             </TouchableOpacity>
                             )}
                             {hasBus && (
                             <TouchableOpacity 
                               style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: fTransportMode === 'bus' ? C.primary : C.border, backgroundColor: fTransportMode === 'bus' ? C.primaryLight : C.surface, alignItems: 'center' }}
                               onPress={() => setFTransportMode('bus')}
                             >
                                <Ionicons name="bus" size={24} color={fTransportMode === 'bus' ? C.primary : C.textMuted} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: fTransportMode === 'bus' ? C.primary : C.textSecond, marginTop: 4 }}>BUS</Text>
                             </TouchableOpacity>
                             )}
                          </View>
                        </View>
                      )}

                      {showFlights && (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 5 }}>
                            <Text style={s.subHeading}>✈️ Arrival Flight (India → Destination)</Text>
                            <TouchableOpacity 
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#8b5cf615', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#8b5cf644' }}
                              onPress={() => handleAutoFill('arrival')}
                              disabled={parsing}
                            >
                              {parsing ? <ActivityIndicator size="small" color="#8b5cf6" /> : <Ionicons name="sparkles" size={12} color="#8b5cf6" />}
                              <Text style={{ color: '#8b5cf6', fontSize: 10, fontWeight: '800' }}>✨ AUTO-FILL</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Arrival PNR" value={fArrPNR} onChange={setFArrPNR} placeholder="PNR" autoCapitalize="characters" /></View>
                            <View style={{ flex: 1 }}><FField label="Flight No" value={fArrFlight} onChange={setFArrFlight} placeholder="6E 2345" autoCapitalize="characters" /></View>
                          </View>
                          <FField label="Departure Place" value={fArrDepPlace} onChange={setFArrDepPlace} placeholder="Cochin Airport" suggestions={TRIP_PLACE_SUGGESTIONS} />
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Date (YYYY-MM-DD)" value={fArrDepDate} onChange={handleArrDepDateChange} placeholder="2026-05-10" /></View>
                            <View style={{ width: 105 }}><FField label="Dep Time" value={fArrDepTime} onChange={setFArrDepTime} placeholder="06:30" /></View>
                          </View>
                          <FField label="Arrival Airport" value={fArrArrAirport} onChange={setFArrArrAirport} placeholder="Denpasar Airport" suggestions={TRIP_PLACE_SUGGESTIONS} />
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Arr Date (YYYY-MM-DD)" value={fArrArrDate} onChange={setFArrArrDate} placeholder="2026-05-10" /></View>
                            <View style={{ width: 105 }}><FField label="Arr Time" value={fArrArrTime} onChange={setFArrArrTime} placeholder="10:30" /></View>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 5 }}>
                            <Text style={s.subHeading}>✈️ Departure Flight (Destination → India)</Text>
                            <TouchableOpacity 
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#8b5cf615', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#8b5cf644' }}
                              onPress={() => handleAutoFill('departure')}
                              disabled={parsing}
                            >
                              {parsing ? <ActivityIndicator size="small" color="#8b5cf6" /> : <Ionicons name="sparkles" size={12} color="#8b5cf6" />}
                              <Text style={{ color: '#8b5cf6', fontSize: 10, fontWeight: '800' }}>✨ AUTO-FILL</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Departure PNR" value={fDepPNR} onChange={setFDepPNR} placeholder="PNR" autoCapitalize="characters" /></View>
                            <View style={{ flex: 1 }}><FField label="Flight No" value={fDepFlight} onChange={setFDepFlight} placeholder="6E 2346" autoCapitalize="characters" /></View>
                          </View>
                          <FField label="Departure Place" value={fDepDepPlace} onChange={setFDepDepPlace} placeholder="Denpasar Airport" suggestions={TRIP_PLACE_SUGGESTIONS} />
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Date (YYYY-MM-DD)" value={fDepDepDate} onChange={setFDepDepDate} placeholder="2026-05-15" /></View>
                            <View style={{ width: 105 }}><FField label="Dep Time" value={fDepDepTime} onChange={setFDepDepTime} placeholder="14:00" /></View>
                          </View>
                          <FField label="Arrival Airport" value={fDepArrAirport} onChange={setFDepArrAirport} placeholder="Cochin Airport" suggestions={TRIP_PLACE_SUGGESTIONS} />
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Arr Date (YYYY-MM-DD)" value={fDepArrDate} onChange={setFDepArrDate} placeholder="2026-05-15" /></View>
                            <View style={{ width: 105 }}><FField label="Arr Time" value={fDepArrTime} onChange={setFDepArrTime} placeholder="19:30" /></View>
                          </View>
                        </>
                      )}

                      {showTrain && (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 5 }}>
                            <Text style={s.subHeading}>🚆 Arrival Train ({updateLead?.destination})</Text>
                            <TouchableOpacity 
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#8b5cf615', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#8b5cf644' }}
                              onPress={() => handleAutoFill('arrival')}
                              disabled={parsing}
                            >
                              {parsing ? <ActivityIndicator size="small" color="#8b5cf6" /> : <Ionicons name="sparkles" size={12} color="#8b5cf6" />}
                              <Text style={{ color: '#8b5cf6', fontSize: 10, fontWeight: '800' }}>✨ AUTO-FILL</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="PNR" value={fArrTrainPnr} onChange={setFArrTrainPnr} placeholder="PNR" autoCapitalize="characters" /></View>
                            <View style={{ flex: 1 }}><FField label="Train No" value={fArrTrainNo} onChange={setFArrTrainNo} placeholder="12626" /></View>
                          </View>
                          <FField label="Train Name" value={fArrTrainName} onChange={setFArrTrainName} placeholder="Kerala Express" />
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Place (India)" value={fArrTrainDepPlace} onChange={setFArrTrainDepPlace} placeholder="New Delhi" suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                            <View style={{ flex: 1 }}><FField label="Arr Place" value={fArrTrainArrStation} onChange={setFArrTrainArrStation} placeholder="Manali" suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Date" value={fArrTrainDepDate} onChange={handleArrTrainDepDateChange} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ width: 105 }}><FField label="Dep Time" value={fArrTrainDepTime} onChange={setFArrTrainDepTime} placeholder="11:30" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Arr Date" value={fArrTrainArrDate} onChange={setFArrTrainArrDate} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ width: 105 }}><FField label="Arr Time" value={fArrTrainArrTime} onChange={setFArrTrainArrTime} placeholder="19:30" /></View>
                          </View>
                          
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 5 }}>
                            <Text style={[s.subHeading, { marginTop: 0, marginBottom: 0 }]}>🚆 Departure Train (To India)</Text>
                            <TouchableOpacity onPress={() => {
                                setFDepTrainPnr(fArrTrainPnr);
                                setFDepTrainNo(fArrTrainNo);
                                setFDepTrainName(fArrTrainName);
                                setFDepTrainDepPlace(fArrTrainArrStation);
                                setFDepTrainArrStation(fArrTrainDepPlace);
                            }} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
                              <Text style={{ fontSize: 10, color: C.primary, fontWeight: '800' }}>SAME AS ARRIVAL</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="PNR" value={fDepTrainPnr} onChange={setFDepTrainPnr} placeholder="PNR" autoCapitalize="characters" /></View>
                            <View style={{ flex: 1 }}><FField label="Train No" value={fDepTrainNo} onChange={setFDepTrainNo} placeholder="12625" /></View>
                          </View>
                          <FField label="Train Name" value={fDepTrainName} onChange={setFDepTrainName} placeholder="Kerala Express" />
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Place" value={fDepTrainDepPlace} onChange={setFDepTrainDepPlace} placeholder="Manali" suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                            <View style={{ flex: 1 }}><FField label="Arr Station" value={fDepTrainArrStation} onChange={setFDepTrainArrStation} placeholder="New Delhi" suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Date" value={fDepTrainDepDate} onChange={setFDepTrainDepDate} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ width: 105 }}><FField label="Dep Time" value={fDepTrainDepTime} onChange={setFDepTrainDepTime} placeholder="14:00" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Arr Date" value={fDepTrainArrDate} onChange={setFDepTrainArrDate} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ width: 105 }}><FField label="Arr Time" value={fDepTrainArrTime} onChange={setFDepTrainArrTime} placeholder="22:00" /></View>
                          </View>
                        </>
                      )}

                      {showBus && (
                        <>
                          <Text style={s.subHeading}>🚌 Arrival Bus (To Destination)</Text>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Bus Name" value={fArrBusName} onChange={setFArrBusName} placeholder="Volvo AC Sleeper" /></View>
                            <View style={{ flex: 1 }}><FField label="Operator Contact" value={fArrBusOperatorContact} onChange={setFArrBusOperatorContact} placeholder="+91 9876543210" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Station" value={fArrBusDepStation} onChange={setFArrBusDepStation} placeholder="Bangalore" suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                            <View style={{ flex: 1 }}><FField label="Arr Station" value={fArrBusArrStation} onChange={setFArrBusArrStation} placeholder="Manali" suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Date" value={fArrBusDepDate} onChange={handleArrBusDepDateChange} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ width: 105 }}><FField label="Dep Time" value={fArrBusDepTime} onChange={setFArrBusDepTime} placeholder="18:30" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Arr Date" value={fArrBusArrDate} onChange={setFArrBusArrDate} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ width: 105 }}><FField label="Arr Time" value={fArrBusArrTime} onChange={setFArrBusArrTime} placeholder="06:30" /></View>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 5 }}>
                            <Text style={[s.subHeading, { marginTop: 0, marginBottom: 0 }]}>🚌 Departure Bus (To India)</Text>
                            <TouchableOpacity onPress={() => {
                                setFDepBusName(fArrBusName);
                                setFDepBusOperatorContact(fArrBusOperatorContact);
                                setFDepBusDepStation(fArrBusArrStation);
                                setFDepBusArrStation(fArrBusDepStation);
                            }} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
                              <Text style={{ fontSize: 10, color: C.primary, fontWeight: '800' }}>SAME AS ARRIVAL</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Bus Name" value={fDepBusName} onChange={setFDepBusName} placeholder="Volvo AC Sleeper" /></View>
                            <View style={{ flex: 1 }}><FField label="Operator Contact" value={fDepBusOperatorContact} onChange={setFDepBusOperatorContact} placeholder="+91 9876543210" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Station" value={fDepBusDepStation} onChange={setFDepBusDepStation} placeholder="Manali" suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                            <View style={{ flex: 1 }}><FField label="Arr Station" value={fDepBusArrStation} onChange={setFDepBusArrStation} placeholder="Bangalore" suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Dep Date" value={fDepBusDepDate} onChange={setFDepBusDepDate} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ width: 105 }}><FField label="Dep Time" value={fDepBusDepTime} onChange={setFDepBusDepTime} placeholder="19:30" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FField label="Arr Date" value={fDepBusArrDate} onChange={setFDepBusArrDate} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ width: 105 }}><FField label="Arr Time" value={fDepBusArrTime} onChange={setFDepBusArrTime} placeholder="08:00" /></View>
                          </View>
                        </>
                      )}
                    </>
                  );
                })()}
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
        </KeyboardAvoidingView>
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
function FField({ label, value, onChange, placeholder, keyboardType = 'default', autoCapitalize = 'sentences', suggestions = [] }: any) {
  const [showSug, setShowSug] = useState(false);
  const filtered = (value && suggestions.length > 0) ? suggestions.filter((s: string) => s.toLowerCase().includes(value.toLowerCase()) && s !== value).slice(0, 5) : [];

  return (
    <View style={{ gap: 6, marginBottom: 4, zIndex: showSug && filtered.length > 0 ? 100 : 1 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setShowSug(true)}
        onBlur={() => setTimeout(() => setShowSug(false), 200)}
      />
      {showSug && filtered.length > 0 && (
        <View style={{ position: 'absolute', top: 65, left: 0, right: 0, backgroundColor: C.surface, borderRadius: R.xs, overflow: 'hidden', borderWidth: 1, borderColor: C.border, elevation: 5, zIndex: 1000 }}>
          {filtered.map((sug: string, i: number) => (
            <TouchableOpacity key={i} style={{ padding: 12, borderBottomWidth: i === filtered.length - 1 ? 0 : 1, borderBottomColor: C.border }} onPress={() => {
              onChange(sug);
              setShowSug(false);
            }}>
              <Text style={{ color: C.textPrimary, fontSize: 13 }}>{sug}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  container: { flex: 1, backgroundColor: C.bg },
  list: { padding: S.lg, gap: 14, paddingBottom: 40 },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyTitle: { color: C.textMuted, fontSize: 17, fontWeight: '700' },
  emptyText: { color: C.textSecond, fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  // ── Card ──
  card: {
    backgroundColor: C.surface, borderRadius: R.lg, padding: S.lg, gap: 12,
    borderLeftWidth: 3, borderLeftColor: C.primary,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.primaryLight,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: C.primary, fontSize: 20, fontWeight: '800' },
  cardMid: { flex: 1, gap: 4 },
  leadName: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  contact: { color: C.green, fontSize: 13, fontWeight: '600' },
  meta: { color: C.textMuted, fontSize: 13 },
  countdownBadge: {
    borderWidth: 1.5, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 8,
    alignItems: 'center', gap: 2, minWidth: 68,
  },
  countdownDate: { fontSize: 13, fontWeight: '800' },
  countdownLabel: { fontSize: 12, fontWeight: '700' },
  countdownTime: { fontSize: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  remarksText: { color: C.textMuted, fontSize: 12, fontStyle: 'italic', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: R.sm },
  callBtn: { backgroundColor: '#2563eb' },
  waBtn: { backgroundColor: '#16a34a' },
  updateBtn: { backgroundColor: C.primary },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Modal ──
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: S.xl, paddingTop: S.xxl, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12, backgroundColor: C.surface },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800' },
  modalSub: { color: C.green, fontSize: 13, fontWeight: '600', marginTop: 2 },
  durationBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.green + '55' },
  durationText: { color: C.green, fontSize: 12, fontWeight: '700' },
  formContent: { padding: S.xl, gap: 14, paddingBottom: 40 },
  fieldLabel: { color: C.textSecond, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: R.sm, padding: 14, borderWidth: 1.5, borderColor: C.border },
  dropdownText: { color: C.textMuted, fontSize: 14 },
  box: { borderWidth: 1.5, borderRadius: R.lg, padding: 14, gap: 10 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface2, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  filterInput: { flex: 1, color: C.textPrimary, fontSize: 14 },
  itinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface2, borderRadius: R.sm, padding: 12, borderWidth: 1, borderColor: C.border },
  itinRowActive: { borderColor: C.amber },
  itinRowText: { color: C.textSecond, fontSize: 14, fontWeight: '600', flex: 1 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: R.sm, padding: 13, borderWidth: 1, borderColor: C.border },
  dateBtnText: { color: C.textMuted, fontSize: 14 },
  input: { backgroundColor: C.surface2, color: C.textPrimary, borderRadius: R.sm, padding: 13, fontSize: 14, borderWidth: 1.5, borderColor: C.border },
  hint: { color: C.textMuted, fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
  saveBtn: { backgroundColor: C.green, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', marginTop: 4, shadowColor: C.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: '#00000044', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: C.surface, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xl, gap: 2, paddingBottom: 40, borderTopWidth: 1, borderColor: C.border },
  pickerTitle: { color: C.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: S.sm },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 10, borderRadius: R.sm },
  pickerItemText: { flex: 1, color: C.textSecond, fontSize: 15 },
  boxHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boxTitle: { color: C.green, fontSize: 14, fontWeight: '700' },
  subHeading: { color: C.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 4 },
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.surface2, borderRadius: R.sm, padding: 12, borderWidth: 1, borderColor: C.border },
  dueLabel: { color: C.textMuted, fontSize: 13 },
  dueAmt: { color: C.amber, fontSize: 17, fontWeight: '700' },
  rowTwo: { flexDirection: 'row', gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  detailText: { color: C.textSecond, fontSize: 15 },
  callLogBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, padding: 12, borderRadius: R.sm, marginTop: 10, borderWidth: 1, borderColor: C.border },
});
