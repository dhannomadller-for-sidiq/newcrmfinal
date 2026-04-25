import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { Lead, Destination, Itinerary, OPTION_META, FOLLOWUP_STATUSES } from '@/lib/salesConstants';
import { DateField } from './DateField';
import { C } from '@/lib/theme';
import { scheduleFollowupReminder, scheduleEarlyReminder, cancelLeadNotification } from '@/utils/notifications';

function FF({ label, value, onChange, placeholder, keyboardType = 'default', autoCapitalize = 'sentences', styles }: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={C.textMuted} keyboardType={keyboardType as any} autoCapitalize={autoCapitalize} />
    </View>
  );
}

function NextFollowup({ date, setDate, showPicker, setShowPicker, time, setTime, styles }: any) {
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text style={styles.fieldLabel}>📅 Next Follow-up Date</Text>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
        <Ionicons name="calendar-outline" size={17} color="#94a3b8" />
        <Text style={[styles.dateBtnText, date && { color: C.textPrimary }]}>
          {date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Date'}
        </Text>
      </TouchableOpacity>
      <DateField value={date} onChange={setDate} showPicker={showPicker} setShowPicker={setShowPicker} styles={styles} />
      <Text style={styles.fieldLabel}>🕐 Follow-up Time (HH:MM)</Text>
      <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="10:00" placeholderTextColor={C.textMuted} keyboardType="numbers-and-punctuation" />
    </View>
  );
}

