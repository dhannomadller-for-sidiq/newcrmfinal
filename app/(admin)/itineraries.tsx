import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/utils/supabase';
import { C, R, S } from '@/lib/theme';
import { getLiveUsdRate } from '@/utils/liveRate';

// ─── Types ──────────────────────────────────────────────────────────────────
type Destination = {
  id: string; name: string;
  options_car: boolean; options_bike: boolean; options_cab: boolean;
};

type OptionData = { inclusions: string[]; exclusions: string[]; price: string; price_usd?: string };
type OptionsMap = { car?: OptionData; bike?: OptionData; cab?: OptionData };

type Itinerary = {
  description?: string;
  important_notes?: string;
  id: string; title: string; destination_id: string;
  inclusions: string[]; exclusions: string[];
  pricing_data: Record<string, unknown>;
};

// ─── Option meta ─────────────────────────────────────────────────────────────
const OPTION_META = {
  car:  { label: 'Self-Drive Car',  icon: 'car-outline',     color: '#6366f1' },
  bike: { label: 'Self-Drive Bike', icon: 'bicycle-outline', color: '#f59e0b' },
  cab:  { label: 'Cab Service',     icon: 'bus-outline',     color: '#10b981' },
} as const;

type OptionKey = keyof typeof OPTION_META;

