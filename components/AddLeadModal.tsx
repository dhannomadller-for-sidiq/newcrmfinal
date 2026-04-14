import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { COUNTRY_CODES } from '@/lib/countryCodes';

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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.pickerSheet, { borderTopLeftRadius: 30, borderTopRightRadius: 30 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Quick Add Lead</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.formContent}>
            <Text style={styles.fieldLabel}>Lead Contact Number</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={[styles.input, { width: 90, justifyContent: 'center' }]} 
                onPress={() => setCodeMenuOpen(true)}
              >
                <Text style={{ color: '#f8fafc', fontSize: 16 }}>{newContactCode}</Text>
              </TouchableOpacity>
              <TextInput 
                style={[styles.input, { flex: 1 }]} 
                placeholder="9876543210" 
                placeholderTextColor="#475569"
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setCodeMenuOpen(false)}>
                <Ionicons name="close" size={26} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <TextInput 
              style={[styles.input, { marginBottom: 12, marginTop: -10 }]} 
              placeholder="Search country or code..." 
              placeholderTextColor="#475569" 
              value={codeSearch} 
              onChangeText={setCodeSearch} 
            />
            <View style={{ flex: 1 }}>
              {COUNTRY_CODES.filter(c => c.name.toLowerCase().includes(codeSearch.toLowerCase()) || c.code.includes(codeSearch)).map((c, i) => (
                <TouchableOpacity key={i} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between' }} onPress={() => { setNewContactCode(c.code); setCodeMenuOpen(false); }}>
                  <Text style={{ color: '#cbd5e1', fontSize: 16 }}>{c.name}</Text>
                  <Text style={{ color: '#10b981', fontSize: 16, fontWeight: 'bold' }}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}
