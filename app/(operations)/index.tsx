import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, TextInput, Platform, Switch, KeyboardAvoidingView, Linking

} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { C, R, S } from '@/lib/theme';
import { getLiveUsdRate } from '@/utils/liveRate';
import { TRIP_PLACE_SUGGESTIONS, CHECKLIST_ITEMS, OPTION_META } from '@/lib/salesConstants';
import { useAuth } from '@/contexts/AuthContext';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// ─── Types ────────────────────────────────────────────────────────────────────
type Lead = {
  id: string;
  name: string;
  contact_no: string;
  destination: string;
  status: string;
  assigned_to: string | null;
  ops_assigned_to: string | null;
  created_at: string;
  itinerary_id: string | null;
  itinerary_option: string | null;
  pax_count?: string | null;
};


type ConfirmedBooking = {
  id: string;
  lead_id: string;
  itinerary_id: string | null;
  total_amount: number;
  total_amount_usd?: number | null;
  advance_paid: number;
  advance_paid_usd?: number | null;
  due_amount: number;
  due_amount_usd?: number | null;
  
  // Guest Details
  guest_pax: number | null;
  guest_contact: string | null;
  guest_list: string | null;
  travel_start_date: string | null;
  travel_end_date: string | null;

  // ID Card
  id_card_type: string | null;
  id_card_no: string | null;
  id_card_name: string | null;

  passport_no: string | null;
  passport_name: string | null;
  pan_no?: string;
  checklist?: Record<string, any>;

  // Flight Details
  arr_pnr: string | null;
  arr_flight_no: string | null;
  arr_dep_place: string | null;
  arr_dep_date: string | null;
  arr_dep_time: string | null;
  arr_arr_airport: string | null;
  arr_arr_date: string | null;
  arr_arr_time: string | null;
  dep_pnr: string | null;
  dep_flight_no: string | null;
  dep_dep_place: string | null;
  dep_dep_date: string | null;
  dep_dep_time: string | null;
  dep_arr_airport: string | null;
  dep_arr_date: string | null;
  dep_arr_time: string | null;

  // Train Details (Arrival)
  arr_train_pnr: string | null;
  arr_train_no: string | null;
  arr_train_name: string | null;
  arr_train_dep_place: string | null;
  arr_train_dep_date: string | null;
  arr_train_dep_time: string | null;
  arr_train_arr_date: string | null;
  arr_train_arr_time: string | null;
  arr_train_arr_station: string | null;

  // Train Details (Departure)
  dep_train_pnr: string | null;
  dep_train_no: string | null;
  dep_train_name: string | null;
  dep_train_dep_place: string | null;
  dep_train_dep_date: string | null;
  dep_train_dep_time: string | null;
  dep_train_arr_station: string | null;
  dep_train_arr_date: string | null;
  dep_train_arr_time: string | null;

  // Bus Details (Arrival)
  arr_bus_name: string | null;
  arr_bus_dep_station: string | null;
  arr_bus_dep_date: string | null;
  arr_bus_dep_time: string | null;
  arr_bus_arr_station: string | null;
  arr_bus_arr_date: string | null;
  arr_bus_arr_time: string | null;
  arr_bus_operator_contact: string | null;

  // Bus Details (Departure)
  dep_bus_name: string | null;
  dep_bus_dep_station: string | null;
  dep_bus_dep_date: string | null;
  dep_bus_dep_time: string | null;
  dep_bus_arr_station: string | null;
  dep_bus_arr_date: string | null;
  dep_bus_arr_time: string | null;
  dep_bus_operator_contact: string | null;
};

type Itinerary = {
  id: string;
  title: string;
  pricing_data: any;
  description: string;
  important_notes?: string | null;
};


const TABS = [
  { key: 'ops', label: 'My Operations', icon: 'settings-outline' },
  { key: 'near', label: 'Near Departure', icon: 'time-outline' },
  { key: 'today', label: 'Today Departure', icon: 'calendar-outline' },
];

const DEFAULT_CHECKLIST = [
  { key: 'passport', label: 'Passport Collected' },
  { key: 'pan', label: 'PAN Card Collected' },
  { key: 'flights', label: 'Flight Details Collected' },
  { key: 'itinerary', label: 'Confirmed Itinerary' },
  { key: 'inc_exc', label: 'Check Inclusions/Exclusions' },
  { key: 'hotels', label: 'Hotel Accommodations' },
  { key: 'important_info', label: 'Important Information' },
  { key: 'payment', label: 'Payment (Total/Advance/Due)' },
  { key: 'pdf', label: 'PDF Share with Land Team' },
  { key: 'bus', label: 'Bus Details Collected' },
];

type Destination = { id: string; name: string; checklist?: string };

