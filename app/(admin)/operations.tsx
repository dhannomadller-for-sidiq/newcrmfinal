import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, TextInput, Platform, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
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
};

type ConfirmedBooking = {
  id: string;
  lead_id: string;
  itinerary_id: string | null;
  total_amount: number;
  advance_paid: number;
  due_amount: number;
  passport_no: string | null;
  passport_name: string | null;
  pan_no?: string;
  checklist?: Record<string, any>;
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
};

type Itinerary = {
  id: string;
  title: string;
  pricing_data: any;
  description: string;
};

const TABS = [
  { key: 'ops', label: 'Operations', icon: 'settings-outline' },
  { key: 'near', label: 'Near Departure', icon: 'time-outline' },
  { key: 'today', label: 'Today Departure', icon: 'calendar-outline' },
];

const CHECKLIST_ITEMS = [
  { key: 'passport', label: 'Passport Collected' },
  { key: 'pan', label: 'PAN Card Collected' },
  { key: 'flights', label: 'Flight Details Collected' },
  { key: 'itinerary', label: 'Confirmed Itinerary' },
  { key: 'inc_exc', label: 'Check Inclusions/Exclusions' },
  { key: 'hotels', label: 'Hotel Accommodations' },
  { key: 'important_info', label: 'Important Information' },
  { key: 'payment', label: 'Payment (Total/Advance/Due)' },
  { key: 'pdf', label: 'PDF Share with Land Team' },
];