function emptyOption(): OptionData {
  return { inclusions: [], exclusions: [], price: '', price_usd: '' };
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ItinerariesScreen() {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItinId, setEditItinId] = useState<string | null>(null);
  const [liveRate, setLiveRate] = useState<number | null>(null);

  // ── Form state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [importantNotes, setImportantNotes] = useState('');
  const [destId, setDestId] = useState('');
  const [destPickerOpen, setDestPickerOpen] = useState(false);
  const [optionsMap, setOptionsMap] = useState<OptionsMap>({});

  // Per-option input buffers  { car: { incInput, excInput }, … }
  const [incInputs, setIncInputs] = useState<Record<string, string>>({});
  const [excInputs, setExcInputs] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [itin, dest, rate] = await Promise.all([
      supabase.from('itineraries').select('*').order('created_at', { ascending: false }),
      supabase.from('destinations').select('*').order('name'),
      getLiveUsdRate(),
    ]);
    setItineraries(itin.data ?? []);
    setDestinations(dest.data ?? []);
    setLiveRate(rate);
    setLoading(false);
  }

  // ── Destination selection ─────────────────────────────────────────────────
  function selectDestination(d: Destination) {
    setDestId(d.id);
    setDestPickerOpen(false);
    // Build options map based on enabled options
    const newMap: OptionsMap = {};
    if (d.options_car)  newMap.car  = emptyOption();
    if (d.options_bike) newMap.bike = emptyOption();
    if (d.options_cab)  newMap.cab  = emptyOption();
    setOptionsMap(newMap);
    setIncInputs({}); setExcInputs({});
  }

  const selectedDest = destinations.find(d => d.id === destId);

  // ── Per-option helpers ────────────────────────────────────────────────────
  function addInclusion(key: OptionKey) {
    const val = (incInputs[key] ?? '').trim();
    if (!val) return;
    setOptionsMap(prev => ({
      ...prev,
      [key]: { ...prev[key]!, inclusions: [...(prev[key]?.inclusions ?? []), val] },
    }));
    setIncInputs(p => ({ ...p, [key]: '' }));
  }

  function removeInclusion(key: OptionKey, idx: number) {
    setOptionsMap(prev => ({
      ...prev,
      [key]: { ...prev[key]!, inclusions: prev[key]!.inclusions.filter((_, i) => i !== idx) },
    }));
  }

  function addExclusion(key: OptionKey) {
    const val = (excInputs[key] ?? '').trim();
    if (!val) return;
    setOptionsMap(prev => ({
      ...prev,
      [key]: { ...prev[key]!, exclusions: [...(prev[key]?.exclusions ?? []), val] },
    }));
    setExcInputs(p => ({ ...p, [key]: '' }));
  }

  function removeExclusion(key: OptionKey, idx: number) {
    setOptionsMap(prev => ({
      ...prev,
      [key]: { ...prev[key]!, exclusions: prev[key]!.exclusions.filter((_, i) => i !== idx) },
    }));
  }

  function setPriceUSD(key: OptionKey, usdVal: string) {
    const activeRate = (liveRate ?? 95) + 2;
    const inrVal = usdVal ? (parseFloat(usdVal) * activeRate).toFixed(0) : '';
    setOptionsMap(prev => ({ 
      ...prev, 
      [key]: { ...prev[key]!, price_usd: usdVal, price: inrVal } 
    }));
  }

  function setPriceINR(key: OptionKey, val: string) {
    setOptionsMap(prev => ({ ...prev, [key]: { ...prev[key]!, price: val } }));
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim() || !destId) {
      Alert.alert('Error', 'Title and destination are required.');
      return;
    }
    const enabledKeys = Object.keys(optionsMap) as OptionKey[];
    if (enabledKeys.length === 0) {
      Alert.alert('Error', 'This destination has no transport options enabled. Please add options in Destinations first.');
      return;
    }

    // Build pricing_data as nested per-option object
    const pricingData: Record<string, unknown> = {};
    for (const key of enabledKeys) {
      const opt = optionsMap[key]!;
      pricingData[key] = {
        inclusions: opt.inclusions,
        exclusions: opt.exclusions,
        price: opt.price ? parseFloat(opt.price) : 0,
        price_usd: opt.price_usd ? parseFloat(opt.price_usd) : null,
      };
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      important_notes: importantNotes.trim() || null,
      destination_id: destId,
      inclusions: [],
      exclusions: [],
      pricing_data: pricingData,
    };
    
    let error;
    if (editItinId) {
      const { error: e } = await supabase.from('itineraries').update(payload).eq('id', editItinId);
      error = e;
    } else {
      const { error: e } = await supabase.from('itineraries').insert(payload);
      error = e;
    }

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    resetForm();
    fetchAll();
  }

  function handleEditClick(item: Itinerary) {
    setEditItinId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? '');
    setImportantNotes(item.important_notes ?? '');
    setDestId(item.destination_id);
    
    // Restore options form state
    const restoredMap: OptionsMap = {};
    for (const k of Object.keys(item.pricing_data) as OptionKey[]) {
      const d = item.pricing_data[k] as any;
      if (d) {
        restoredMap[k] = {
          price: d.price?.toString() ?? '',
          price_usd: d.price_usd?.toString() ?? '',
          inclusions: d.inclusions ?? [],
          exclusions: d.exclusions ?? []
        };
      }
    }
    setOptionsMap(restoredMap);
    setIncInputs({});
    setExcInputs({});
    setModalVisible(true);
  }

  function resetForm() {
    setEditItinId(null); setTitle(''); setDescription(''); setImportantNotes(''); setDestId(''); setOptionsMap({});
    setIncInputs({}); setExcInputs({});
  }

  function getDestName(id: string) { return destinations.find(d => d.id === id)?.name ?? '—'; }

  // ── Option summary for list card ──────────────────────────────────────────
  function getOptionSummary(itin: Itinerary) {
    const keys = Object.keys(itin.pricing_data) as OptionKey[];
    return keys.map(k => OPTION_META[k]?.label ?? k).join(' · ');
  }

  function handleCopyItinerary(itin: Itinerary, optKey: OptionKey) {
    const meta = OPTION_META[optKey];
    const data = itin.pricing_data[optKey] as OptionData | undefined;
    if (!data || !meta) return;

    const isBali = (itin.title + (itin.description || '')).toLowerCase().includes('bali');
    const sep = "━━━━━━━━━━━━━━━━━━";
    
    let text = `🌴 *NOMADLLER PVT LTD – ${getDestName(itin.destination_id).toUpperCase()}* 🇮🇩\n\n`;
    text += `✨ *${itin.title} WITH ${meta.label.toUpperCase()}*\n\n`;
    
    text += `💰 *PACKAGE COST:*\n`;
    if (data?.price_usd) {
      text += `• USD ${data.price_usd.toLocaleString()} per person\n\n`;
    } else {
      text += `• ₹${(data?.price || 0).toLocaleString()}\n\n`;
    }
    
    text += `👥 *Pax:* 2 Adults (Standard)\n`;
    text += `📅 *Travel Dates:* As per availability\n\n`;
    text += `${sep}\n\n`;
    text += `📍 *ROUTE*\n${getDestName(itin.destination_id)}\n\n`;
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

    if (itin.important_notes) {
      text += `\`📌 IMPORTANT NOTES:\`\n`;
      text += `• ${itin.important_notes}\n`;
      text += `\n${sep}\n\n`;
    }
    
    text += `*NOMADLLER PVT LTD*\n✨ *Explore the Unexplored*`;

    Clipboard.setStringAsync(text);
    Alert.alert('✅ Copied!', `${meta?.label ?? optKey} details copied to clipboard in Premium Format.`);
  }

  // ── Render list card ──────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Itinerary }) => (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.iTitle}>{item.title}</Text>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={14} color="#6366f1" />
            <Text style={styles.destText}>{getDestName(item.destination_id)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleEditClick(item)} style={{ padding: 6, backgroundColor: C.primaryLight, borderRadius: 8 }}>
          <Ionicons name="create-outline" size={18} color={C.primary} />
        </TouchableOpacity>
      </View>
      {Object.keys(item.pricing_data).length > 0 && (
        <View style={{ marginTop: 12, gap: 12 }}>
          {(Object.keys(item.pricing_data) as OptionKey[]).map(k => {
            const data = item.pricing_data[k] as OptionData;
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
                      <Text style={{ color: C.green, fontSize: 15, fontWeight: '800' }}>₹{data.price}</Text>
                    ) : null}
                    {data.price_usd ? (
                      <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>${data.price_usd}</Text>
                    ) : null}
                  </View>
                </View>
                {data.inclusions?.length > 0 && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 2, textTransform: 'uppercase' }}>INCLUSIONS</Text>
                    {data.inclusions.map((inc, i) => (
                      <Text key={`inc-${i}`} style={{ color: C.textSecond, fontSize: 12, marginBottom: 1 }}>• {inc}</Text>
                    ))}
                  </View>
                )}
                {data.exclusions?.length > 0 && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 2, textTransform: 'uppercase' }}>EXCLUSIONS</Text>
                    {data.exclusions.map((exc, i) => (
                      <Text key={`exc-${i}`} style={{ color: C.red, fontSize: 12, marginBottom: 1 }}>• {exc}</Text>
                    ))}
                  </View>
                )}
                <TouchableOpacity onPress={() => handleCopyItinerary(item, k)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: meta.color + '22', paddingVertical: 10, borderRadius: 8 }}>
                  <Ionicons name="copy-outline" size={15} color={meta.color} />
                  <Text style={{ color: meta.color, fontSize: 13, fontWeight: '700' }}>Copy Details</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  // ── Render option section ─────────────────────────────────────────────────
  function renderOptionSection(key: OptionKey) {
    const meta = OPTION_META[key];
    const opt = optionsMap[key]!;
    return (
      <View key={key} style={[styles.optionSection, { borderColor: meta.color + '55' }]}>
        {/* Option header */}
        <View style={[styles.optionHeader, { backgroundColor: meta.color + '22' }]}>
          <Ionicons name={meta.icon as any} size={18} color={meta.color} />
          <Text style={[styles.optionHeaderText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        {/* Price USD */}
        <View style={styles.fieldGroup}>
          <Text style={styles.subLabel}>💰 Price ($ USD)</Text>
          <TextInput
            style={styles.input}
            value={opt.price_usd}
            onChangeText={v => setPriceUSD(key, v)}
            placeholder="e.g. 300"
            placeholderTextColor="#475569"
            keyboardType="numeric"
          />
        </View>

        {/* Price INR (Auto) */}
        <View style={styles.fieldGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.subLabel}>₹ Price (Calculated INR)</Text>
            <Text style={{ fontSize: 10, color: C.textMuted }}>Rate used: {liveRate ? liveRate + 2 : '—'}</Text>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, opacity: 0.8 }]}
            value={opt.price}
            onChangeText={v => setPriceINR(key, v)}
            placeholder="Auto-calculated"
            placeholderTextColor="#475569"
            keyboardType="numeric"
          />
        </View>

        {/* Inclusions */}
        <Text style={styles.subLabel}>✅ Inclusions</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={incInputs[key] ?? ''}
            onChangeText={v => setIncInputs(p => ({ ...p, [key]: v }))}
            placeholder="e.g. Hotel stay"
            placeholderTextColor="#475569"
          />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: meta.color }]} onPress={() => addInclusion(key)}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {opt.inclusions.map((inc, i) => (
          <View key={i} style={styles.tagRow}>
            <Ionicons name="checkmark-circle" size={15} color="#10b981" />
            <Text style={styles.tagText}>{inc}</Text>
            <TouchableOpacity onPress={() => removeInclusion(key, i)}>
              <Ionicons name="close" size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Exclusions */}
        <Text style={[styles.subLabel, { marginTop: 6 }]}>❌ Exclusions</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={excInputs[key] ?? ''}
            onChangeText={v => setExcInputs(p => ({ ...p, [key]: v }))}
            placeholder="e.g. Flights"
            placeholderTextColor="#475569"
          />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: meta.color }]} onPress={() => addExclusion(key)}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {opt.exclusions.map((ex, i) => (
          <View key={i} style={styles.tagRow}>
            <Ionicons name="close-circle" size={15} color="#ef4444" />
            <Text style={styles.tagText}>{ex}</Text>
            <TouchableOpacity onPress={() => removeExclusion(key, i)}>
              <Ionicons name="close" size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={itineraries}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No itineraries yet.</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setModalVisible(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── New Itinerary Modal ────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editItinId ? 'Edit Itinerary' : 'New Itinerary'}</Text>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Itinerary Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="5D Leh Ladakh Adventure"
                placeholderTextColor="#475569"
              />
            </View>

            {/* Detailed Itinerary */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Detailed Itinerary</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder={`Day 1: Arrive, check in to hotel...\nDay 2: Morning sightseeing...\nDay 3: Adventure activities...`}
                placeholderTextColor="#475569"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Important Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>📌 Important Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea, { minHeight: 80 }]}
                value={importantNotes}
                onChangeText={setImportantNotes}
                placeholder="e.g. Original ID card required, carry heavy woolens, etc."
                placeholderTextColor="#475569"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* ── Destination Dropdown ─────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Destination *</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setDestPickerOpen(true)}>
                <Ionicons name="location-outline" size={18} color={selectedDest ? '#6366f1' : '#475569'} />
                <Text style={[styles.dropdownText, selectedDest && styles.dropdownTextSelected]}>
                  {selectedDest ? selectedDest.name : 'Select destination…'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* ── Per-option sections ───────────────────────────────────── */}
            {(Object.keys(optionsMap) as OptionKey[]).map(key => renderOptionSection(key))}

            {destId && Object.keys(optionsMap).length === 0 && (
              <View style={styles.noOptionsHint}>
                <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                <Text style={styles.noOptionsText}>
                  This destination has no transport options enabled. Edit it in Destinations tab first.
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editItinId ? 'Update Itinerary' : 'Save Itinerary'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Destination Picker Modal ─────────────────────────────────────── */}
      <Modal visible={destPickerOpen} animationType="fade" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDestPickerOpen(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Select Destination</Text>
            {destinations.map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.pickerItem, destId === d.id && styles.pickerItemActive]}
                onPress={() => selectDestination(d)}
              >
                <Ionicons name="location" size={16} color={destId === d.id ? '#6366f1' : '#64748b'} />
                <Text style={[styles.pickerItemText, destId === d.id && styles.pickerItemTextActive]}>
                  {d.name}
                </Text>
                {/* Show option flags */}
                <View style={styles.optionFlags}>
                  {d.options_car  && <Ionicons name="car-outline"      size={14} color="#6366f1" />}
                  {d.options_bike && <Ionicons name="bicycle-outline"  size={14} color="#f59e0b" />}
                  {d.options_cab  && <Ionicons name="bus-outline"      size={14} color="#10b981" />}
                </View>
                {destId === d.id && <Ionicons name="checkmark" size={18} color="#6366f1" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { padding: S.lg, gap: S.sm },

  // List card
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  iTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  destText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  optionBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 4 },
  optionBadgeText: { fontSize: 11, fontWeight: '600' },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 60, fontSize: 15 },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },

  // Modal
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: S.xl, paddingTop: S.xxl, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  formContent: { padding: S.xl, gap: S.lg, paddingBottom: 40 },
  fieldGroup: { gap: S.xs },
  fieldLabel: { color: C.textSecond, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.surface2, color: C.textPrimary, borderRadius: R.sm, padding: 14, fontSize: 15, borderWidth: 1.5, borderColor: C.border },
  textArea: { minHeight: 130, lineHeight: 22 },

  // Dropdown
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: R.sm, padding: 14, borderWidth: 1.5, borderColor: C.border },
  dropdownText: { flex: 1, color: C.textMuted, fontSize: 15 },
  dropdownTextSelected: { color: C.textPrimary, fontWeight: '700' },

  // Per-option section
  optionSection: { borderWidth: 1.5, borderRadius: R.lg, padding: S.md, gap: S.sm },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: R.sm, padding: 10 },
  optionHeaderText: { fontSize: 15, fontWeight: '800' },
  subLabel: { color: C.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: { borderRadius: R.sm, padding: 12 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: R.xs, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  tagText: { color: C.textSecond, fontSize: 13, flex: 1 },

  // No options hint
  noOptionsHint: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.amberLight, borderRadius: R.sm, padding: 14, borderWidth: 1, borderColor: C.amber + '44' },
  noOptionsText: { color: C.amber, fontSize: 13, flex: 1, lineHeight: 20 },

  // Save
  saveBtn: { backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Destination picker overlay
  overlay: { flex: 1, backgroundColor: '#00000044', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: C.surface, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xl, gap: 4, paddingBottom: 40, borderTopWidth: 1, borderColor: C.border },
  pickerTitle: { color: C.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: S.sm },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: R.sm },
  pickerItemActive: { backgroundColor: C.primaryLight },
  pickerItemText: { flex: 1, color: C.textSecond, fontSize: 16 },
  pickerItemTextActive: { color: C.primary, fontWeight: '800' },
  optionFlags: { flexDirection: 'row', gap: 4 },
});