export function EditProfileModal({ visible, onClose, lead, destinations, itineraries, onSuccess, styles }: {
  visible: boolean;
  onClose: () => void;
  lead: Lead | null;
  destinations: Destination[];
  itineraries: Itinerary[];
  onSuccess: () => void;
  styles: any;
}) {
  const [fName, setFName] = useState('');
  const [fContact, setFContact] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fBudget, setFBudget] = useState('');
  const [fTravelDate, setFTravelDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fDestId, setFDestId] = useState('');
  const [fItinId, setFItinId] = useState('');
  const [fItinOption, setFItinOption] = useState('');
  const [fNewItinId, setFNewItinId] = useState('');
  const [fNewItinOption, setFNewItinOption] = useState('');
  const [itinFilter, setItinFilter] = useState('');
  const [newItinFilter, setNewItinFilter] = useState('');

  // Follow-up
  const [fFollowupStatus, setFFollowupStatus] = useState('');
  const [followupPickerOpen, setFollowupPickerOpen] = useState(false);
  const [fNextFollowupDate, setFNextFollowupDate] = useState<Date | null>(null);
  const [showNextDatePicker, setShowNextDatePicker] = useState(false);
  const [fNextFollowupTime, setFNextFollowupTime] = useState('');
  const [fRemarks, setFRemarks] = useState('');

  // Advance Paid
  const [fTotalAmount, setFTotalAmount] = useState('');
  const [fAdvancePaid, setFAdvancePaid] = useState('');
  const [fPassportNo, setFPassportNo] = useState('');
  const [fPassportName, setFPassportName] = useState('');
  const [fArrPNR, setFArrPNR] = useState('');
  const [fArrFlightNo, setFArrFlightNo] = useState('');
  const [fArrDepPlace, setFArrDepPlace] = useState('Cochin Airport');
  const [fArrDepDate, setFArrDepDate] = useState('');
  const [fArrDepTime, setFArrDepTime] = useState('');
  const [fArrArrAirport, setFArrArrAirport] = useState('Denpasar Airport');
  const [fArrArrDate, setFArrArrDate] = useState('');
  const [fArrArrTime, setFArrArrTime] = useState('');
  const [fDepPNR, setFDepPNR] = useState('');
  const [fDepFlightNo, setFDepFlightNo] = useState('');
  const [fDepDepPlace, setFDepDepPlace] = useState('Denpasar Airport');
  const [fDepDepDate, setFDepDepDate] = useState('');
  const [fDepDepTime, setFDepDepTime] = useState('');
  const [fDepArrAirport, setFDepArrAirport] = useState('Cochin Airport');
  const [fDepArrDate, setFDepArrDate] = useState('');
  const [fDepArrTime, setFDepArrTime] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      setFName(lead.name === 'Unknown' ? '' : lead.name);
      setFContact(lead.contact_no);
      setFEmail(lead.email ?? '');
      setFBudget(lead.budget ? String(lead.budget) : '');
      setFTravelDate(lead.travel_date ? new Date(lead.travel_date) : null);
      setFDestId('');
      setFItinId(lead.itinerary_id ?? '');
      setFItinOption(lead.itinerary_option ?? '');
      setFNewItinId(''); setFNewItinOption(''); setItinFilter(''); setNewItinFilter('');
      setFFollowupStatus(''); setFNextFollowupDate(null); setFNextFollowupTime(''); setFRemarks('');
      setFTotalAmount(''); setFAdvancePaid('');
      setFPassportNo(''); setFPassportName('');
      setFArrPNR(''); setFArrFlightNo(''); setFArrDepPlace('Cochin Airport'); setFArrDepDate(''); setFArrDepTime('');
      setFArrArrAirport('Denpasar Airport'); setFArrArrDate(''); setFArrArrTime('');
      setFDepPNR(''); setFDepFlightNo(''); setFDepDepPlace('Denpasar Airport'); setFDepDepDate(''); setFDepDepTime('');
      setFDepArrAirport('Cochin Airport'); setFDepArrDate(''); setFDepArrTime('');
    }
  }, [lead]);

  function getNextFollowupTimestamp(): string | null {
    if (!fNextFollowupDate) return null;
    const d = new Date(fNextFollowupDate);
    const timeMatch = fNextFollowupTime.trim().match(/^(\d{1,2})[.: ]?(\d{0,2})\s*(am|pm)?$/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10) || 0;
      const m = parseInt(timeMatch[2], 10) || 0;
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      d.setHours(h, m, 0, 0);
    }
    return d.toISOString();
  }

  function getItinTitle(id: string) {
    return itineraries.find(i => i.id === id)?.title ?? 'Itinerary';
  }

  const duoAmount = fTotalAmount && fAdvancePaid
    ? (parseFloat(fTotalAmount) - parseFloat(fAdvancePaid)).toFixed(0)
    : '';

  async function handleSubmitProfile() {
    if (!lead) return;
    if (!fName.trim() || !fContact.trim()) {
      Alert.alert('Error', 'Name and contact are required.');
      return;
    }
    setSubmitting(true);
    try {
      const destName = destinations.find(d => d.id === fDestId)?.name ?? lead.destination;
      const update: Record<string, unknown> = {
        name: fName.trim(),
        contact_no: fContact.trim(),
        email: fEmail.trim() || null,
        budget: fBudget ? parseFloat(fBudget) : null,
        travel_date: fTravelDate ? fTravelDate.toISOString().split('T')[0] : null,
        destination: destName !== 'TBD' ? destName : lead.destination,
        status: 'Contacted',
        followup_status: fFollowupStatus || null,
      };

      switch (fFollowupStatus) {
        case 'itinerary_sent':
          if (fItinId && !fItinOption) { Alert.alert('Error', 'Please select a travel option.'); setSubmitting(false); return; }
          update.itinerary_id = fItinId || null;
          update.itinerary_option = fItinOption || null;
          update.next_followup_at = getNextFollowupTimestamp();
          break;
        case 'itinerary_updated': {
          if (fNewItinId && !fNewItinOption) { Alert.alert('Error', 'Please select a travel option for the new itinerary.'); setSubmitting(false); return; }
          const history = Array.isArray(lead.itinerary_history) ? [...lead.itinerary_history] : [];
          if (lead.itinerary_id) {
            history.push({
              id: lead.itinerary_id,
              title: getItinTitle(lead.itinerary_id),
              option: lead.itinerary_option,
              option_label: lead.itinerary_option ? (OPTION_META[lead.itinerary_option]?.label ?? lead.itinerary_option) : null
            });
          }
          update.itinerary_history = history;
          update.itinerary_id = fNewItinId || null;
          update.itinerary_option = fNewItinOption || null;
          update.next_followup_at = getNextFollowupTimestamp();
          break;
        }
        case 'followup':
          update.call_remarks = fRemarks;
          update.next_followup_at = getNextFollowupTimestamp();
          break;
        case 'different_location':
          update.returned_to_admin = true;
          update.status = 'New';
          break;
        case 'advance_paid':
          update.status = 'Converted';
          update.itinerary_id = fItinId || null;
          update.itinerary_option = fItinOption || null;
          break;
        case 'dead':
          update.status = 'Lost';
          break;
        default:
          if (fItinId) {
            if (!fItinOption) { Alert.alert('Error', 'Please select a travel option.'); setSubmitting(false); return; }
            update.itinerary_id = fItinId;
            update.itinerary_option = fItinOption || null;
          }
      }

      const { error } = await supabase.from('leads').update(update).eq('id', lead.id);
      if (error) throw error;

      if (fFollowupStatus === 'advance_paid') {
        const itinObj = itineraries.find(i => i.id === fItinId);
        const total = parseFloat(fTotalAmount) || 0;
        const advance = parseFloat(fAdvancePaid) || 0;
        const { error: bookingError } = await supabase.from('confirmed_bookings').insert({
          lead_id: lead.id,
          itinerary_id: fItinId || null,
          itinerary_title: itinObj?.title ?? null,
          total_amount: total,
          advance_paid: advance,
          due_amount: total - advance,
          passport_no: fPassportNo,
          passport_name: fPassportName,
          arr_pnr: fArrPNR,
          arr_flight_no: fArrFlightNo,
          arr_dep_place: fArrDepPlace,
          arr_dep_date: fArrDepDate || null,
          arr_dep_time: fArrDepTime || null,
          arr_arr_airport: fArrArrAirport,
          arr_arr_date: fArrArrDate || null,
          arr_arr_time: fArrArrTime || null,
          dep_pnr: fDepPNR,
          dep_flight_no: fDepFlightNo,
          dep_dep_place: fDepDepPlace,
          dep_dep_date: fDepDepDate || null,
          dep_dep_time: fDepDepTime || null,
          dep_arr_airport: fDepArrAirport,
          dep_arr_date: fDepArrDate || null,
          dep_arr_time: fDepArrTime || null,
        });
        if (bookingError) throw bookingError;
      }

      onSuccess();
      onClose();

      // ── Schedule follow-up notification if a date was set ──────────────
      const followupTimestamp = getNextFollowupTimestamp();
      if (followupTimestamp && lead) {
        const updatedName = fName.trim() || lead.name;
        await scheduleFollowupReminder({ leadId: lead.id, leadName: updatedName, followupAt: followupTimestamp });
        await scheduleEarlyReminder({ leadId: lead.id, leadName: updatedName, followupAt: followupTimestamp });
      } else if (lead && (fFollowupStatus === 'dead' || fFollowupStatus === 'different_location')) {
        // Cancel any existing reminder if lead is dead or returned
        await cancelLeadNotification(lead.id);
      }

      const msgs: Record<string, string> = {
        itinerary_sent: 'Itinerary sent! Lead added to Follow-ups.',
        itinerary_updated: 'Itinerary updated! Lead added to Follow-ups.',
        followup: 'Follow-up scheduled!',
        different_location: 'Lead returned to Admin.',
        advance_paid: '🎉 Booking Confirmed!',
        dead: 'Lead marked as Dead.',
      };
      Alert.alert('✅ Saved', msgs[fFollowupStatus] ?? 'Lead profile updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendItinerary() {
    const itin = itineraries.find(i => i.id === fItinId);
    if (!itin) { Alert.alert('Select an itinerary first'); return; }
    
    const isBali = (itin.title + (itin.description || '')).toLowerCase().includes('bali');
    const sep = "━━━━━━━━━━━━━━━━━━";
    
    let text = `🌴 *NOMADLLER PVT LTD – ${(destinations.find(d => d.id === fDestId)?.name || 'TRIP').toUpperCase()}* 🇮🇩\n\n`;
    const optionLabel = fItinOption ? (OPTION_META[fItinOption]?.label ?? fItinOption) : null;
    text += `✨ *${itin.title} ${optionLabel ? `WITH ${optionLabel.toUpperCase()}` : ''}*\n\n`;
    
    if (fItinOption && itin.pricing_data[fItinOption]) {
      const data: any = itin.pricing_data[fItinOption];
      const priceUSD = data?.price_usd;
      const priceINR = data?.price ?? data;
      
      text += `💰 *PACKAGE COST:*\n`;
      if (priceUSD) {
        text += `• USD ${priceUSD.toLocaleString()} per person\n\n`;
      } else {
        text += `• ₹${(priceINR || 0).toLocaleString()}\n\n`;
      }
      
      text += `👥 *Pax:* 2 Adults (Standard)\n`;
      text += `📅 *Travel Dates:* As per availability\n\n`;
      text += `${sep}\n\n`;
      text += `📍 *ROUTE*\n${destinations.find(d => d.id === fDestId)?.name || 'Scenic Tour'}\n\n`;
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
    // Bali Arrival Card link omitted for the sales profile stage

    if (allNotes.length > 0) {
      text += `\`📌 IMPORTANT NOTES:\`\n`;
      allNotes.forEach(note => { text += `• ${note}\n`; });
      text += `\n${sep}\n\n`;
    }
    
    text += `*NOMADLLER PVT LTD*\n✨ *Explore the Unexplored*`;

    const msg = encodeURIComponent(text);
    const n = fContact.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${n}&text=${msg}`).catch(() =>
      Alert.alert('WhatsApp not installed'));
  }

  const filteredItins = itineraries.filter(i =>
    (!fDestId || i.destination_id === fDestId) &&
    (!itinFilter || i.title.toLowerCase().includes(itinFilter.toLowerCase()))
  );
  const filteredNewItins = itineraries.filter(i =>
    (!fDestId || i.destination_id === fDestId) &&
    (!newItinFilter || i.title.toLowerCase().includes(newItinFilter.toLowerCase()))
  );

  const selectedFollowupMeta = FOLLOWUP_STATUSES.find(s => s.key === fFollowupStatus);



  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Lead Profile</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#94a3b8" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <FF label="Name" value={fName} onChange={setFName} placeholder="Full Name" styles={styles} />
          <FF label="Contact No" value={fContact} onChange={setFContact} placeholder="Phone" keyboardType="phone-pad" styles={styles} />
          <FF label="Email" value={fEmail} onChange={setFEmail} placeholder="email@example.com" keyboardType="email-address" styles={styles} />
          <FF label="Max Budget" value={fBudget} onChange={setFBudget} placeholder="₹ budget" keyboardType="numeric" styles={styles} />

          <Text style={styles.fieldLabel}>Travel Date</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={17} color="#94a3b8" />
            <Text style={[styles.dateBtnText, fTravelDate && { color: C.textPrimary }]}>
              {fTravelDate ? fTravelDate.toLocaleDateString('en-IN') : 'Select Date'}
            </Text>
          </TouchableOpacity>
          <DateField value={fTravelDate} onChange={setFTravelDate} showPicker={showDatePicker} setShowPicker={setShowDatePicker} styles={styles} />

          {/* Destination */}
          <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Destination</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {destinations.map(d => (
                <TouchableOpacity key={d.id} style={[styles.chip, fDestId === d.id && styles.chipActive]}
                  onPress={() => { setFDestId(d.id); setFItinId(''); setFNewItinId(''); }}>
                  <Text style={[styles.chipText, fDestId === d.id && styles.chipTextActive]}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {fDestId !== '' && (
            <View style={styles.bookCard}>
              <Text style={styles.bookCardTitle}>Select Itinerary</Text>
              <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }]}>
                <Ionicons name="search-outline" size={15} color="#64748b" />
                <TextInput style={{ flex: 1, color: C.textPrimary, backgroundColor: 'transparent' }} value={itinFilter} onChangeText={setItinFilter} placeholder="Search..." placeholderTextColor={C.textMuted} />
              </View>
              {filteredItins.map(itin => (
                <TouchableOpacity key={itin.id} style={[styles.card, { padding: 12, borderLeftWidth: 0 }, fItinId === itin.id && { borderColor: '#10b981' }]} onPress={() => { setFItinId(itin.id); setFItinOption(''); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name={fItinId === itin.id ? 'radio-button-on' : 'radio-button-off'} size={17} color={fItinId === itin.id ? '#10b981' : '#475569'} />
                    <Text style={[styles.bookGridValue, fItinId === itin.id && { color: '#10b981' }]}>{itin.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {fItinId !== '' && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.fieldLabel}>Select Travel Option</Text>
                  {(() => {
                    const itin = itineraries.find(i => i.id === fItinId);
                    if (!itin) return null;
                    return Object.keys(itin.pricing_data).map(k => {
                      const meta = OPTION_META[k];
                      const price = (itin.pricing_data[k] as any)?.price ?? itin.pricing_data[k];
                      if (!meta) return null;
                      return (
                        <TouchableOpacity key={k} style={[styles.card, { padding: 12, borderLeftWidth: 4, borderLeftColor: fItinOption === k ? meta.color : '#1e1e1e' }]} onPress={() => setFItinOption(k)}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name={meta.icon as any} size={16} color={fItinOption === k ? meta.color : '#475569'} />
                              <Text style={[styles.bookGridValue, fItinOption === k && { color: meta.color }]}>{meta.label}</Text>
                            </View>
                            <Text style={{ color: fItinOption === k ? meta.color : '#f8fafc', fontWeight: '800' }}>₹{price}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSendItinerary}><Ionicons name="logo-whatsapp" size={18} color="#fff" style={{ marginRight: 8 }} /><Text style={styles.saveBtnText}>Send to WhatsApp</Text></TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={[styles.saveBtn, { backgroundColor: '#1e293b', height: 1 }]} />

          <Text style={[styles.bookCardTitle, { marginTop: 10 }]}>Update Follow-up Status</Text>
          <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between' }, selectedFollowupMeta && { borderColor: selectedFollowupMeta.color }]} onPress={() => setFollowupPickerOpen(true)}>
            {selectedFollowupMeta ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name={selectedFollowupMeta.icon as any} size={16} color={selectedFollowupMeta.color} /><Text style={{ color: selectedFollowupMeta.color, fontWeight: '700' }}>{selectedFollowupMeta.label}</Text></View> : <Text style={{ color: C.textMuted }}>Select status...</Text>}
            <Ionicons name="chevron-down" size={16} color="#475569" />
          </TouchableOpacity>

          {fFollowupStatus === 'itinerary_sent' && (
            <View style={[styles.bookCard, { borderColor: C.primary + '55' }]}>
              <Text style={{ color: C.primary, fontWeight: '800' }}>Confirm Sending</Text>
              {fItinId ? <Text style={styles.bookGridValue}>✅ {getItinTitle(fItinId)}</Text> : <Text style={{ color: '#ef4444' }}>⚠️ Select itinerary first</Text>}
              <NextFollowup date={fNextFollowupDate} setDate={setFNextFollowupDate} showPicker={showNextDatePicker} setShowPicker={setShowNextDatePicker} time={fNextFollowupTime} setTime={setFNextFollowupTime} styles={styles} />
            </View>
          )}

          {fFollowupStatus === 'followup' && (
            <View style={[styles.bookCard, { borderColor: C.green + '55' }]}>
              <Text style={styles.fieldLabel}>Call Remarks</Text>
              <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={fRemarks} onChangeText={setFRemarks} placeholder="Notes..." placeholderTextColor={C.textMuted} multiline />
              <NextFollowup date={fNextFollowupDate} setDate={setFNextFollowupDate} showPicker={showNextDatePicker} setShowPicker={setShowNextDatePicker} time={fNextFollowupTime} setTime={setFNextFollowupTime} styles={styles} />
            </View>
          )}

          {fFollowupStatus === 'advance_paid' && (
            <View style={[styles.bookCard, { borderColor: C.green + '55' }]}>
              <Text style={styles.bookCardTitle}>💰 Payment Details</Text>
              <FF label="Total Amount (₹)" value={fTotalAmount} onChange={setFTotalAmount} placeholder="100000" keyboardType="numeric" styles={styles} />
              <FF label="Advance Paid (₹)" value={fAdvancePaid} onChange={setFAdvancePaid} placeholder="50000" keyboardType="numeric" styles={styles} />
              <View style={[styles.bookRow, { borderBottomWidth: 0 }]}><Text style={styles.bookLabel}>Due Amount</Text><Text style={[styles.bookValue, { color: '#f59e0b', fontSize: 20 }]}>₹{duoAmount ? parseInt(duoAmount).toLocaleString() : '—'}</Text></View>
              <Text style={styles.bookCardTitle}>🛂 Passport Details</Text>
              <FF label="Passport No" value={fPassportNo} onChange={setFPassportNo} placeholder="A1234567" styles={styles} />
              <FF label="Passport Name" value={fPassportName} onChange={setFPassportName} autoCapitalize="characters" styles={styles} />
              
              <Text style={styles.bookCardTitle}>✈️ Flight Details</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <FF label="Arrival PNR" value={fArrPNR} onChange={setFArrPNR} placeholder="PNR" autoCapitalize="characters" styles={styles} />
                </View>
                <View style={{ flex: 1 }}>
                  <FF label="Arrival Flight #" value={fArrFlightNo} onChange={setFArrFlightNo} placeholder="UK836" autoCapitalize="characters" styles={styles} />
                </View>
              </View>
              
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <FF label="Departure PNR" value={fDepPNR} onChange={setFDepPNR} placeholder="PNR" autoCapitalize="characters" styles={styles} />
                </View>
                <View style={{ flex: 1 }}>
                  <FF label="Departure Flight #" value={fDepFlightNo} onChange={setFDepFlightNo} placeholder="UK837" autoCapitalize="characters" styles={styles} />
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSubmitProfile} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Lead</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Modal visible={followupPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setFollowupPickerOpen(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Select Status</Text>
            {FOLLOWUP_STATUSES.map(fs => (
              <TouchableOpacity key={fs.key} style={[styles.pickerItem, fFollowupStatus === fs.key && { backgroundColor: fs.color + '22' }]} onPress={() => { setFFollowupStatus(fs.key); setFollowupPickerOpen(false); }}>
                <Ionicons name={fs.icon as any} size={18} color={fs.color} />
                <Text style={[styles.pickerItemText, fFollowupStatus === fs.key && { color: fs.color, fontWeight: '700' }]}>{fs.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}