// ═══════════════════════════════════════════════════════════════════════════════
export default function OperationsScreen() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ops');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Record<string, ConfirmedBooking>>({});
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);

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
    setLoading(true);
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .in('status', ['Converted', 'Allocated']);
    
    if (leadData) {
      setLeads(leadData);
      const leadIds = leadData.map(l => l.id);
      const { data: bookingData } = await supabase
        .from('confirmed_bookings')
        .select('*')
        .in('lead_id', leadIds);
      
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

    const { data: itinData } = await supabase.from('itineraries').select('*');
    setItineraries(itinData ?? []);
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
  const getProgress = (booking: ConfirmedBooking | undefined) => {
    if (!booking || !booking.checklist) return 0;
    const done = CHECKLIST_ITEMS.filter(item => !!booking.checklist?.[item.key]).length;
    return Math.round((done / CHECKLIST_ITEMS.length) * 100);
  };

  // ── Checklist Actions ────────────────────────────────────────────────────
  const toggleChecklist = (key: string) => {
    if (!editingBooking) return;
    const newChecklist = { ...(editingBooking.checklist || {}) };
    newChecklist[key] = !newChecklist[key];
    setEditingBooking({ ...editingBooking, checklist: newChecklist });
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
        passport_no: editingBooking.passport_no,
        passport_name: editingBooking.passport_name,
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
          <div class="section-title">1. Guest Profile & Travel Date</div>
          <table>
            <thead>
              <tr>
                <th style="width: 35%;">Guest Name</th>
                <th style="width: 20%;">Contact No</th>
                <th style="width: 25%;">Travel Date</th>
                <th style="width: 20%;">Trip Code</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="bold">${booking.passport_name || lead.name}</div></td>
                <td><div class="bold">${lead.contact_no}</div></td>
                <td><div class="bold" style="color: #3b82f6;">${booking.arr_dep_date}</div></td>
                <td><div class="bold">NM-BK-${lead.id.substring(0, 5).toUpperCase()}</div></td>
              </tr>
            </tbody>
          </table>
          <table style="margin-top: -10px;">
            <thead>
              <tr>
                <th style="width: 50%;">Passport Number</th>
                <th style="width: 50%;">PAN Number</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="bold">${booking.passport_no || 'NOT PROVIDED'}</div></td>
                <td><div class="bold">${booking.pan_no || 'NOT PROVIDED'}</div></td>
              </tr>
            </tbody>
          </table>

          <!-- SECTION 2: FLIGHT DETAILS -->
          <div class="section-title">2. Arrival & Departure Flight Details</div>
          <table>
            <thead>
              <tr>
                <th>Flight No</th>
                <th>Phase</th>
                <th>Departure Time</th>
                <th>Arrival Time</th>
                <th>Sector</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="bold">${booking.arr_flight_no || '—'}<br/><span style="font-size: 11px; color: #64748b;">PNR: ${booking.arr_pnr || '—'}</span></div></td>
                <td><span style="color: #10b981; font-weight: 800;">ARRIVAL</span></td>
                <td>${booking.arr_dep_date}<br/><span style="font-size: 11px; font-weight: 700;">${booking.arr_dep_time}</span></td>
                <td>${booking.arr_arr_date}<br/><span style="font-size: 11px; font-weight: 700;">${booking.arr_arr_time}</span></td>
                <td><div class="bold">${booking.arr_dep_place} ✈ ${booking.arr_arr_airport}</div></td>
              </tr>
              <tr>
                <td><div class="bold">${booking.dep_flight_no || '—'}<br/><span style="font-size: 11px; color: #64748b;">PNR: ${booking.dep_pnr || '—'}</span></div></td>
                <td><span style="color: #3b82f6; font-weight: 800;">DEPARTURE</span></td>
                <td>${booking.dep_dep_date}<br/><span style="font-size: 11px; font-weight: 700;">${booking.dep_dep_time}</span></td>
                <td>${booking.dep_arr_date}<br/><span style="font-size: 11px; font-weight: 700;">${booking.dep_arr_time}</span></td>
                <td><div class="bold">${booking.dep_dep_place} ✈ ${booking.dep_arr_airport}</div></td>
              </tr>
            </tbody>
          </table>

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
              <div class="fin-row"><span class="fin-label">Total Package Value</span> <span class="fin-val">₹${booking.total_amount?.toLocaleString()}</span></div>
              <div class="fin-row"><span class="fin-label">Advance Received</span> <span class="fin-val" style="color: #10b981;">₹${booking.advance_paid?.toLocaleString()}</span></div>
              <div class="fin-row fin-total due-section">
                <span style="font-size: 11px; font-weight: 800; color: #ef4444;">BALANCE TO BE COLLECTED</span>
                <span style="font-size: 22px; font-weight: 900; color: #ef4444;">₹${booking.due_amount?.toLocaleString()}</span>
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
          const targetUri = `${FileSystem.cacheDirectory}${safeName}_manifest.pdf`;
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

  // ── Render ───────────────────────────────────────────────────────────────
  const renderLeadCard = ({ item }: { item: Lead }) => {
    const booking = bookings[item.id];
    const progress = getProgress(booking);

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
              <Text style={[s.metaText, { color: '#10b981' }]}>₹{booking?.total_amount?.toLocaleString()}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={s.opsBtn} 
            onPress={() => {
              setSelectedLead(item);
              setEditingBooking(booking ? { ...booking } : null);
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
        <View style={s.modal}>
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
            {CHECKLIST_ITEMS.map((item, idx) => {
              const checked = editingBooking?.checklist?.[item.key];
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
                      {item.key === 'passport' && (
                        <>
                          <FormField label="Passport Number" value={editingBooking?.passport_no || ''} onChange={v => setEditingBooking(p => p ? {...p, passport_no: v} : null)} placeholder="Enter Passport No" />
                          <FormField label="Name on Passport" value={editingBooking?.passport_name || ''} onChange={v => setEditingBooking(p => p ? {...p, passport_name: v} : null)} placeholder="Enter Full Name" />
                        </>
                      )}
                      {item.key === 'pan' && (
                        <FormField label="PAN Card Number" value={editingBooking?.pan_no || ''} onChange={v => setEditingBooking(p => p ? {...p, pan_no: v} : null)} placeholder="Enter PAN No" />
                      )}
                      {item.key === 'flights' && (
                        <View style={{ gap: 10 }}>
                        <View style={s.rowTwo}>
                          <View style={{ flex: 1 }}><FormField label="Arrival PNR" value={editingBooking?.arr_pnr || ''} onChange={v => setEditingBooking(p => p ? {...p, arr_pnr: v} : null)} placeholder="PNR" /></View>
                          <View style={{ flex: 1 }}><FormField label="Flight No" value={editingBooking?.arr_flight_no || ''} onChange={v => setEditingBooking(p => p ? {...p, arr_flight_no: v} : null)} placeholder="Flight No" /></View>
                        </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="From" value={editingBooking?.arr_dep_place || 'Cochin Airport'} onChange={v => setEditingBooking(p => p ? {...p, arr_dep_place: v} : null)} /></View>
                            <View style={{ flex: 1 }}><FormField label="To" value={editingBooking?.arr_arr_airport || 'Denpasar Airport'} onChange={v => setEditingBooking(p => p ? {...p, arr_arr_airport: v} : null)} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Dep Date" value={editingBooking?.arr_dep_date || ''} onChange={v => setEditingBooking(p => p ? {...p, arr_dep_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.arr_dep_time || ''} onChange={v => setEditingBooking(p => p ? {...p, arr_dep_time: v} : null)} placeholder="HH:MM" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Arr Date" value={editingBooking?.arr_arr_date || ''} onChange={v => setEditingBooking(p => p ? {...p, arr_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.arr_arr_time || ''} onChange={v => setEditingBooking(p => p ? {...p, arr_arr_time: v} : null)} placeholder="HH:MM" /></View>
                          </View>

                        <View style={s.rowTwo}>
                          <View style={{ flex: 1 }}><FormField label="Departure PNR" value={editingBooking?.dep_pnr || ''} onChange={v => setEditingBooking(p => p ? {...p, dep_pnr: v} : null)} placeholder="PNR" /></View>
                          <View style={{ flex: 1 }}><FormField label="Flight No" value={editingBooking?.dep_flight_no || ''} onChange={v => setEditingBooking(p => p ? {...p, dep_flight_no: v} : null)} placeholder="Flight No" /></View>
                        </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="From" value={editingBooking?.dep_dep_place || 'Denpasar Airport'} onChange={v => setEditingBooking(p => p ? {...p, dep_dep_place: v} : null)} /></View>
                            <View style={{ flex: 1 }}><FormField label="To" value={editingBooking?.dep_arr_airport || 'Cochin Airport'} onChange={v => setEditingBooking(p => p ? {...p, dep_arr_airport: v} : null)} /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Dep Date" value={editingBooking?.dep_dep_date || ''} onChange={v => setEditingBooking(p => p ? {...p, dep_dep_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Dep Time" value={editingBooking?.dep_dep_time || ''} onChange={v => setEditingBooking(p => p ? {...p, dep_dep_time: v} : null)} placeholder="HH:MM" /></View>
                          </View>
                          <View style={s.rowTwo}>
                            <View style={{ flex: 1 }}><FormField label="Arr Date" value={editingBooking?.dep_arr_date || ''} onChange={v => setEditingBooking(p => p ? {...p, dep_arr_date: v} : null)} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><FormField label="Arr Time" value={editingBooking?.dep_arr_time || ''} onChange={v => setEditingBooking(p => p ? {...p, dep_arr_time: v} : null)} placeholder="HH:MM" /></View>
                          </View>
                        </View>
                      )}
                      {item.key === 'itinerary' && (
                        <View style={{ gap: 10 }}>
                          <View style={s.itinBox}>
                            <Text style={[s.itinText, { fontWeight: '800', color: '#6366f1', marginBottom: 8 }]}>
                              {itineraries.find(i => i.id === editingBooking?.itinerary_id || i.id === selectedLead?.itinerary_id)?.title || 'No Itinerary Selected'}
                              {selectedLead?.itinerary_option && ` (${selectedLead.itinerary_option.charAt(0).toUpperCase() + selectedLead.itinerary_option.slice(1)})`}
                            </Text>
                            <Text style={s.itinText}>
                              {itineraries.find(i => i.id === editingBooking?.itinerary_id || i.id === selectedLead?.itinerary_id)?.description || 'No description available.'}
                            </Text>
                          </View>
                          
                          <Text style={s.fieldLabel}>Change Itinerary (Notifies Sales)</Text>
                          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                            {itineraries.map(i => (
                              <TouchableOpacity 
                                key={i.id} 
                                style={[s.itinOption, (editingBooking?.itinerary_id === i.id || selectedLead?.itinerary_id === i.id) && s.itinOptionActive]}
                                onPress={() => setEditingBooking(p => p ? {...p, itinerary_id: i.id} : null)}
                              >
                                <Text style={[s.itinOptionText, (editingBooking?.itinerary_id === i.id || selectedLead?.itinerary_id === i.id) && { color: '#6366f1' }]}>{i.title}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
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
                          {!(editingBooking?.checklist?.hotel_data?.length > 0) ? (
                            <TouchableOpacity style={{ padding: 15, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center' }} onPress={() => {
                                let newData: any[] = [];
                                if (editingBooking?.arr_arr_date && editingBooking?.dep_dep_date) {
                                   const [y1, m1, d1] = editingBooking.arr_arr_date.split('-').map(Number);
                                   const [y2, m2, d2] = editingBooking.dep_dep_date.split('-').map(Number);
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
                                      setEditingBooking({ ...editingBooking, checklist: { ...editingBooking?.checklist, hotel_data: newData } as any });
                                   } else {
                                      Alert.alert('Invalid Dates', 'Could not calculate nights. Please enter the nightly stays manually.');
                                      setEditingBooking({ ...editingBooking, checklist: { ...editingBooking?.checklist, hotel_data: [{date: '', name: '', contact: ''}] } as any });
                                   }
                                } else {
                                   Alert.alert('Missing Dates', 'Fill in the "Arr Date" (Step 3 Arrival) and "Dep Date" (Step 3 Departure) to auto-calculate hotel stays.');
                                   setEditingBooking({ ...editingBooking, checklist: { ...editingBooking?.checklist, hotel_data: [{date: '', name: '', contact: ''}] } as any });
                                }
                            }}>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>AUTO-GENERATE NIGHTLY STAYS</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={{ gap: 10 }}>
                              {(editingBooking.checklist.hotel_data || []).map((h: any, idx: number) => (
                                <View key={idx} style={{ backgroundColor: '#1e293b', padding: 15, borderRadius: 8, gap: 10, borderWidth: 1, borderColor: '#334155' }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700' }}>NIGHT {idx + 1} {h.date ? `(${h.date})` : ''}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={{ color: h.bookedByGuest ? '#3b82f6' : '#64748b', fontSize: 11, fontWeight: '600' }}>Booked by Guest</Text>
                                        <Switch
                                          value={!!h.bookedByGuest}
                                          onValueChange={(val) => {
                                            const nd = [...editingBooking.checklist!.hotel_data];
                                            nd[idx].bookedByGuest = val;
                                            setEditingBooking({ ...editingBooking, checklist: { ...editingBooking.checklist, hotel_data: nd } as any})
                                          }}
                                          thumbColor={Platform.OS === 'ios' ? undefined : (h.bookedByGuest ? '#3b82f6' : '#475569')}
                                          trackColor={{ false: '#334155', true: 'rgba(59, 130, 246, 0.4)' }}
                                        />
                                      </View>
                                      <TouchableOpacity onPress={() => {
                                        const nd = [...(editingBooking.checklist?.hotel_data || [])];
                                        nd.splice(idx, 1);
                                        setEditingBooking({ ...editingBooking, checklist: { ...editingBooking.checklist, hotel_data: nd } as any});
                                      }}>
                                        <Text style={{ color: '#ef4444', fontSize: 12 }}>Remove</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                  <FormField label="Hotel Name" value={h.name} onChange={(v: string) => { const nd = [...editingBooking.checklist!.hotel_data]; nd[idx].name = v; setEditingBooking({ ...editingBooking, checklist: { ...editingBooking.checklist, hotel_data: nd } as any}) }} placeholder="Enter hotel name" suggestions={hotelSuggestions} />
                                  {!h.bookedByGuest ? (
                                    <FormField label="Room Type" value={h.roomType} onChange={(v: string) => { const nd = [...editingBooking.checklist!.hotel_data]; nd[idx].roomType = v; setEditingBooking({ ...editingBooking, checklist: { ...editingBooking.checklist, hotel_data: nd } as any}) }} placeholder="Enter room category" suggestions={roomTypeSuggestions} />
                                  ) : (
                                    <FormField label="Contact No" value={h.contact} onChange={(v: string) => { const nd = [...editingBooking.checklist!.hotel_data]; nd[idx].contact = v; setEditingBooking({ ...editingBooking, checklist: { ...editingBooking.checklist, hotel_data: nd } as any}) }} placeholder="Hotel contact" />
                                  )}
                                </View>
                              ))}
                              <TouchableOpacity style={{ padding: 12, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center', marginTop: 10 }} onPress={() => {
                                const cur = editingBooking.checklist?.hotel_data || [];
                                let newDate = '';
                                if (cur.length > 0 && cur[cur.length-1].date) {
                                   const [y, m, d] = cur[cur.length-1].date.split('-').map(Number);
                                   const date = new Date(y, m - 1, d + 1);
                                   const ny = date.getFullYear();
                                   const nm = String(date.getMonth() + 1).padStart(2, '0');
                                   const nd = String(date.getDate()).padStart(2, '0');
                                   newDate = `${ny}-${nm}-${nd}`;
                                }
                                setEditingBooking({ ...editingBooking, checklist: { ...editingBooking.checklist, hotel_data: [...cur, {date: newDate, name:'', roomType: '', contact:'', bookedByGuest: false}] } as any});
                              }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>+ ADD EXTRA NIGHT</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}

                      {item.key === 'important_info' && (
                        <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', padding: 15, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#f59e0b', marginTop: 5 }}>
                          <Text style={[s.fieldLabel, { color: '#f59e0b', marginBottom: 10 }]}>Critical Package Notes</Text>
                          <TextInput
                            style={[s.input, { minHeight: 120, textAlignVertical: 'top', backgroundColor: '#0f172a', borderColor: 'rgba(245, 158, 11, 0.2)' }]}
                            multiline
                            placeholder="Type important information regarding this package (e.g. Honeymoon setup, early check-in, dietary needs...)"
                            placeholderTextColor="#475569"
                            value={editingBooking.checklist?.important_notes || ''}
                            onChangeText={(val) => {
                              setEditingBooking({
                                ...editingBooking,
                                checklist: { ...editingBooking.checklist, important_notes: val } as any
                              });
                            }}
                          />
                          <Text style={{ color: '#64748b', fontSize: 11, marginTop: 10, fontStyle: 'italic' }}>* This information will be highlighted at the top of the PDF manifest.</Text>
                        </View>
                      )}

                      {item.key === 'payment' && (() => {
                        const canGen = CHECKLIST_ITEMS.slice(0, 8).every(ci => editingBooking?.checklist?.[ci.key]);
                        return (
                          <View style={s.payBox}>
                            <View style={s.payRow}><Text style={s.payLabel}>Total Cost</Text><Text style={s.payVal}>₹{editingBooking?.total_amount?.toLocaleString()}</Text></View>
                            <View style={s.payRow}><Text style={s.payLabel}>Advance Paid</Text><Text style={s.payVal}>₹{editingBooking?.advance_paid?.toLocaleString()}</Text></View>
                            <View style={[s.payRow, { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8 }]}><Text style={s.payLabel}>Balance Due</Text><Text style={[s.payVal, { color: '#ef4444' }]}>₹{editingBooking?.due_amount?.toLocaleString()}</Text></View>
                            
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
        </View>
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
        <View style={{ backgroundColor: '#0f172a', borderRadius: 8, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' }}>
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  tabBar: { flexDirection: 'row', backgroundColor: '#1e293b', paddingHorizontal: 10, paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#6366f1' },
  tabText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#f8fafc' },
  list: { padding: 16, gap: 16 },
  
  // Card
  card: { backgroundColor: '#1e293b', borderRadius: 16, overflow: 'hidden', elevation: 3 },
  progressBarBackground: { height: 4, backgroundColor: '#334155' },
  progressBarFill: { height: '100%' },
  cardContent: { padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leadName: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  destinationText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
  percentBadge: { backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  percentText: { color: '#cbd5e1', fontSize: 12, fontWeight: '800' },
  cardMetaRow: { flexDirection: 'row', gap: 15 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  opsBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  opsBtnText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

  // Modal
  modal: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#1e293b', gap: 15 },
  modalTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  modalSub: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  modalScroll: { padding: 20, gap: 16, paddingBottom: 60 },
  checklistCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, gap: 12, borderWidth: 1, borderColor: '#334155' },
  checklistHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checklistLabel: { color: '#cbd5e1', fontSize: 15, fontWeight: '700' },
  checklistLabelDone: { color: '#10b981', textDecorationLine: 'line-through' },
  checklistContent: { marginTop: 10, paddingLeft: 36, gap: 8 },
  fieldLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: '#f8fafc', borderWidth: 1, borderColor: '#334155', fontSize: 14 },
  subSectionTitle: { color: '#6366f1', fontSize: 12, fontWeight: '800', marginTop: 8, textTransform: 'uppercase' },
  rowTwo: { flexDirection: 'row', gap: 10 },
  itinBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#6366f1' },
  itinText: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },
  itinOption: { padding: 10, backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  itinOptionActive: { borderColor: '#6366f1', backgroundColor: '#6366f111' },
  itinOptionText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  editItinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  editItinText: { color: '#6366f1', fontSize: 12, fontWeight: '700' },
  payBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, gap: 8 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between' },
  payLabel: { color: '#94a3b8', fontSize: 13 },
  payVal: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  genBtn: { backgroundColor: '#10b981', borderRadius: 8, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  genBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 15 },
  emptyTitle: { color: '#475569', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#334155', fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 22 },
});
