import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { COUNTRY_CODES } from '@/lib/countryCodes';
import { C, R, S } from '@/lib/theme';

export function AddLeadModal({ visible, onClose, onSuccess, styles }: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  styles: any;
}) {
  const { profile } = useAuth();
  const [newContact, setNewContact] = useState('');
  const [newContactCode, setNewContactCode] = useState('+91');
  const [codeMenuOpen, setCodeMenuOpen] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAddLead() {
    if (!newContact.trim()) {
      Alert.alert('Error', 'Contact number is required.');
      return;
    }
    if (!profile) return;

    setSaving(true);
    const { error } = await supabase.from('leads').insert({
      name: 'Unknown',
      contact_no: `${newContactCode} ${newContact.trim()}`,
      destination: 'TBD',
      added_by: profile.id,
    });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setNewContact('');
    onSuccess();
    onClose();
  }

  const filteredCodes = COUNTRY_CODES.filter(
    c => c.name.toLowerCase().includes(codeSearch.toLowerCase()) || c.code.includes(codeSearch)
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.pickerSheet, { borderTopLeftRadius: 30, borderTopRightRadius: 30 }]}>
          {/* Header */}
          <View style={ls.sheetHeader}>
            <Text style={ls.sheetTitle}>Quick Add Lead</Text>
            <TouchableOpacity onPress={onClose} style={ls.closeBtn}>
              <Ionicons name="close" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={ls.divider} />

          <View style={styles.formContent}>
            <Text style={styles.fieldLabel}>Lead Contact Number</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Country code button */}
              <TouchableOpacity
                style={ls.codeBtn}
                onPress={() => setCodeMenuOpen(true)}
              >
                <Text style={ls.codeBtnText}>{newContactCode}</Text>
                <Ionicons name="chevron-down" size={12} color={C.textMuted} />
              </TouchableOpacity>

              {/* Phone number input */}
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="9876543210"
                placeholderTextColor={C.textMuted}
                keyboardType="phone-pad"
                value={newContact}
                onChangeText={setNewContact}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: 20 }]}
              onPress={handleAddLead}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Lead</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Country Code Picker */}
      <Modal visible={codeMenuOpen} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCodeMenuOpen(false)}>
          <View style={[styles.pickerSheet, { height: '80%', paddingBottom: 40 }]}>
            {/* Picker Header */}
            <View style={ls.sheetHeader}>
              <Text style={ls.sheetTitle}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setCodeMenuOpen(false)} style={ls.closeBtn}>
                <Ionicons name="close" size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={ls.divider} />

            {/* Search */}
            <View style={ls.searchRow}>
              <Ionicons name="search-outline" size={16} color={C.textMuted} />
              <TextInput
                style={ls.searchInput}
                placeholder="Search country or code..."
                placeholderTextColor={C.textMuted}
                value={codeSearch}
                onChangeText={setCodeSearch}
              />
            </View>

            {/* List */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {filteredCodes.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={ls.codeRow}
                  onPress={() => { setNewContactCode(c.code); setCodeMenuOpen(false); setCodeSearch(''); }}
                >
                  <Text style={ls.codeName}>{c.name}</Text>
                  <View style={ls.codeTag}>
                    <Text style={ls.codeTagText}>{c.code}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const ls = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: S.md,
  },
  sheetTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '900' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surface2, justifyContent: 'center', alignItems: 'center',
  },
  divider: { height: 1, backgroundColor: C.border, marginBottom: S.lg },

  codeBtn: {
    width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: C.surface2,
    borderRadius: R.sm, borderWidth: 1.5, borderColor: C.border,
    paddingVertical: S.md,
  },
  codeBtnText: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.surface2, borderRadius: R.sm,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, marginBottom: S.md,
  },
  searchInput: { flex: 1, color: C.textPrimary, fontSize: 15, paddingVertical: S.sm, backgroundColor: 'transparent' },

  codeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  codeName:    { color: C.textSecond, fontSize: 15 },
  codeTag:     { backgroundColor: C.primaryLight, paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.xs },
  codeTagText: { color: C.primary, fontSize: 14, fontWeight: '800' },
});
