import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/utils/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────
type Destination = {
  id: string; name: string;
  options_car: boolean; options_bike: boolean; options_cab: boolean;
};

type OptionData = { inclusions: string[]; exclusions: string[]; price: string };
type OptionsMap = { car?: OptionData; bike?: OptionData; cab?: OptionData };

type Itinerary = {
  description?: string;
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
  return { inclusions: [], exclusions: [], price: '' };
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ItinerariesScreen() {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItinId, setEditItinId] = useState<string | null>(null);

  // ── Form state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
    const [itin, dest] = await Promise.all([
      supabase.from('itineraries').select('*').order('created_at', { ascending: false }),
      supabase.from('destinations').select('*').order('name'),
    ]);
    setItineraries(itin.data ?? []);
    setDestinations(dest.data ?? []);
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

  function setPrice(key: OptionKey, val: string) {
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
      };
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
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
    setDestId(item.destination_id);
    
    // Restore options form state
    const restoredMap: OptionsMap = {};
    for (const k of Object.keys(item.pricing_data) as OptionKey[]) {
      const d = item.pricing_data[k] as any;
      if (d) {
        restoredMap[k] = {
          price: d.price?.toString() ?? '',
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
    setEditItinId(null); setTitle(''); setDescription(''); setDestId(''); setOptionsMap({});
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
    if (!data) return;

    let text = `*${itin.title} WITH ${(meta?.label ?? optKey).toUpperCase()}*\n📍 ${getDestName(itin.destination_id)}\n`;
    if (itin.description) text += `\n${itin.description}\n`;
    text += `\n*💰 Price:* ₹${data.price}\n`;

    if (data.inclusions && data.inclusions.length > 0) {
      text += `\n*✅ Inclusions:*\n` + data.inclusions.map(i => `- ${i}`).join('\n');
    }
    if (data.exclusions && data.exclusions.length > 0) {
      text += `\n*❌ Exclusions:*\n` + data.exclusions.map(e => `- ${e}`).join('\n');
    }

    Clipboard.setStringAsync(text);
    Alert.alert('✅ Copied!', `${meta?.label ?? optKey} details copied to clipboard.`);
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
        <TouchableOpacity onPress={() => handleEditClick(item)} style={{ padding: 6, backgroundColor: '#334155', borderRadius: 8 }}>
          <Ionicons name="create-outline" size={18} color="#cbd5e1" />
        </TouchableOpacity>
      </View>
      {Object.keys(item.pricing_data).length > 0 && (
        <View style={{ marginTop: 12, gap: 12 }}>
          {(Object.keys(item.pricing_data) as OptionKey[]).map(k => {
            const data = item.pricing_data[k] as OptionData;
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
                    {data.inclusions.map((inc, i) => (
                      <Text key={`inc-${i}`} style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 1 }}>• {inc}</Text>
                    ))}
                  </View>
                )}
                {data.exclusions?.length > 0 && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>EXCLUSIONS</Text>
                    {data.exclusions.map((exc, i) => (
                      <Text key={`exc-${i}`} style={{ color: '#64748b', fontSize: 12, marginBottom: 1 }}>• {exc}</Text>
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

        {/* Price */}
        <View style={styles.fieldGroup}>
          <Text style={styles.subLabel}>💰 Price (₹)</Text>
          <TextInput
            style={styles.input}
            value={opt.price}
            onChangeText={v => setPrice(key, v)}
            placeholder="e.g. 25000"
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16, gap: 12 },

  // List card
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 8 },
  iTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  destText: { color: '#6366f1', fontSize: 13 },
  optionBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  optionBadgeText: { fontSize: 11, fontWeight: '600' },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },

  // Modal
  modal: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modalTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  formContent: { padding: 20, gap: 16, paddingBottom: 40 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  textArea: { minHeight: 130, lineHeight: 22 },

  // Dropdown
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#334155' },
  dropdownText: { flex: 1, color: '#475569', fontSize: 15 },
  dropdownTextSelected: { color: '#f8fafc', fontWeight: '600' },

  // Per-option section
  optionSection: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
  optionHeaderText: { fontSize: 15, fontWeight: '700' },
  subLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: { borderRadius: 10, padding: 12 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  tagText: { color: '#cbd5e1', fontSize: 13, flex: 1 },

  // No options hint
  noOptionsHint: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#1e293b', borderRadius: 10, padding: 14 },
  noOptionsText: { color: '#f59e0b', fontSize: 13, flex: 1, lineHeight: 20 },

  // Save
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Destination picker overlay
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4, paddingBottom: 40 },
  pickerTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10 },
  pickerItemActive: { backgroundColor: '#6366f122' },
  pickerItemText: { flex: 1, color: '#cbd5e1', fontSize: 16 },
  pickerItemTextActive: { color: '#f8fafc', fontWeight: '700' },
  optionFlags: { flexDirection: 'row', gap: 4 },
});