// ═══════════════════════════════════════════════════════════════════════════════
export default function OperationsScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ops');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Record<string, ConfirmedBooking>>({});
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [liveRate, setLiveRate] = useState<number | null>(null);

  // ── Modal State ──────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingBooking, setEditingBooking] = useState<ConfirmedBooking | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [hotelSuggestions, setHotelSuggestions] = useState<string[]>([]);
  const [roomTypeSuggestions, setRoomTypeSuggestions] = useState<string[]>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'Allocated')
      .eq('ops_assigned_to', profile.id);
    
    if (leadData) {
      setLeads(leadData);
      const leadIds = leadData.map(l => l.id);

      // Guard: skip query if no leads to avoid Supabase 406 on empty .in()
      if (leadIds.length > 0) {
        const { data: bookingData, error: bookingError } = await supabase
          .from('confirmed_bookings')
          .select('*')
          .in('lead_id', leadIds);

        if (bookingError) {
          console.error('BOOKING FETCH ERROR:', bookingError.message, bookingError.hint);
        }

        const bMap: Record<string, ConfirmedBooking> = {};
        bookingData?.forEach(b => {
          bMap[b.lead_id] = b;
        });
        setBookings(bMap);

        // Extract Global Suggestions from all bookings
        const hSet = new Set<string>();
        const rSet = new Set<string>();
        bookingData?.forEach(b => {
          if (b.checklist?.hotel_data) {
            (b.checklist.hotel_data as any[]).forEach(h => {
               if (h.name) hSet.add(h.name);
               if (h.roomType) rSet.add(h.roomType);
            });
          }
        });
        setHotelSuggestions(Array.from(hSet).sort());
        setRoomTypeSuggestions(Array.from(rSet).sort());
      }
    }

    const { data: itinData } = await supabase.from('itineraries').select('*');
    setItineraries(itinData ?? []);

    const { data: destData } = await supabase.from('destinations').select('id, name, checklist');
    setDestinations(destData ?? []);
    
    const rate = await getLiveUsdRate();
    setLiveRate(rate);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtering Logic ──────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0];

    return leads.filter(l => {
      const b = bookings[l.id];
      if (!b) return activeTab === 'ops';

      const depDate = b.arr_dep_date;
      if (!depDate) return activeTab === 'ops';

      if (activeTab === 'today') return depDate === todayStr;
      if (activeTab === 'near') return depDate > todayStr && depDate <= sevenDaysLaterStr;
      return true; // Ops shows everything
    });
  }, [leads, bookings, activeTab]);

  // ── Progress Helpers ──────────────────────────────────────────────────────
  const getDynamicChecklist = (destName?: string) => {
    const dest = destinations.find(d => d.name === destName);
    if (!dest?.checklist) return DEFAULT_CHECKLIST;
    
    let ids = dest.checklist.split(',').filter(Boolean);
    if (ids.length === 0) return DEFAULT_CHECKLIST;
    
    const hasFlights = ids.some(id => id.toLowerCase() === 'flights');
    const hasTrain = ids.some(id => id.toLowerCase() === 'train');
    const hasBus = ids.some(id => id.toLowerCase() === 'bus');

    if (hasFlights || hasTrain || hasBus) {
      // Find the first occurrence of ANY transport to place the unified step
      const firstIdx = ids.findIndex(id => ['flights', 'train', 'bus'].includes(id.toLowerCase()));
      // AGGRESSIVELY remove all legacy transport items
      ids = ids.filter(id => !['flights', 'train', 'bus'].includes(id.toLowerCase()));
      // Insert unified choice
      ids.splice(firstIdx > -1 ? firstIdx : ids.length, 0, 'transport_choice');
    }

    // Force strict ordering as requested
    const MASTER_ORDER = [
      'guests',
      'passport',
      'id_card',
      'transport_choice',
      'itinerary',
      'inc_exc',
      'hotels',
      'important_info',
      'info',
      'payment',
      'pdf'
    ];

    ids.sort((a, b) => {
      const idxA = MASTER_ORDER.indexOf(a.toLowerCase());
      const idxB = MASTER_ORDER.indexOf(b.toLowerCase());
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    const MODULAR_MAP: Record<string, string> = {
      'guests': 'Guest Details',
      'id_card': 'ID Card Details',
      'passport': 'Passport Details',
      'flights': 'Flight Details',
      'train': 'Train Details',
      'transport_choice': 'Transport Mode Details',
      'itinerary': 'Confirmed Itinerary',
      'inc_exc': 'Check Inclusions/Exclusions',
      'hotels': 'Hotel Accommodations',
      'important_info': 'Important Info',
      'info': 'Important Info',
      'payment': 'Payment & Settlement',
      'pdf': 'PDF Share with Team',
      'bus': 'Bus Details',
    };

    return ids.map(id => ({
      key: id,
      label: MODULAR_MAP[id] || id
    }));
  };

  const getProgress = (booking?: ConfirmedBooking, destName?: string) => {
    if (!booking?.checklist) return 0;
    const items = getDynamicChecklist(destName);
    const checkedCount = items.filter(item => booking.checklist?.[item.key]).length;
    return Math.round((checkedCount / items.length) * 100);
  };

  // ── Checklist Actions ────────────────────────────────────────────────────
  const toggleChecklist = (key: string) => {
    if (!editingBooking) return;
    const b = editingBooking;
    const newChecklist = { ...(b.checklist || {}) };
    newChecklist[key] = !newChecklist[key];
    setEditingBooking({ ...b, checklist: newChecklist });
  };

  const toggleExpand = (key: string) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Save Logic ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editingBooking) return;
    setSaving(true);
    // If itinerary changed, update lead record and set notification flag
    if (editingBooking.itinerary_id && editingBooking.itinerary_id !== selectedLead?.itinerary_id) {
      await supabase
        .from('leads')
        .update({ 
          itinerary_id: editingBooking.itinerary_id,
          ops_itinerary_edited: true // Notification flag for salesperson
        })
        .eq('id', selectedLead?.id);
    }

    const { error } = await supabase
      .from('confirmed_bookings')
      .update({
        pan_no: editingBooking.pan_no,
        checklist: editingBooking.checklist,
        
        // Guest Details
        guest_pax: editingBooking.guest_pax,
        guest_contact: editingBooking.guest_contact,
        guest_list: editingBooking.guest_list,
        travel_start_date: editingBooking.travel_start_date,
        travel_end_date: editingBooking.travel_end_date,

        // ID Card
        id_card_type: editingBooking.id_card_type,
        id_card_no: editingBooking.id_card_no,
        id_card_name: editingBooking.id_card_name,

        passport_no: editingBooking.passport_no,
        passport_name: editingBooking.passport_name,

        // Flight Details
        arr_pnr: editingBooking.arr_pnr,
        arr_flight_no: editingBooking.arr_flight_no,
        arr_dep_place: editingBooking.arr_dep_place,
        arr_dep_date: editingBooking.arr_dep_date,
        arr_dep_time: editingBooking.arr_dep_time,
        arr_arr_airport: editingBooking.arr_arr_airport,
        arr_arr_date: editingBooking.arr_arr_date,
        arr_arr_time: editingBooking.arr_arr_time,
        dep_pnr: editingBooking.dep_pnr,
        dep_flight_no: editingBooking.dep_flight_no,
        dep_dep_place: editingBooking.dep_dep_place,
        dep_dep_date: editingBooking.dep_dep_date,
        dep_dep_time: editingBooking.dep_dep_time,
        dep_arr_airport: editingBooking.dep_arr_airport,
        dep_arr_date: editingBooking.dep_arr_date,
        dep_arr_time: editingBooking.dep_arr_time,

        // Train Details
        arr_train_pnr: editingBooking.arr_train_pnr,
        arr_train_no: editingBooking.arr_train_no,
        arr_train_name: editingBooking.arr_train_name,
        arr_train_dep_place: editingBooking.arr_train_dep_place,
        arr_train_arr_station: editingBooking.arr_train_arr_station,
        arr_train_dep_date: editingBooking.arr_train_dep_date,
        arr_train_dep_time: editingBooking.arr_train_dep_time,
        arr_train_arr_date: editingBooking.arr_train_arr_date,
        arr_train_arr_time: editingBooking.arr_train_arr_time,
        dep_train_pnr: editingBooking.dep_train_pnr,
        dep_train_no: editingBooking.dep_train_no,
        dep_train_name: editingBooking.dep_train_name,
        dep_train_dep_place: editingBooking.dep_train_dep_place,
        dep_train_dep_date: editingBooking.dep_train_dep_date,
        dep_train_dep_time: editingBooking.dep_train_dep_time,
        dep_train_arr_station: editingBooking.dep_train_arr_station,
        dep_train_arr_date: editingBooking.dep_train_arr_date,
        dep_train_arr_time: editingBooking.dep_train_arr_time,

        // Bus Details
        arr_bus_name: editingBooking.arr_bus_name,
        arr_bus_dep_station: editingBooking.arr_bus_dep_station,
        arr_bus_dep_date: editingBooking.arr_bus_dep_date,
        arr_bus_dep_time: editingBooking.arr_bus_dep_time,
        arr_bus_arr_station: editingBooking.arr_bus_arr_station,
        arr_bus_arr_date: editingBooking.arr_bus_arr_date,
        arr_bus_arr_time: editingBooking.arr_bus_arr_time,
        arr_bus_operator_contact: editingBooking.arr_bus_operator_contact,
        dep_bus_name: editingBooking.dep_bus_name,
        dep_bus_dep_station: editingBooking.dep_bus_dep_station,
        dep_bus_dep_date: editingBooking.dep_bus_dep_date,
        dep_bus_dep_time: editingBooking.dep_bus_dep_time,
        dep_bus_arr_station: editingBooking.dep_bus_arr_station,
        dep_bus_arr_date: editingBooking.dep_bus_arr_date,
        dep_bus_arr_time: editingBooking.dep_bus_arr_time,
        dep_bus_operator_contact: editingBooking.dep_bus_operator_contact,

        total_amount: editingBooking.total_amount,
        total_amount_usd: editingBooking.total_amount_usd,
        due_amount_usd: editingBooking.due_amount_usd,
      })
      .eq('id', editingBooking.id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      // Re-fetch or update local state
      await fetchData();
      setModalOpen(false);
    }
    setSaving(false);
  };

  const generatePDF = async (lead: Lead, booking: ConfirmedBooking, action: 'print' | 'whatsapp' = 'print') => {
    const itin = itineraries.find(i => i.id === (booking.itinerary_id || lead.itinerary_id));
    const opt = lead.itinerary_option;
    const optData = (opt && itin?.pricing_data?.[opt]) ? (itin.pricing_data[opt] as any) : null;

    const html = `
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:wght@700&display=swap');
            * { box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; background: #ffffff; line-height: 1.4; }
            
            .header { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; position: relative; }
            .logo { font-family: 'Playfair Display', serif; font-size: 38px; color: #0f172a; letter-spacing: -1px; margin-bottom: 2px; }
            .manifest-type { font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 3px; text-transform: uppercase; }
            
            @page {
              size: auto;
              margin: 15mm 15mm 15mm 15mm;
            }

            @media print {
              body { padding: 0; margin: 0; }
              .header { page-break-after: avoid; }
              .section-title { page-break-after: avoid; }
              table { page-break-inside: avoid; }
              .timeline-item { page-break-inside: avoid; }
            }
            
            .trip-meta { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            .meta-item { text-align: center; }
            .meta-label { font-size: 9px; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin-bottom: 3px; }
            .meta-value { font-size: 14px; font-weight: 700; color: #0f172a; }

            .section-title { font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase; border-left: 5px solid #3b82f6; padding-left: 12px; margin: 30px 0 15px 0; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; background: #f1f5f9; padding: 10px 15px; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border: 1px solid #e2e8f0; }
            td { padding: 12px 15px; font-size: 13px; color: #334155; border: 1px solid #e2e8f0; vertical-align: top; }
            .bold { font-weight: 700; color: #0f172a; }

            .timeline { margin-top: 20px; position: relative; padding-left: 45px; }
            .timeline::before { content: ''; position: absolute; left: 20px; top: 0; bottom: 0; width: 2px; background: #e2e8f0; }
            .timeline-item { position: relative; margin-bottom: 25px; }
            .timeline-point { position: absolute; left: -33px; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: #3b82f6; border: 4px solid #ffffff; box-shadow: 0 0 0 2px #3b82f6; }
            .timeline-content { background: #ffffff; padding: 0; }
            .day-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 5px; page-break-after: avoid; }
            .day-desc { font-size: 13px; color: #475569; }

            .passenger-row { display: flex; gap: 30px; }
            .p-card { flex: 1; border: 2px solid #f1f5f9; padding: 15px; border-radius: 12px; background: #fff; }

            .footer { margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; }
            .legal { font-size: 10px; color: #94a3b8; }
            
            .stamp-container { position: relative; width: 200px; height: 80px; display: flex; align-items: center; justify-content: center; transform: rotate(-10deg); border: 4px double #10b981; color: #10b981; border-radius: 8px; margin-left: 50px; }
            .stamp-text { font-size: 24px; font-weight: 900; letter-spacing: 2px; }

            .finance-block { float: right; width: 350px; margin-top: 30px; }
            .fin-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
            .fin-row:last-child { border-bottom: none; }
            .fin-label { font-size: 12px; font-weight: 600; color: #64748b; }
            .fin-val { font-size: 14px; font-weight: 700; color: #0f172a; }
            .due-section { background: #fee2e2; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px solid #fecaca; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">NOMADLLER.</div>
            <div class="manifest-type">FIELD OPERATION MANIFEST</div>
          </div>

          <!-- SECTION 1: GUEST DETAILS -->
          <div class="section-title">1. Guest Profile & Travel Dates</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">Names of All Guests</th>
                <th style="width: 10%;">Pax</th>
                <th style="width: 20%;">Contact No</th>
                <th style="width: 25%;">Travel Dates</th>
                <th style="width: 15%;">Trip Code</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="bold" style="font-size: 11px;">${booking.guest_list || lead.name}</div></td>
                <td><div class="bold">${booking.guest_pax || '—'}</div></td>
                <td><div class="bold">${booking.guest_contact || lead.contact_no}</div></td>
                <td><div class="bold" style="color: #3b82f6;">${booking.travel_start_date || '—'} to ${booking.travel_end_date || '—'}</div></td>
                <td><div class="bold">NM-BK-${lead.id.substring(0, 5).toUpperCase()}</div></td>
              </tr>
            </tbody>
          </table>
          
          <table style="margin-top: -10px;">
            <thead>
              <tr>
                <th style="width: 30%;">ID Card Details (${booking.id_card_type || 'ID'})</th>
                <th style="width: 35%;">Passport Number</th>
                <th style="width: 35%;">PAN Number</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="bold">${booking.id_card_no || '—'}</div>
                  <div style="font-size: 10px; color: #64748b;">${booking.id_card_name || '—'}</div>
                </td>
                <td><div class="bold">${booking.passport_no || '—'}</div></td>
                <td><div class="bold">${booking.pan_no || '—'}</div></td>
              </tr>
            </tbody>
          </table>

          <!-- SECTION 2: FLIGHT DETAILS -->
          <div class="section-title">2a. Arrival & Departure Flight Details</div>
          <table>
            <thead>
              <tr>
                <th>PNR</th>
                <th>Phase</th>
                <th>Flight No</th>
                <th>Route</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="bold">${booking.arr_pnr || '—'}</div></td>
                <td><div class="bold" style="color: #10b981;">ARRIVAL</div></td>
                <td><div class="bold">${booking.arr_flight_no || '—'}</div></td>
                <td><div class="bold">${booking.arr_dep_place || '—'} → ${booking.arr_arr_airport || '—'}</div></td>
                <td><div class="bold">${booking.arr_dep_time || '—'} / ${booking.arr_arr_time || '—'}</div></td>
              </tr>
              <tr>
                <td><div class="bold">${booking.dep_pnr || '—'}</div></td>
                <td><div class="bold" style="color: #ef4444;">DEPARTURE</div></td>
                <td><div class="bold">${booking.dep_flight_no || '—'}</div></td>
                <td><div class="bold">${booking.dep_dep_place || '—'} → ${booking.dep_arr_airport || '—'}</div></td>
                <td><div class="bold">${booking.dep_dep_time || '—'} / ${booking.dep_arr_time || '—'}</div></td>
              </tr>
            </tbody>
          </table>

          <!-- SECTION 2b: TRAIN & BUS DETAILS -->
          ${(booking.checklist?.transport_mode === 'train') ? `
          <div class="section-title">2b. Arrival & Departure Train Details</div>
          <table>
            <thead>
              <tr>
                <th>PNR</th>
                <th>Phase</th>
                <th>Train Name / No</th>
                <th>Station / Place</th>
                <th>Time</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="bold">${booking.arr_train_pnr || '—'}</div></td>
                <td><div class="bold" style="color: #10b981;">ARRIVAL</div></td>
                <td><div class="bold">${booking.arr_train_name || '—'} (${booking.arr_train_no || '—'})</div></td>
                <td><div class="bold">${booking.arr_train_dep_place || '—'} - ${booking.arr_train_arr_station || '—'}</div></td>
                <td><div class="bold">${booking.arr_train_dep_time || '—'} - ${booking.arr_train_arr_time || '—'}</div></td>
                <td><div class="bold">${booking.arr_train_dep_date || '—'} - ${booking.arr_train_arr_date || '—'}</div></td>
              </tr>
              <tr>
                <td><div class="bold">${booking.dep_train_pnr || '—'}</div></td>
                <td><div class="bold" style="color: #6366f1;">DEPARTURE</div></td>
                <td><div class="bold">${booking.dep_train_name || '—'} (${booking.dep_train_no || '—'})</div></td>
                <td><div class="bold">${booking.dep_train_dep_place || '—'} - ${booking.dep_train_arr_station || '—'}</div></td>
                <td><div class="bold">${booking.dep_train_dep_time || '—'} - ${booking.dep_train_arr_time || '—'}</div></td>
                <td><div class="bold">${booking.dep_train_dep_date || '—'} - ${booking.dep_train_arr_date || '—'}</div></td>
              </tr>
            </tbody>
          </table>
          ` : ''}

          ${(booking.checklist?.transport_mode === 'bus') ? `
          <div class="section-title">2c. Arrival & Departure Bus Details</div>
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Bus Name / Operator</th>
                <th>Route (Dep → Arr)</th>
                <th>Time (Dep / Arr)</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="bold" style="color: #10b981;">ARRIVAL</div></td>
                <td>
                  <div class="bold">${booking.arr_bus_name || '—'}</div>
                  <div style="font-size: 10px; color: #64748b;">${booking.arr_bus_operator_contact || '—'}</div>
                </td>
                <td><div class="bold">${booking.arr_bus_dep_station || '—'} → ${booking.arr_bus_arr_station || '—'}</div></td>
                <td><div class="bold">${booking.arr_bus_dep_time || '—'} / ${booking.arr_bus_arr_time || '—'}</div></td>
                <td><div class="bold">${booking.arr_bus_dep_date || '—'}</div></td>
              </tr>
              <tr>
                <td><div class="bold" style="color: #6366f1;">DEPARTURE</div></td>
                <td>
                  <div class="bold">${booking.dep_bus_name || '—'}</div>
                  <div style="font-size: 10px; color: #64748b;">${booking.dep_bus_operator_contact || '—'}</div>
                </td>
                <td><div class="bold">${booking.dep_bus_dep_station || '—'} → ${booking.dep_bus_arr_station || '—'}</div></td>
                <td><div class="bold">${booking.dep_bus_dep_time || '—'} / ${booking.dep_bus_arr_time || '—'}</div></td>
                <td><div class="bold">${booking.dep_bus_dep_date || '—'}</div></td>
              </tr>
            </tbody>
          </table>
          ` : ''}

          ${(() => {
            const hotels = booking?.checklist?.hotel_data;
            if (!hotels || hotels.length === 0) return '';
            
            const grouped: any[] = [];
            let currentGroup: any = null;
            hotels.forEach((h: any, idx: number) => {
               if (!currentGroup) {
                   currentGroup = { checkIn: h.date, hotel: h.name, roomType: h.roomType, contact: h.contact, bookedByGuest: !!h.bookedByGuest, nights: 1, _startIdx: idx };
               } else if (currentGroup.hotel === h.name && currentGroup.hotel !== '' && currentGroup.roomType === h.roomType && currentGroup.bookedByGuest === !!h.bookedByGuest) {
                   currentGroup.nights += 1;
               } else {
                   const outDate = currentGroup.checkIn ? new Date(new Date(currentGroup.checkIn).getTime() + (currentGroup.nights * 86400000)).toISOString().split('T')[0] : '—';
                   currentGroup.checkOut = outDate;
                   grouped.push(currentGroup);
                   currentGroup = { checkIn: h.date, hotel: h.name, roomType: h.roomType, contact: h.contact, bookedByGuest: !!h.bookedByGuest, nights: 1, _startIdx: idx };
               }
            });
            if (currentGroup) {
               const outDate = currentGroup.checkIn ? new Date(new Date(currentGroup.checkIn).getTime() + (currentGroup.nights * 86400000)).toISOString().split('T')[0] : '—';
               currentGroup.checkOut = outDate;
               grouped.push(currentGroup);
            }

            return `
              <div class="section-title">3. Accommodations Summary</div>
              <table>
                <thead>
                  <tr>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hotel Name</th>
                    <th>Room Type</th>
                    <th>Contact No</th>
                  </tr>
                </thead>
                <tbody>
                  ${grouped.map((h: any) => `
                    <tr style="${h.bookedByGuest ? 'background-color: #f0f7ff; border-left: 4px solid #3b82f6;' : ''}">
                      <td><div class="bold">${h.checkIn || '—'}</div></td>
                      <td><div class="bold">${h.checkOut || '—'}</div></td>
                      <td>
                        <div class="bold">${h.hotel || '—'}</div>
                        ${h.bookedByGuest ? '<span style="font-size: 10px; color: #3b82f6; font-weight: 800;">[GUEST BOOKED]</span>' : ''}
                      </td>
                      <td>${h.bookedByGuest ? '<span style="color: #64748b; font-style: italic;">Self Booked</span>' : (h.roomType || '—')}</td>
                      <td>${h.contact || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          })()}

          <!-- SECTION: IMPORTANT INFORMATION -->
          ${(() => {
            const notes = booking?.checklist?.important_notes;
            if (!notes) return '';
            return `
              <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px; position: relative; page-break-inside: avoid;">
                <div style="position: absolute; top: -12px; left: 20px; background: #f59e0b; color: #fff; padding: 2px 12px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">IMPORTANT NOTICE</div>
                <div style="font-size: 14px; color: #92400e; font-weight: 700; line-height: 1.6; white-space: pre-wrap;">${notes}</div>
              </div>
            `;
          })()}

          <!-- SECTION: ITINERARY, INCLUSIONS & EXCLUSIONS -->
          <div class="section-title">${booking?.checklist?.hotel_data?.length ? '4.' : '3.'} Tour Itinerary & Conditions</div>
          <div style="padding: 15px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <div class="bold" style="font-size: 16px; margin-bottom: 5px;">${itin?.title || 'Tour Program'}</div>
            <div style="font-size: 12px; color: #64748b;">Variant: ${lead.itinerary_option?.toUpperCase()} transport inclusions apply.</div>
          </div>

          <div class="timeline">
            ${(() => {
              if (!itin?.description) return '<div class="day-desc">See separate itinerary document for day-wise breakdown.</div>';
              const lines = itin.description.split('\n');
              let htmlStr = '';
              let inDay = false;
              lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;
                
                const isDayHeader = trimmed.toLowerCase().includes('day ') && !trimmed.startsWith('-') && !trimmed.startsWith('•');

                if (isDayHeader) {
                  if (inDay) htmlStr += '</div></div>';
                  htmlStr += '<div class="timeline-item"><div class="timeline-point"></div><div class="timeline-content"><div class="day-title" style="font-size: 14px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">' + trimmed + '</div>';
                  inDay = true;
                } else {
                  if (!inDay) {
                     htmlStr += '<div class="timeline-item"><div class="timeline-point"></div><div class="timeline-content">';
                     inDay = true;
                  }
                  htmlStr += '<div class="day-desc" style="font-size: 12px; color: #475569; margin-bottom: 4px; padding-left: 10px;">' + trimmed + '</div>';
                }
              });
              if (inDay) htmlStr += '</div></div>';
              return htmlStr;
            })()}
          </div>

          <div style="display: flex; gap: 40px; margin-top: 30px; page-break-inside: avoid;">
            <div style="flex: 1;">
              <div style="font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; margin-bottom: 10px;">✅ Inclusions</div>
              <div style="font-size: 11px; color: #475569; line-height: 1.6;">
                ${optData?.inclusions?.map((i: string) => `• ${i}`).join('<br/>') || 'As per standard package.'}
              </div>
            </div>
            <div style="flex: 1;">
              <div style="font-size: 11px; font-weight: 800; color: #ef4444; text-transform: uppercase; margin-bottom: 10px;">❌ Exclusions</div>
              <div style="font-size: 11px; color: #475569; line-height: 1.6;">
                ${optData?.exclusions?.map((i: string) => `• ${i}`).join('<br/>') || 'Expenses of personal nature, laundry, tips, etc.'}
              </div>
            </div>
          </div>

          <!-- SECTION 4: PAYMENT DETAILS -->
          <div class="section-title">4. Financial Settlement Summary</div>
          <div style="clear: both; margin-top: 20px; overflow: hidden; page-break-inside: avoid;">
            <div style="float: left; margin-top: 10px;">
              <div class="stamp-container">
                <span class="stamp-text">${booking.checklist?.payment ? 'PAID' : 'RESERVED'}</span>
              </div>
            </div>
            
            <div class="finance-block">
              <div class="fin-row"><span class="fin-label">Total Package Value</span> <span class="fin-val">$${(booking.total_amount_usd || (opt && itin?.pricing_data?.[opt]?.price_usd) || (booking.total_amount / (liveRate || 85))).toFixed(2)}</span></div>
              <div class="fin-row"><span class="fin-label">Advance Received</span> <span class="fin-val" style="color: #64748b;">₹${booking.advance_paid?.toLocaleString()}</span></div>
              <div class="fin-row fin-total due-section">
                <span style="font-size: 11px; font-weight: 800; color: #ef4444;">BALANCE TO BE COLLECTED</span>
                <span style="font-size: 22px; font-weight: 900; color: #ef4444;">$${(booking.due_amount_usd || ((booking.total_amount_usd || (opt && itin?.pricing_data?.[opt]?.price_usd) || (booking.total_amount / (liveRate || 85))) - (booking.advance_paid / (liveRate || 85)))).toFixed(2)}</span>
                <div style="font-size: 9px; color: #ef4444; margin-top: 5px; opacity: 0.8;">Conversion Rate: $1 = ₹${liveRate || '—'}</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="legal">Nomadller Pvt Limited • Trip Manifest v2.0 • Admin Copy</div>
            <div class="legal">Contact HQ: operations@nomadller.com</div>
          </div>
        </body>
      </html>
    `;
    try {
      if (Platform.OS === 'web') {
        if (action === 'print') {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
              printWindow.print();
              printWindow.close();
            }, 500);
          } else {
            Alert.alert('Popup Blocked', 'Please allow popups to generate the PDF manifest.');
          }
        } else if (action === 'whatsapp') {
          const waText = window.encodeURIComponent(`*NOMADLLER TRIP MANIFEST*\n\nTrip Code: NM-BK-${lead.id.substring(0, 5).toUpperCase()}\nGuest: ${booking.passport_name || lead.name}\nTravel Dates: ${booking.arr_dep_date} to ${booking.dep_arr_date}\n\n*Please find the detailed PDF manifest attached.*`);
          window.open(`https://wa.me/?text=${waText}`, '_blank');
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        let finalUri = uri;
        
        try {
          const safeName = (lead.name || 'guest').replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const targetUri = `${(FileSystem as any).cacheDirectory}${safeName}_manifest.pdf`;
          await FileSystem.copyAsync({ from: uri, to: targetUri });
          finalUri = targetUri;
        } catch (renameErr) {
          console.error('Renaming failed, using default URI', renameErr);
        }
        
        await Sharing.shareAsync(finalUri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: action === 'whatsapp' ? 'Share Manifest via WhatsApp' : 'Save PDF Manifest' });
      }
      const newChecklist = { ...(booking.checklist || {}), pdf: true };
      await supabase.from('confirmed_bookings').update({ checklist: newChecklist }).eq('id', booking.id);
      fetchData();
    } catch (e) { Alert.alert('PDF Error', 'Failed to generate manifest.'); }
  };

  const shareItineraryWithGuest = async (lead: Lead, booking: ConfirmedBooking) => {
    const itin = itineraries.find(i => i.id === (booking.itinerary_id || lead.itinerary_id));
    const isBali = lead.destination?.toLowerCase().includes('bali');
    
    // Get inclusions/exclusions for the selected option
    const opt = lead.itinerary_option;
    const pricing = (itin && opt && itin.pricing_data?.[opt]) ? (itin.pricing_data[opt] as any) : null;
    const inclusions = pricing?.inclusions || [];
    const exclusions = pricing?.exclusions || [];
    
    const sep = "━━━━━━━━━━━━━━━━━━";
    
    let message = `*CONFIRMED TRIP MANIFEST – V2.1*\n\n`;
    message += `\uD83C\uDF34 *NOMADLLER PVT LTD – ${lead.destination.toUpperCase()}* \uD83C\uDDEE\uD83C\uDDE9\n\n`;
    const optionLabel = lead.itinerary_option ? (OPTION_META[lead.itinerary_option]?.label ?? lead.itinerary_option) : null;
    message += `\u2728 *${itin?.title} ${optionLabel ? `WITH ${optionLabel.toUpperCase()}` : ''}*\n\n`;
    
    message += `\uD83D\uDCB0 *PACKAGE COST:*\n`;
    if (booking.total_amount_usd) {
      const advanceUSD = booking.advance_paid_usd || (booking.advance_paid ? booking.advance_paid / 95 : 0);
      const dueUSD = booking.due_amount_usd || (booking.total_amount_usd - advanceUSD);
      
      message += `• USD ${booking.total_amount_usd.toLocaleString()} per person\n`;
      message += `• Advance Paid: USD ${advanceUSD.toLocaleString()}\n`;
      message += `• Balance Due: USD ${dueUSD.toLocaleString()}\n\n`;
    } else {
      // Fallback if USD is missing
      message += `• USD — (Please confirm with travel agent)\n\n`;
    }
    
    message += `\uD83D\uDC65 *Pax:* ${booking.guest_pax || lead.pax_count || '2 Adults'}\n`;
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

    const encoded = encodeURIComponent(message);
    const cleanPhone = lead.contact_no?.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;
    
    Linking.openURL(waUrl).catch(() => {
      Alert.alert("Error", "Could not open WhatsApp. Please ensure it is installed.");
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const renderLeadCard = ({ item }: { item: Lead }) => {
    const booking = bookings[item.id];
    const progress = getProgress(booking, item.destination);

    return (
      <View style={s.card}>
        <View style={s.progressBarBackground}>
          <View style={[s.progressBarFill, { width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : '#6366f1' }]} />
        </View>
        <View style={s.cardContent}>
          <View style={s.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.leadName}>{item.name}</Text>
              <Text style={s.destinationText}>{item.destination}</Text>
            </View>
            <View style={s.percentBadge}>
              <Text style={s.percentText}>{progress}%</Text>
            </View>
          </View>
          
          <View style={s.cardMetaRow}>
            <View style={s.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
              <Text style={s.metaText}>{booking?.arr_dep_date || 'TBD'}</Text>
            </View>
            <View style={s.metaItem}>
              <Ionicons name="cash-outline" size={14} color="#10b981" />
              <View>
                <Text style={[s.metaText, { color: '#10b981' }]}>₹{booking?.total_amount?.toLocaleString()}</Text>
                {booking?.total_amount_usd && (
                  <Text style={{ fontSize: 9, color: '#64748b', fontWeight: '700' }}>${booking.total_amount_usd.toFixed(2)}</Text>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={s.opsBtn} 
            onPress={() => {
              setSelectedLead(item);
              
              // Auto-calculate USD values if missing
              let updatedBooking = booking ? { ...booking } : null;
              if (updatedBooking && liveRate) {
                const itin = itineraries.find(i => i.id === (updatedBooking.itinerary_id || item.itinerary_id));
                const opt = item.itinerary_option;
                const priceUSD = (opt && itin?.pricing_data?.[opt]) ? (itin.pricing_data[opt] as any).price_usd : 0;
                
                if (!updatedBooking.total_amount_usd) {
                  updatedBooking.total_amount_usd = priceUSD;
                }
                const dueUSD = (updatedBooking.total_amount_usd || priceUSD) - (updatedBooking.advance_paid / liveRate);
                updatedBooking.due_amount_usd = dueUSD;
              }
              
              setEditingBooking(updatedBooking);
              setModalOpen(true);
            }}
          >
            <Ionicons name="settings-outline" size={16} color="#fff" />
            <Text style={s.opsBtnText}>OPERATIONS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* ── Tabs ── */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity 
            key={t.key} 
            style={[s.tab, activeTab === t.key && s.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons name={t.icon as any} size={18} color={activeTab === t.key ? '#6366f1' : '#64748b'} />
            <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={i => i.id}
          renderItem={renderLeadCard}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="documents-outline" size={48} color="#334155" />
              <Text style={s.emptyTitle}>No Operating Leads</Text>
              <Text style={s.emptyText}>Leads will appear here once they are 'Converted'.</Text>
            </View>
          }
        />
      )}

      {/* ── Operations Modal ── */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={s.modal}
        >
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{selectedLead?.name}</Text>
              <Text style={s.modalSub}>{selectedLead?.destination}</Text>
            </View>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Ionicons name="close" size={28} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalScroll}>
            {getDynamicChecklist(selectedLead?.destination).map((item, idx) => {
              if (!editingBooking) return null;
              const checked = editingBooking.checklist?.[item.key];
              return (
                <View key={item.key} style={s.checklistCard}>
                  <View style={s.checklistHeader}>
                    <TouchableOpacity onPress={() => toggleChecklist(item.key)}>
                      <Ionicons 
                        name={checked ? "checkbox" : "square-outline"} 
                        size={24} 
                        color={checked ? "#10b981" : "#64748b"} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleExpand(item.key)}>
                      <Text style={[s.checklistLabel, checked && s.checklistLabelDone]}>{idx + 1}. {item.label}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleExpand(item.key)}>
                       <Ionicons name={expandedItems[item.key] ? "chevron-up" : "chevron-down"} size={24} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  {expandedItems[item.key] && (
                    <View style={s.checklistContent}>
                      {item.key === 'guests' && (
                        <View style={{ gap: 10 }}>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Pax Count" value={String(editingBooking?.guest_pax || '')} onChange={(v: string) => setEditingBooking(p => p ? {...p, guest_pax: parseInt(v) || 0} : null)} placeholder="e.g. 2" keyboardType="numeric" /></View>
                            <View style={{ flex: 1 }}><FormField label="Contact No" value={editingBooking?.guest_contact || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, guest_contact: v} : null)} placeholder="e.g. +91 98765..." /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Start Date" value={editingBooking?.travel_start_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, travel_start_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="End Date" value={editingBooking?.travel_end_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, travel_end_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                          </View>
                          <FormField label="Names of All Guests" value={editingBooking?.guest_list || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, guest_list: v} : null)} placeholder="Guest 1, Guest 2..." multiline />
                        </View>
                      )}
                      {item.key === 'id_card' && (
                        <View style={{ gap: 10 }}>
                          <Text style={s.fieldLabel}>ID Card Type</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                            {['Aadhaar', 'Voter ID', 'Driving License', 'Passport', 'Other'].map(type => (
                              <TouchableOpacity 
                                key={type} 
                                onPress={() => setEditingBooking(p => p ? {...p, id_card_type: type} : null)}
                                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: editingBooking?.id_card_type === type ? C.primary : C.surface2, borderWidth: 1, borderColor: C.border }}
                              >
                                <Text style={{ fontSize: 11, color: editingBooking?.id_card_type === type ? '#fff' : C.textSecond, fontWeight: '700' }}>{type}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <FormField label="ID Number" value={editingBooking?.id_card_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, id_card_no: v} : null)} placeholder="Enter ID Number" />
                          <FormField label="Name on ID Card" value={editingBooking?.id_card_name || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, id_card_name: v} : null)} placeholder="Enter Full Name" />
                        </View>
                      )}
                      {item.key === 'passport' && (
                        <>
                          <FormField label="Passport Number" value={editingBooking?.passport_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, passport_no: v} : null)} placeholder="Enter Passport No" />
                          <FormField label="Name on Passport" value={editingBooking?.passport_name || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, passport_name: v} : null)} placeholder="Enter Full Name" />
                        </>
                      )}
                      {item.key === 'pan' && (
                        <FormField label="PAN Card Number" value={editingBooking?.pan_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, pan_no: v} : null)} placeholder="Enter PAN No" />
                      )}
                      {item.key === 'transport_choice' && (() => {
                        const dest = destinations.find(d => d.name === selectedLead?.destination);
                        const ids = dest?.checklist?.split(',').map(s => s.trim().toLowerCase()) || [];
                        const canFlight = ids.includes('flights');
                        const canTrain = ids.includes('train');
                        const canBus = ids.includes('bus');

                        return (
                          <View style={{ gap: 10 }}>
                            <Text style={s.fieldLabel}>Select Transport Mode</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                 {canFlight && (
                                   <TouchableOpacity 
                                     style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: editingBooking?.checklist?.transport_mode === 'flights' ? C.primary : C.border, backgroundColor: editingBooking?.checklist?.transport_mode === 'flights' ? C.primaryLight : C.surface, alignItems: 'center' }}
                                     onPress={() => setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, transport_mode: 'flights' } as any } : null)}
                                   >
                                      <Ionicons name="airplane" size={24} color={editingBooking?.checklist?.transport_mode === 'flights' ? C.primary : C.textMuted} />
                                      <Text style={{ fontSize: 10, fontWeight: '700', color: editingBooking?.checklist?.transport_mode === 'flights' ? C.primary : C.textSecond, marginTop: 4 }}>FLIGHT</Text>
                                   </TouchableOpacity>
                                 )}
                                 {canTrain && (
                                   <TouchableOpacity 
                                     style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: editingBooking?.checklist?.transport_mode === 'train' ? C.primary : C.border, backgroundColor: editingBooking?.checklist?.transport_mode === 'train' ? C.primaryLight : C.surface, alignItems: 'center' }}
                                     onPress={() => setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, transport_mode: 'train' } as any } : null)}
                                   >
                                      <Ionicons name="train" size={24} color={editingBooking?.checklist?.transport_mode === 'train' ? C.primary : C.textMuted} />
                                      <Text style={{ fontSize: 10, fontWeight: '700', color: editingBooking?.checklist?.transport_mode === 'train' ? C.primary : C.textSecond, marginTop: 4 }}>TRAIN</Text>
                                   </TouchableOpacity>
                                 )}
                                 {canBus && (
                                   <TouchableOpacity 
                                     style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: editingBooking?.checklist?.transport_mode === 'bus' ? C.primary : C.border, backgroundColor: editingBooking?.checklist?.transport_mode === 'bus' ? C.primaryLight : C.surface, alignItems: 'center' }}
                                     onPress={() => setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, transport_mode: 'bus' } as any } : null)}
                                   >
                                      <Ionicons name="bus" size={24} color={editingBooking?.checklist?.transport_mode === 'bus' ? C.primary : C.textMuted} />
                                      <Text style={{ fontSize: 10, fontWeight: '700', color: editingBooking?.checklist?.transport_mode === 'bus' ? C.primary : C.textSecond, marginTop: 4 }}>BUS</Text>
                                   </TouchableOpacity>
                                 )}
                            </View>
                            
                            {editingBooking?.checklist?.transport_mode === 'bus' && (
                               <View style={{ gap: 10 }}>
                                  <Text style={[s.fieldLabel, { color: C.primary, marginBottom: 5 }]}>🚌 Arrival Bus</Text>
                                  <FormField label="Bus Name / Number" value={editingBooking?.arr_bus_name || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_bus_name: v} : null)} />
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Dep Station" value={editingBooking?.arr_bus_dep_station || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_bus_dep_station: v} : null)} /></View>
                                    <View style={{ flex: 1 }}><FormField label="Arr Station" value={editingBooking?.arr_bus_arr_station || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_bus_arr_station: v} : null)} /></View>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Date" value={editingBooking?.arr_bus_dep_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_bus_dep_date: v, arr_bus_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                                    <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.arr_bus_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_bus_dep_time: v} : null)} placeholder="HH:MM" /></View>
                                  </View>
                                  <FormField label="Operator Contact" value={editingBooking?.arr_bus_operator_contact || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_bus_operator_contact: v} : null)} />
                                  
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                    <Text style={[s.fieldLabel, { color: C.textSecond }]}>🚌 Departure Bus</Text>
                                    <TouchableOpacity onPress={() => {
                                        if (!editingBooking) return;
                                        setEditingBooking(p => p ? {
                                          ...p,
                                          dep_bus_name: p.arr_bus_name,
                                          dep_bus_dep_station: p.arr_bus_arr_station,
                                          dep_bus_arr_station: p.arr_bus_dep_station,
                                          dep_bus_operator_contact: p.arr_bus_operator_contact,
                                        } : null);
                                    }} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
                                      <Text style={{ fontSize: 10, color: C.primary, fontWeight: '800' }}>SAME AS ARRIVAL</Text>
                                    </TouchableOpacity>
                                  </View>
                                  <FormField label="Bus Name / Number" value={editingBooking?.dep_bus_name || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_bus_name: v} : null)} />
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Dep Station" value={editingBooking?.dep_bus_dep_station || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_bus_dep_station: v} : null)} /></View>
                                    <View style={{ flex: 1 }}><FormField label="Arr Station" value={editingBooking?.dep_bus_arr_station || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_bus_arr_station: v} : null)} /></View>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Date" value={editingBooking?.dep_bus_dep_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_bus_dep_date: v, dep_bus_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                                    <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.dep_bus_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_bus_dep_time: v} : null)} placeholder="HH:MM" /></View>
                                  </View>
                               </View>
                            )}
                            
                            {editingBooking?.checklist?.transport_mode === 'flights' && (
                               <View style={{ gap: 10 }}>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Arrival PNR" value={editingBooking?.arr_pnr || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_pnr: v} : null)} placeholder="PNR" /></View>
                                    <View style={{ flex: 1 }}><FormField label="Flight No" value={editingBooking?.arr_flight_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_flight_no: v} : null)} placeholder="Flight No" /></View>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="From" value={editingBooking?.arr_dep_place || 'Cochin Airport'} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_dep_place: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                                    <View style={{ flex: 1 }}><FormField label="To" value={editingBooking?.arr_arr_airport || 'Denpasar Airport'} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_arr_airport: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Dep Date" value={editingBooking?.arr_dep_date || ''} onChange={(v: string) => setEditingBooking(p => {
                                      if (!p) return null;
                                      const upd = { ...p, arr_dep_date: v };
                                      if (v) {
                                        if (!upd.arr_arr_date) upd.arr_arr_date = v;
                                        if (!upd.dep_dep_date) upd.dep_dep_date = v;
                                        if (!upd.dep_arr_date) upd.dep_arr_date = v;
                                        if (!upd.travel_start_date) upd.travel_start_date = v;
                                        if (!upd.travel_end_date) upd.travel_end_date = v;
                                      }
                                      return upd;
                                    })} placeholder="YYYY-MM-DD" /></View>
                                    <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.arr_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_dep_time: v} : null)} placeholder="HH:MM" /></View>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Arr Date" value={editingBooking?.arr_arr_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                                    <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.arr_arr_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_arr_time: v} : null)} placeholder="HH:MM" /></View>
                                  </View>
        
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Departure PNR" value={editingBooking?.dep_pnr || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_pnr: v} : null)} placeholder="PNR" /></View>
                                    <View style={{ flex: 1 }}><FormField label="Flight No" value={editingBooking?.dep_flight_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_flight_no: v} : null)} placeholder="Flight No" /></View>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="From" value={editingBooking?.dep_dep_place || 'Denpasar Airport'} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_dep_place: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                                    <View style={{ flex: 1 }}><FormField label="To" value={editingBooking?.dep_arr_airport || 'Cochin Airport'} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_arr_airport: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Dep Date" value={editingBooking?.dep_dep_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_dep_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                                    <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.dep_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_dep_time: v} : null)} placeholder="HH:MM" /></View>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Arr Date" value={editingBooking?.dep_arr_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                                    <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.dep_arr_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_arr_time: v} : null)} placeholder="HH:MM" /></View>
                                  </View>
                               </View>
                            )}
                            
                            {editingBooking?.checklist?.transport_mode === 'train' && (
                               <View style={{ gap: 10 }}>
                                  <Text style={[s.fieldLabel, { color: C.primary, marginBottom: 5 }]}>🚆 Arrival Train</Text>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="PNR" value={editingBooking?.arr_train_pnr || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_pnr: v} : null)} /></View>
                                    <View style={{ flex: 1 }}><FormField label="Train No" value={editingBooking?.arr_train_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_no: v} : null)} /></View>
                                  </View>
                                  <FormField label="Train Name" value={editingBooking?.arr_train_name || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_name: v} : null)} />
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Dep Place" value={editingBooking?.arr_train_dep_place || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_dep_place: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                                    <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.arr_train_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_dep_time: v} : null)} /></View>
                                  </View>
        
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                    <Text style={[s.fieldLabel, { color: C.textSecond }]}>🚆 Departure Train</Text>
                                    <TouchableOpacity onPress={() => {
                                        if (!editingBooking) return;
                                        setEditingBooking(p => p ? {
                                          ...p,
                                          dep_train_pnr: p.arr_train_pnr,
                                          dep_train_no: p.arr_train_no,
                                          dep_train_name: p.arr_train_name,
                                        } : null);
                                    }} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
                                      <Text style={{ fontSize: 10, color: C.primary, fontWeight: '800' }}>SAME AS ARRIVAL</Text>
                                    </TouchableOpacity>
                                  </View>
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="PNR" value={editingBooking?.dep_train_pnr || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_pnr: v} : null)} /></View>
                                    <View style={{ flex: 1 }}><FormField label="Train No" value={editingBooking?.dep_train_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_no: v} : null)} /></View>
                                  </View>
                                  <FormField label="Train Name" value={editingBooking?.dep_train_name || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_name: v} : null)} />
                                  <View style={s.rowTwo}>
                                    <View style={{ flex: 1 }}><FormField label="Arr Station" value={editingBooking?.dep_train_arr_station || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_arr_station: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                                    <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.dep_train_arr_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_arr_time: v} : null)} /></View>
                                  </View>
                               </View>
                            )}
                          </View>
                        );
                      })()}
                      {item.key === 'flights' && (
                        <View style={{ gap: 10 }}>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Arrival PNR" value={editingBooking?.arr_pnr || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_pnr: v} : null)} placeholder="PNR" /></View>
                            <View style={{ flex: 1 }}><FormField label="Flight No" value={editingBooking?.arr_flight_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_flight_no: v} : null)} placeholder="Flight No" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="From" value={editingBooking?.arr_dep_place || 'Cochin Airport'} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_dep_place: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                            <View style={{ flex: 1 }}><FormField label="To" value={editingBooking?.arr_arr_airport || 'Denpasar Airport'} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_arr_airport: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Dep Date" value={editingBooking?.arr_dep_date || ''} onChange={(v: string) => setEditingBooking(p => {
                                 if (!p) return null;
                                 const prev = p.arr_dep_date;
                                 const upd = { ...p, arr_dep_date: v };
                                 if (v) {
                                   if (!upd.arr_arr_date || upd.arr_arr_date === prev) upd.arr_arr_date = v;
                                   if (!upd.dep_dep_date || upd.dep_dep_date === prev) upd.dep_dep_date = v;
                                   if (!upd.dep_arr_date || upd.dep_arr_date === prev) upd.dep_arr_date = v;
                                   if (!upd.travel_start_date || upd.travel_start_date === prev) upd.travel_start_date = v;
                                 }
                                 return upd;
                               })} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.arr_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_dep_time: v} : null)} placeholder="HH:MM" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Arr Date" value={editingBooking?.arr_arr_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.arr_arr_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_arr_time: v} : null)} placeholder="HH:MM" /></View>
                          </View>

                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Departure PNR" value={editingBooking?.dep_pnr || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_pnr: v} : null)} placeholder="PNR" /></View>
                            <View style={{ flex: 1 }}><FormField label="Flight No" value={editingBooking?.dep_flight_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_flight_no: v} : null)} placeholder="Flight No" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="From" value={editingBooking?.dep_dep_place || 'Denpasar Airport'} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_dep_place: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                            <View style={{ flex: 1 }}><FormField label="To" value={editingBooking?.dep_arr_airport || 'Cochin Airport'} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_arr_airport: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Dep Date" value={editingBooking?.dep_dep_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_dep_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.dep_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_dep_time: v} : null)} placeholder="HH:MM" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Arr Date" value={editingBooking?.dep_arr_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.dep_arr_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_arr_time: v} : null)} placeholder="HH:MM" /></View>
                          </View>
                        </View>
                      )}
                      {item.key === 'train' && (
                        <View style={{ gap: 10 }}>
                          <Text style={[s.fieldLabel, { color: C.primary, marginBottom: 5 }]}>🚆 Arrival Train</Text>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="PNR" value={editingBooking?.arr_train_pnr || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_pnr: v} : null)} /></View>
                            <View style={{ flex: 1 }}><FormField label="Train No" value={editingBooking?.arr_train_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_no: v} : null)} /></View>
                          </View>
                          <FormField label="Train Name" value={editingBooking?.arr_train_name || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_name: v} : null)} />
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Dep Place (India)" value={editingBooking?.arr_train_dep_place || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_dep_place: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                            <View style={{ flex: 1 }}><FormField label="Arr Place" value={editingBooking?.arr_train_arr_station || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_arr_station: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Dep Date" value={editingBooking?.arr_train_dep_date || ''} onChange={(v: string) => setEditingBooking(p => {
                                 if (!p) return null;
                                 const prev = p.arr_train_dep_date;
                                 const upd = { ...p, arr_train_dep_date: v };
                                 if (v) {
                                   if (!upd.dep_train_dep_date || upd.dep_train_dep_date === prev) upd.dep_train_dep_date = v;
                                   if (!upd.travel_start_date || upd.travel_start_date === prev) upd.travel_start_date = v;
                                   if (!upd.travel_end_date || upd.travel_end_date === prev) upd.travel_end_date = v;
                                 }
                                 return upd;
                               })} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.arr_train_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_dep_time: v} : null)} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Arr Date" value={editingBooking?.arr_train_arr_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.arr_train_arr_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, arr_train_arr_time: v} : null)} /></View>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                            <Text style={[s.fieldLabel, { color: C.textSecond }]}>🚆 Departure Train</Text>
                            <TouchableOpacity onPress={() => {
                                if (!editingBooking) return;
                                setEditingBooking(p => p ? {
                                  ...p,
                                  dep_train_pnr: p.arr_train_pnr,
                                  dep_train_no: p.arr_train_no,
                                  dep_train_name: p.arr_train_name,
                                  dep_train_dep_place: p.arr_train_arr_station,
                                  dep_train_arr_station: p.arr_train_dep_place,
                                } : null);
                            }} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
                              <Text style={{ fontSize: 10, color: C.primary, fontWeight: '800' }}>SAME AS ARRIVAL</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="PNR" value={editingBooking?.dep_train_pnr || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_pnr: v} : null)} /></View>
                            <View style={{ flex: 1 }}><FormField label="Train No" value={editingBooking?.dep_train_no || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_no: v} : null)} /></View>
                          </View>
                          <FormField label="Train Name" value={editingBooking?.dep_train_name || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_name: v} : null)} />
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Dep Place" value={editingBooking?.dep_train_dep_place || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_dep_place: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                            <View style={{ flex: 1 }}><FormField label="Arr Station" value={editingBooking?.dep_train_arr_station || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_arr_station: v} : null)} suggestions={TRIP_PLACE_SUGGESTIONS} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Dep Date" value={editingBooking?.dep_train_dep_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_dep_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.dep_train_dep_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_dep_time: v} : null)} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Arr Date" value={editingBooking?.dep_train_arr_date || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.dep_train_arr_time || ''} onChange={(v: string) => setEditingBooking(p => p ? {...p, dep_train_arr_time: v} : null)} /></View>
                          </View>
                        </View>
                      )}
                      {item.key === 'itinerary' && (
                        <View style={{ gap: 10 }}>
                          <View style={s.itinBox}>
                            <Text style={[s.itinText, { fontWeight: '800', color: '#6366f1', marginBottom: 8 }]}>
                              {itineraries.find(i => i.id === (editingBooking?.itinerary_id || selectedLead?.itinerary_id))?.title || 'No Itinerary Selected'}
                              {selectedLead?.itinerary_option && ` (${selectedLead.itinerary_option.charAt(0).toUpperCase() + selectedLead.itinerary_option.slice(1)})`}
                              {(() => {
                                const itin = itineraries.find(i => i.id === (editingBooking?.itinerary_id || selectedLead?.itinerary_id));
                                const opt = selectedLead?.itinerary_option;
                                if (itin && opt && itin.pricing_data?.[opt]?.price_usd) {
                                  return ` • $${itin.pricing_data[opt].price_usd}`;
                                }
                                return '';
                              })()}
                            </Text>
                            <Text style={s.itinText}>
                              {itineraries.find(i => i.id === (editingBooking?.itinerary_id || selectedLead?.itinerary_id))?.description || 'No description available.'}
                            </Text>
                          </View>
                          
                          <Text style={s.fieldLabel}>Change Itinerary (Notifies Sales)</Text>
                          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                            {itineraries.map(i => (
                              <TouchableOpacity 
                                key={i.id} 
                                style={[s.itinOption, (editingBooking?.itinerary_id === i.id || selectedLead?.itinerary_id === i.id) && s.itinOptionActive]}
                                onPress={() => {
                                  if (!editingBooking || !liveRate) return;
                                  const opt = selectedLead?.itinerary_option;
                                  const priceUSD = (opt && i.pricing_data?.[opt]) ? (i.pricing_data[opt] as any).price_usd : 0;
                                  const priceINR = (opt && i.pricing_data?.[opt]) ? (i.pricing_data[opt] as any).price : 0;
                                  const dueUSD = priceUSD - (editingBooking.advance_paid / liveRate);
                                  
                                  setEditingBooking({
                                    ...editingBooking,
                                    itinerary_id: i.id,
                                    total_amount: priceINR,
                                    total_amount_usd: priceUSD,
                                    due_amount_usd: dueUSD
                                  });
                                }}
                              >
                                <Text style={[s.itinOptionText, (editingBooking?.itinerary_id === i.id || selectedLead?.itinerary_id === i.id) && { color: '#6366f1' }]}>{i.title}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          
                          <TouchableOpacity 
                             style={{ marginTop: 10, padding: 12, backgroundColor: C.primaryLight, borderRadius: 8, alignItems: 'center' }}
                             onPress={() => {
                               if (!editingBooking || !liveRate) return;
                               const itin = itineraries.find(i => i.id === (editingBooking.itinerary_id || selectedLead?.itinerary_id));
                               const opt = selectedLead?.itinerary_option;
                               const priceUSD = (opt && itin?.pricing_data?.[opt]) ? (itin.pricing_data[opt] as any).price_usd : 0;
                               const priceINR = (opt && itin?.pricing_data?.[opt]) ? (itin.pricing_data[opt] as any).price : 0;
                               
                               const dueUSD = priceUSD - (editingBooking.advance_paid / liveRate);
                               
                               setEditingBooking(p => p ? {
                                 ...p,
                                 total_amount: priceINR,
                                 total_amount_usd: priceUSD,
                                 due_amount_usd: dueUSD
                               } : null);
                               Alert.alert('Recalculated', 'USD settlement values have been refreshed based on the latest rate.');
                             }}
                          >
                             <Text style={{ color: C.primary, fontSize: 12, fontWeight: '800' }}>FORCE RE-CALCULATE</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                             style={{ marginTop: 10, padding: 12, backgroundColor: '#25D366', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                             onPress={() => editingBooking && shareItineraryWithGuest(selectedLead!, editingBooking)}
                          >
                             <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                             <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>SEND CONFIRMED ITINERARY TO GUEST</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {item.key === 'inc_exc' && (() => {
                        const itin = itineraries.find(i => i.id === (editingBooking?.itinerary_id || selectedLead?.itinerary_id));
                        const opt = selectedLead?.itinerary_option;
                        const data = (opt && itin?.pricing_data?.[opt]) ? (itin.pricing_data[opt] as any) : null;
                        
                        return (
                          <View style={{ gap: 12 }}>
                            <View style={s.itinBox}>
                              <Text style={[s.subSectionTitle, { color: '#10b981', marginBottom: 5 }]}>✅ Inclusions</Text>
                              {(data?.inclusions && data.inclusions.length > 0) ? (
                                data.inclusions.map((inc: string, i: number) => (
                                  <Text key={i} style={s.itinText}>• {inc}</Text>
                                ))
                              ) : (
                                <Text style={[s.itinText, { opacity: 0.6 }]}>No specific inclusions listed.</Text>
                              )}
                            </View>
                            <View style={[s.itinBox, { borderLeftColor: '#ef4444' }]}>
                              <Text style={[s.subSectionTitle, { color: '#ef4444', marginBottom: 5 }]}>❌ Exclusions</Text>
                              {(data?.exclusions && data.exclusions.length > 0) ? (
                                data.exclusions.map((exc: string, i: number) => (
                                  <Text key={i} style={s.itinText}>• {exc}</Text>
                                ))
                              ) : (
                                <Text style={[s.itinText, { opacity: 0.6 }]}>No specific exclusions listed.</Text>
                              )}
                            </View>
                          </View>
                        );
                      })()}

                      {item.key === 'hotels' && (
                        <View style={{ gap: 15, marginTop: 5 }}>
                          <View style={{ height: 4, backgroundColor: '#334155', borderRadius: 2, overflow: 'hidden' }}>
                            <View style={{ height: '100%', backgroundColor: '#10b981', width: `${(Object.values(editingBooking?.checklist || {}).filter((v: any) => !!v).length / 7) * 100}%` as any }} />
                          </View>
                          {!((editingBooking?.checklist?.hotel_data?.length ?? 0) > 0) ? (
                            <TouchableOpacity style={{ padding: 15, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center' }} onPress={() => {
                                if (!editingBooking) return;
                                const b = editingBooking;
                                let newData: any[] = [];
                                if (b.arr_arr_date && b.dep_dep_date) {
                                   const [y1, m1, d1] = b.arr_arr_date.split('-').map(Number);
                                   const [y2, m2, d2] = b.dep_dep_date.split('-').map(Number);
                                   const date1 = new Date(y1, m1 - 1, d1);
                                   const date2 = new Date(y2, m2 - 1, d2);
                                   
                                   if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
                                       const diffTime = Math.abs(date2.getTime() - date1.getTime());
                                       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                       if (diffDays > 0) {
                                           newData = Array.from({ length: diffDays }).map((_, i) => {
                                               const d = new Date(y1, m1 - 1, d1 + i);
                                               const ny = d.getFullYear();
                                               const nm = String(d.getMonth() + 1).padStart(2, '0');
                                               const nd = String(d.getDate()).padStart(2, '0');
                                               return {
                                                   date: `${ny}-${nm}-${nd}`,
                                                   name: '',
                                                   roomType: '',
                                                   contact: '',
                                                   bookedByGuest: false
                                               };
                                           });
                                       }
                                   }
                                   if (newData.length > 0) {
                                      setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: newData } as any } : null);
                                   } else {
                                      Alert.alert('Invalid Dates', 'Could not calculate nights. Please enter the nightly stays manually.');
                                      setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: [{date: '', name: 'Akmani Legian', roomType: 'Classic Room', contact: '', bookedByGuest: false}] } as any } : null);
                                   }
                                } else {
                                   Alert.alert('Missing Dates', 'Fill in the "Arr Date" (Step 3 Arrival) and "Dep Date" (Step 3 Departure) to auto-calculate hotel stays.');
                                   setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: [{date: '', name: 'Akmani Legian', roomType: 'Classic Room', contact: '', bookedByGuest: false}] } as any } : null);
                                }
                            }}>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>AUTO-GENERATE NIGHTLY STAYS</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={{ gap: 10 }}>
                              {(editingBooking?.checklist?.hotel_data || []).map((h: any, idx: number) => (
                                <View key={idx} style={{ backgroundColor: '#1e293b', padding: 15, borderRadius: 8, gap: 10, borderWidth: 1, borderColor: '#334155' }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700' }}>NIGHT {idx + 1} {h.date ? `(${h.date})` : ''}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={{ color: h.bookedByGuest ? '#3b82f6' : '#64748b', fontSize: 11, fontWeight: '600' }}>Booked by Guest</Text>
                                        <Switch
                                          value={!!h.bookedByGuest}
                                          onValueChange={(val) => {
                                            const nd = [...(editingBooking?.checklist?.hotel_data || [])];
                                            nd[idx].bookedByGuest = val;
                                            setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: nd } as any } : null);
                                          }}
                                          thumbColor={Platform.OS === 'ios' ? undefined : (h.bookedByGuest ? '#3b82f6' : '#475569')}
                                          trackColor={{ false: '#334155', true: 'rgba(59, 130, 246, 0.4)' }}
                                        />
                                      </View>
                                      <TouchableOpacity onPress={() => {
                                        const nd = [...(editingBooking?.checklist?.hotel_data || [])];
                                        nd.splice(idx, 1);
                                        setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: nd } as any } : null);
                                      }}>
                                        <Text style={{ color: '#ef4444', fontSize: 12 }}>Remove</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                  <FormField label="Hotel Name" value={h.name} onChange={(v: string) => { 
                                    const nd = [...(editingBooking?.checklist?.hotel_data || [])]; 
                                    nd[idx].name = v; 
                                    setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: nd } as any } : null);
                                  }} placeholder="Enter hotel name" suggestions={hotelSuggestions} />
                                  {!h.bookedByGuest ? (
                                    <FormField label="Room Type" value={h.roomType} onChange={(v: string) => { 
                                      const nd = [...(editingBooking?.checklist?.hotel_data || [])]; 
                                      nd[idx].roomType = v; 
                                      setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: nd } as any } : null);
                                    }} placeholder="Enter room category" suggestions={roomTypeSuggestions} />
                                  ) : (
                                    <FormField label="Contact No" value={h.contact} onChange={(v: string) => { 
                                      const nd = [...(editingBooking?.checklist?.hotel_data || [])]; 
                                      nd[idx].contact = v; 
                                      setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: nd } as any } : null);
                                    }} placeholder="Hotel contact" />
                                  )}
                                </View>
                              ))}
                              <TouchableOpacity style={{ padding: 12, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center', marginTop: 10 }} onPress={() => {
                                const cur = editingBooking?.checklist?.hotel_data || [];
                                let newDate = '';
                                if (cur.length > 0 && cur[cur.length-1].date) {
                                   const [y, m, d] = cur[cur.length-1].date.split('-').map(Number);
                                   const date = new Date(y, m - 1, d + 1);
                                   const ny = date.getFullYear();
                                   const nm = String(date.getMonth() + 1).padStart(2, '0');
                                   const nd = String(date.getDate()).padStart(2, '0');
                                   newDate = `${ny}-${nm}-${nd}`;
                                }
                                setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, hotel_data: [...cur, {date: newDate, name: 'Akmani Legian', roomType: 'Classic Room', contact: '', bookedByGuest: false}] } as any } : null);
                              }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>+ ADD EXTRA NIGHT</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}

                      {(item.key === 'important_info' || item.key === 'info') && (
                        <View style={{ backgroundColor: '#fffbeb', padding: 15, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#f59e0b', marginTop: 5, borderWidth: 1, borderColor: '#fef3c7' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <Ionicons name="alert-circle" size={18} color="#f59e0b" />
                            <Text style={{ color: '#92400e', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' }}>Field Operation Notes</Text>
                          </View>
                          <TextInput
                            style={{ 
                              backgroundColor: '#fff', 
                              borderRadius: 6, 
                              padding: 12, 
                              color: '#1e293b', 
                              borderWidth: 1, 
                              borderColor: '#fde68a', 
                              fontSize: 14, 
                              minHeight: 120, 
                              textAlignVertical: 'top' 
                            }}
                            multiline
                            placeholder="Add critical notes for the land team (e.g., Honeymoon, Early check-in, dietary needs...)"
                            placeholderTextColor="#94a3b8"
                            value={editingBooking?.checklist?.important_notes || ''}
                            onChangeText={(val) => {
                              setEditingBooking(p => p ? { ...p, checklist: { ...p.checklist, important_notes: val } as any } : null);
                            }}
                          />
                          <Text style={{ color: '#92400e', fontSize: 11, marginTop: 10, fontStyle: 'italic', opacity: 0.8 }}>
                            * This information will be highlighted at the top of the PDF manifest.
                          </Text>
                        </View>
                      )}

                      {item.key === 'payment' && (() => {
                        const dynamicItems = getDynamicChecklist(selectedLead?.destination);
                        // Filter out the 'pdf' and 'payment' steps from the lock requirement
                        const requiredItems = dynamicItems.filter(di => di.key !== 'pdf' && di.key !== 'payment');
                        const canGen = requiredItems.every(ri => editingBooking?.checklist?.[ri.key]);
                        
                        return (
                          <View style={s.payBox}>
                            <View style={s.payRow}>
                              <Text style={s.payLabel}>Total Package (USD)</Text>
                              <Text style={s.payVal}>${(editingBooking?.total_amount_usd || 0).toFixed(2)}</Text>
                            </View>
                            <View style={s.payRow}>
                              <Text style={s.payLabel}>Advance Paid (USD)</Text>
                              <Text style={s.payVal}>${(editingBooking?.advance_paid_usd || (editingBooking?.advance_paid && liveRate ? editingBooking.advance_paid / liveRate : 0)).toFixed(2)}</Text>
                            </View>
                            <View style={[s.payRow, { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8 }]}>
                              <View>
                                <Text style={s.payLabel}>Balance Due (USD)</Text>
                                <Text style={{ fontSize: 10, color: C.textMuted }}>Rate: ₹{liveRate || '—'}</Text>
                              </View>
                              <Text style={[s.payVal, { color: '#ef4444', fontSize: 18 }]}>
                                ${(editingBooking?.due_amount_usd || 0).toFixed(2)}
                              </Text>
                            </View>
                            
                            {!canGen ? (
                              <View style={[s.genBtn, { backgroundColor: '#334155', opacity: 0.7 }]}>
                                <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                                <Text style={[s.genBtnText, { color: '#94a3b8' }]}>COMPLETE STEPS 1-7 TO UNLOCK PDF</Text>
                              </View>
                            ) : (
                              <View style={{ gap: 10, marginTop: 15 }}>
                                <TouchableOpacity style={s.genBtn} onPress={() => editingBooking && generatePDF(selectedLead!, editingBooking, 'print')}>
                                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                                  <Text style={s.genBtnText}>GENERATE PDF MANIFEST</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[s.genBtn, { backgroundColor: '#25D366' }]} onPress={() => editingBooking && generatePDF(selectedLead!, editingBooking, 'whatsapp')}>
                                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                                  <Text style={s.genBtnText}>SEND VIA WHATSAPP</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                      {item.key === 'pdf' && (
                        <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '700' }}>✓ PDF Manifest generated and ready to share with land team.</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Operations Progress</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FormField({ label, value, onChange, placeholder = '', suggestions = [] }: any) {
  const [showSug, setShowSug] = useState(false);
  const filtered = (value && suggestions.length > 0) ? suggestions.filter((s: string) => s.toLowerCase().includes(value.toLowerCase()) && s !== value).slice(0, 5) : [];

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput 
        style={s.input} 
        value={value} 
        onChangeText={onChange} 
        onFocus={() => setShowSug(true)}
        placeholder={placeholder}
        placeholderTextColor="#475569"
      />
      {showSug && filtered.length > 0 && (
        <View style={{ backgroundColor: C.surface, borderRadius: R.xs, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          {filtered.map((sug: string, i: number) => (
            <TouchableOpacity key={i} style={{ padding: 10, borderBottomWidth: i === filtered.length-1 ? 0 : 1, borderBottomColor: '#334155' }} onPress={() => {
               onChange(sug);
               setShowSug(false);
            }}>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>{sug}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  tabBar: { flexDirection: 'row', backgroundColor: C.surface, paddingHorizontal: 10, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: C.primary },
  tabText: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: C.primary },
  list: { padding: S.lg, gap: S.lg },

  // Card
  card: { backgroundColor: C.surface, borderRadius: R.lg, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
  progressBarBackground: { height: 4, backgroundColor: C.bg },
  progressBarFill: { height: '100%' },
  cardContent: { padding: S.lg, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leadName: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  destinationText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  percentBadge: { backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  percentText: { color: C.primary, fontSize: 12, fontWeight: '800' },
  cardMetaRow: { flexDirection: 'row', gap: 15 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  opsBtn: { backgroundColor: C.primary, borderRadius: R.sm, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  opsBtnText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

  // Modal
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: S.xl, paddingTop: S.xxl, borderBottomWidth: 1, borderBottomColor: C.border, gap: 15, backgroundColor: C.surface },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  modalSub: { color: C.primary, fontSize: 14, fontWeight: '600' },
  modalScroll: { padding: S.xl, gap: S.md, paddingBottom: 60 },
  checklistCard: { backgroundColor: C.surface, borderRadius: R.md, padding: 14, gap: 12, borderWidth: 1, borderColor: C.border },
  checklistHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checklistLabel: { color: C.textSecond, fontSize: 15, fontWeight: '700' },
  checklistLabelDone: { color: C.green, textDecorationLine: 'line-through' },
  checklistContent: { marginTop: 10, paddingLeft: 36, gap: 8 },
  fieldLabel: { color: C.textSecond, fontSize: 12, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.surface2, borderRadius: R.xs, padding: 12, color: C.textPrimary, borderWidth: 1.5, borderColor: C.border, fontSize: 14 },
  subSectionTitle: { color: C.primary, fontSize: 12, fontWeight: '800', marginTop: 8, textTransform: 'uppercase' },
  rowTwo: { flexDirection: 'row', gap: 10 },
  itinBox: { backgroundColor: C.primaryLight, padding: 12, borderRadius: R.sm, borderLeftWidth: 3, borderLeftColor: C.primary },
  itinText: { color: C.textSecond, fontSize: 13, lineHeight: 20 },
  itinOption: { padding: 10, backgroundColor: C.surface2, borderRadius: R.xs, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  itinOptionActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  itinOptionText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  editItinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  editItinText: { color: C.primary, fontSize: 12, fontWeight: '700' },
  payBox: { backgroundColor: C.surface2, padding: 12, borderRadius: R.sm, gap: 8, borderWidth: 1, borderColor: C.border },
  payRow: { flexDirection: 'row', justifyContent: 'space-between' },
  payLabel: { color: C.textMuted, fontSize: 13 },
  payVal: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  genBtn: { backgroundColor: C.green, borderRadius: R.xs, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  genBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  saveBtn: { backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 16, alignItems: 'center', marginTop: 10, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 15 },
  emptyTitle: { color: C.textMuted, fontSize: 18, fontWeight: '700' },
  emptyText: { color: C.textSecond, fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 22 },
});
