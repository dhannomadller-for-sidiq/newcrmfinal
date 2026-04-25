import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Modal, TextInput, Alert, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { generatePaymentBill } from '@/utils/billGenerator';
import { C, R, S } from '@/lib/theme';

type Lead = {
  id: string;
  name: string;
  contact_no: string;
  destination: string;
  total_amount: number;
  followup_status: string;
  assigned_to: string;
  assigned_to_profile?: { name: string | null };
  confirmed_bookings?: { total_amount: number; advance_paid: number; total_amount_usd?: number | null; advance_paid_usd?: number | null; due_amount_usd?: number | null; id?: string }[];
};

type Payment = {
  id: string;
  lead_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference_no: string;
};

type FinanceStats = { gross: number; collected: number; pending: number };



type Bank = {
  id: string;
  bank_name: string;
  beneficiary_name: string;
  balance: number;
};


function StatCard({ label, value, icon, color, bg }: { label: string; value: string; icon: string; color: string; bg: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function FinanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<FinanceStats>({ gross: 0, collected: 0, pending: 0 });

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [editTotalModal, setEditTotalModal] = useState(false);
  const [generatingBill, setGeneratingBill] = useState(false);
  const [converting, setConverting] = useState(false);

  const [newAmount, setNewAmount] = useState('');
  const [newMethod, setNewMethod] = useState('upi');
  const [newRef, setNewRef] = useState('');
  const [newTotal, setNewTotal] = useState('');

  const [salesStats, setSalesStats] = useState<{ name: string; value: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'bookings' | 'banks'>('bookings');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [addBankModal, setAddBankModal] = useState(false);
  const [bankTxModal, setBankTxModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [bankName, setBankName] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');


  const fetchData = useCallback(async () => {
    try {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select(`
          *,
          assigned_to_profile:profiles!assigned_to(name),
          confirmed_bookings(total_amount, advance_paid)
        `)
        .in('status', ['Converted', 'Allocated'])
        .order('created_at', { ascending: false });

      if (leadError) throw leadError;

      const { data: paymentData } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });

      const safePayments = paymentData ?? [];
      const safeLeads: Lead[] = (leadData ?? []).map(l => {
        const confTotal = l.confirmed_bookings?.[0]?.total_amount;
        return {
          ...l,
          total_amount: confTotal !== undefined && confTotal !== null ? confTotal : (Number(l.total_amount) || 0)
        };
      });

      setLeads(safeLeads);
      setPayments(safePayments);

      let gross = 0, collected = 0;
      safeLeads.forEach(lead => {
        gross += lead.total_amount;
        const advance = lead.confirmed_bookings?.[0]?.advance_paid || 0;
        const installments = safePayments.filter(p => p.lead_id === lead.id).reduce((acc, p) => acc + p.amount, 0);
        collected += advance + installments;
      });
      setStats({ gross, collected, pending: gross - collected });

      const salesMap: Record<string, number> = {};
      safeLeads.forEach(lead => {
        const name = lead.assigned_to_profile?.name || 'Unassigned';
        const advance = lead.confirmed_bookings?.[0]?.advance_paid || 0;
        const installments = safePayments.filter(p => p.lead_id === lead.id).reduce((acc, p) => acc + p.amount, 0);
        salesMap[name] = (salesMap[name] || 0) + advance + installments;
      });
      setSalesStats(Object.entries(salesMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      if (selectedLead) {
        const updated = safeLeads.find(l => l.id === selectedLead.id);
        if (updated) setSelectedLead(updated);
      }

      // Fetch Banks
      const { data: bankData } = await supabase.from('banks').select('*').order('created_at', { ascending: false });
      if (bankData) setBanks(bankData);

    } catch (error) {
      console.error('Finance Fetch Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLead]);


  useEffect(() => { fetchData(); }, []);

  const handleRecordPayment = async () => {
    if (!selectedLead || !newAmount) return;
    try {
      const { error } = await supabase.from('payments').insert({
        lead_id: selectedLead.id,
        amount: Number(newAmount),
        method: newMethod,
        reference_no: newRef,
      });
      if (error) throw error;
      Alert.alert('Success', 'Payment recorded successfully');
      setPayModal(false);
      setNewAmount(''); setNewRef('');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUpdateTotal = async () => {
    if (!selectedLead || !newTotal) return;
    try {
      const { error } = await supabase.from('leads').update({ total_amount: Number(newTotal) }).eq('id', selectedLead.id);
      if (error) throw error;
      Alert.alert('Success', 'Total package value updated');
      setEditTotalModal(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleConvertAllToUSD = async () => {
    try {
      setConverting(true);

      // Fetch live rate with RN-compatible timeout
      const fetchWithTimeout = (url: string, ms: number) =>
        Promise.race([
          fetch(url),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
        ]);

      let rate = 0;
      try {
        const r1 = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', 6000) as Response;
        if (r1.ok) { const j = await r1.json(); rate = j?.rates?.INR || 0; }
      } catch {}

      if (!rate) {
        try {
          const r2 = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD', 6000) as Response;
          if (r2.ok) { const j = await r2.json(); rate = j?.rates?.INR || 0; }
        } catch {}
      }

      // Final hardcoded fallback
      if (!rate || rate <= 0) rate = 84.0;

      // Fetch all confirmed bookings
      const { data: bookings, error } = await supabase
        .from('confirmed_bookings')
        .select('id, total_amount, advance_paid, due_amount');

      if (error) throw error;
      if (!bookings || bookings.length === 0) {
        Alert.alert('No Bookings', 'No confirmed bookings found.');
        return;
      }

      // Update each booking
      let updated = 0;
      let firstError = '';
      for (const b of bookings) {
        const totalUSD = parseFloat((b.total_amount / rate).toFixed(2));
        const advUSD   = parseFloat((b.advance_paid / rate).toFixed(2));
        const dueUSD   = parseFloat(((b.total_amount - b.advance_paid) / rate).toFixed(2));
        const { error: upErr } = await supabase
          .from('confirmed_bookings')
          .update({ total_amount_usd: totalUSD, advance_paid_usd: advUSD, due_amount_usd: dueUSD })
          .eq('id', b.id);
        if (upErr) { if (!firstError) firstError = upErr.message; }
        else updated++;
      }

      if (firstError) {
        Alert.alert('⚠️ DB Column Missing', `Update failed: ${firstError}\n\nRun this SQL in Supabase:\nALTER TABLE confirmed_bookings\n  ADD COLUMN IF NOT EXISTS advance_paid_usd NUMERIC(10,2),\n  ADD COLUMN IF NOT EXISTS due_amount_usd NUMERIC(10,2);`);
      } else {
        Alert.alert('✅ Done', `${updated}/${bookings.length} bookings converted\nRate used: ₹${rate.toFixed(2)} = $1`);
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Conversion failed.');
    } finally {
      setConverting(false);
    }
  };


  const handleGenerateBill = async (id: string) => {
    try {
      setGeneratingBill(true);
      await generatePaymentBill(id);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate bill: ' + error.message);
    } finally {
      setGeneratingBill(false);
    }
  };

  const handleAddBank = async () => {
    if (!bankName || !beneficiary) return;
    try {
      const { error } = await supabase.from('banks').insert({
        bank_name: bankName,
        beneficiary_name: beneficiary,
        balance: Number(initialBalance) || 0
      });
      if (error) throw error;
      Alert.alert('Success', 'Bank added successfully');
      setAddBankModal(false);
      setBankName(''); setBeneficiary(''); setInitialBalance('');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleBankTransaction = async () => {
    if (!selectedBank || !txAmount) return;
    try {
      const amount = Number(txAmount);
      const newBalance = txType === 'income' ? selectedBank.balance + amount : selectedBank.balance - amount;

      const { error: txErr } = await supabase.from('bank_transactions').insert({
        bank_id: selectedBank.id,
        type: txType,
        amount: amount,
        description: txDesc
      });
      if (txErr) throw txErr;

      const { error: upErr } = await supabase.from('banks').update({ balance: newBalance }).eq('id', selectedBank.id);
      if (upErr) throw upErr;

      Alert.alert('Success', `Bank ${txType === 'income' ? 'credited' : 'debited'} successfully`);
      setBankTxModal(false);
      setTxAmount(''); setTxDesc('');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderBank = ({ item }: { item: Bank }) => (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={[styles.leadAvatar, { backgroundColor: C.primaryLight }]}>
          <Ionicons name="business" size={20} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingName}>{item.bank_name}</Text>
          <Text style={styles.bookingDest}>{item.beneficiary_name}</Text>
        </View>
        <Text style={[styles.detailValueLarge, { fontSize: 18 }]}>₹{item.balance.toLocaleString()}</Text>
      </View>
      <View style={[styles.btnRow, { marginTop: 12 }]}>
        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: C.green, flexDirection: 'row', gap: 6 }]} 
          onPress={() => { setSelectedBank(item); setTxType('income'); setBankTxModal(true); }}
        >
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <Text style={[styles.saveBtnText, { fontSize: 12 }]}>Add Money</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: '#ef4444', flexDirection: 'row', gap: 6 }]} 
          onPress={() => { setSelectedBank(item); setTxType('expense'); setBankTxModal(true); }}
        >
          <Ionicons name="remove-circle-outline" size={16} color="#fff" />
          <Text style={[styles.saveBtnText, { fontSize: 12 }]}>Add Expense</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBooking = ({ item }: { item: Lead }) => {

    const advance = item.confirmed_bookings?.[0]?.advance_paid || 0;
    const installments = payments.filter(p => p.lead_id === item.id).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const paid = advance + installments;
    const total = item.total_amount;
    const balance = total - paid;
    const progress = total > 0 ? Math.min(paid / total, 1) : 0;
    const fullyPaid = balance <= 0;

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        activeOpacity={0.8}
        onPress={() => { setSelectedLead(item); setDetailModal(true); }}
      >
        <View style={styles.bookingHeader}>
          <View style={[styles.leadAvatar, { backgroundColor: fullyPaid ? C.greenLight : C.primaryLight }]}>
            <Text style={[styles.leadAvatarText, { color: fullyPaid ? C.green : C.primary }]}>
              {item.name[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bookingName}>{item.name}</Text>
            <Text style={styles.bookingDest}>{item.destination} · {item.contact_no}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: fullyPaid ? C.greenLight : C.amberLight }]}>
            <Text style={[styles.badgeText, { color: fullyPaid ? C.green : C.amber }]}>
              {fullyPaid ? '✓ PAID' : `DUE ₹${balance.toLocaleString()}`}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: fullyPaid ? C.green : C.primary }]} />
          </View>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressText}>Collected: ₹{paid.toLocaleString()}</Text>
            <Text style={styles.progressText}>Total: ₹{total.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.bookingFooter}>
          <Text style={styles.salesName}>
            <Ionicons name="person-outline" size={11} color={C.textMuted} /> {item.assigned_to_profile?.name || 'Unknown'}
          </Text>
          <TouchableOpacity style={styles.receiptBtn} onPress={() => handleGenerateBill(item.id)} disabled={generatingBill}>
            <Ionicons name="receipt-outline" size={13} color={C.primary} />
            <Text style={styles.receiptBtnText}>Invoice</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading financial data...</Text>
      </View>
    );
  }

  const selectedLeadAdvance = selectedLead?.confirmed_bookings?.[0]?.advance_paid || 0;
  const selectedLeadInstallments = payments.filter(p => p.lead_id === selectedLead?.id);
  const selectedLeadTotalCollected = selectedLeadAdvance + selectedLeadInstallments.reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      
      {/* Tab Switch */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'bookings' && styles.activeTab]} 
          onPress={() => setActiveTab('bookings')}
        >
          <Text style={[styles.tabText, activeTab === 'bookings' && styles.activeTabText]}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'banks' && styles.activeTab]} 
          onPress={() => setActiveTab('banks')}
        >
          <Text style={[styles.tabText, activeTab === 'banks' && styles.activeTabText]}>Banks</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={(activeTab === 'bookings' ? leads : banks) as any[]}
        keyExtractor={(item: any) => item.id}
        renderItem={(activeTab === 'bookings' ? renderBooking : renderBank) as any}

        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={C.primary} />
        }
        ListHeaderComponent={
          activeTab === 'bookings' ? (
            <>
            {/* Stats */}

            <View style={styles.statsGrid}>
              <StatCard label="Gross Revenue" value={`₹${stats.gross.toLocaleString()}`}     icon="trending-up"     color={C.primary} bg={C.primaryLight} />
              <StatCard label="Collected"     value={`₹${stats.collected.toLocaleString()}`} icon="checkmark-circle" color={C.green}   bg={C.greenLight} />
              <StatCard label="Remaining"     value={`₹${stats.pending.toLocaleString()}`}   icon="alert-circle"    color={C.amber}   bg={C.amberLight} />
            </View>

            {/* Convert to USD button */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: converting ? C.surface2 : '#0a7e4a', paddingVertical: 12, borderRadius: R.md, borderWidth: 1, borderColor: converting ? C.border : '#0a7e4a', marginBottom: 4 }}
              onPress={handleConvertAllToUSD}
              disabled={converting}
            >
              {converting ? (
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <Ionicons name="swap-horizontal" size={18} color="#fff" />
              )}
              <Text style={{ color: converting ? C.textMuted : '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 }}>
                {converting ? 'CONVERTING...' : 'CONVERT ALL TO USD'}
              </Text>
            </TouchableOpacity>

            {/* Collections by team */}
            {salesStats.length > 0 && (
              <View style={styles.teamBox}>
                <Text style={styles.sectionTitle}>Collections by Team</Text>
                {salesStats.map((s, i) => (
                  <View key={i} style={styles.salesStatRow}>
                    <View style={styles.salesInfo}>
                      <View style={[styles.salesBullet, { backgroundColor: [C.primary, C.green, C.amber, C.purple][i % 4] }]} />
                      <Text style={styles.salesNameText}>{s.name}</Text>
                      <Text style={styles.salesValueText}>₹{s.value.toLocaleString()}</Text>
                    </View>
                    <View style={styles.salesProgressBg}>
                      <View style={[styles.salesProgressFill, {
                        width: `${(s.value / (stats.collected || 1)) * 100}%`,
                        backgroundColor: [C.primary, C.green, C.amber, C.purple][i % 4],
                      }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Bookings ({leads.length})</Text>
            </View>
          </>
          ) : (
            <View style={[styles.sectionHeader, { marginBottom: 16 }]}>
              <Text style={styles.sectionTitle}>Bank Accounts ({banks.length})</Text>
              <TouchableOpacity onPress={() => setAddBankModal(true)} style={styles.addBtn}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>New Bank</Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListEmptyComponent={
          activeTab === 'bookings' ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="wallet-outline" size={40} color={C.primary} />
              </View>
              <Text style={styles.emptyTitle}>No confirmed bookings yet</Text>
              <Text style={styles.emptySub}>Leads marked as Confirmed or Allocated will appear here.</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="business-outline" size={40} color={C.primary} />
              </View>
              <Text style={styles.emptyTitle}>No banks added yet</Text>
              <Text style={styles.emptySub}>Add a bank account to manage your finances.</Text>
            </View>
          )
        }
      />


      {/* Booking Detail Modal */}
      <Modal visible={detailModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{selectedLead?.name}</Text>
              <Text style={styles.modalSub}>{selectedLead?.destination} · {selectedLead?.contact_no}</Text>
            </View>
            <TouchableOpacity onPress={() => setDetailModal(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={C.textSecond} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent}>
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Package Value</Text>
                <TouchableOpacity onPress={() => { setNewTotal(String(selectedLead?.total_amount || '')); setEditTotalModal(true); }}>
                  <Text style={styles.detailValueLarge}>₹{(selectedLead?.total_amount || 0).toLocaleString()} <Ionicons name="create-outline" size={14} color={C.primary} /></Text>
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Collected</Text>
                <Text style={[styles.detailValueLarge, { color: C.green }]}>₹{selectedLeadTotalCollected.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payment History</Text>
              <TouchableOpacity onPress={() => setPayModal(true)} style={styles.addBtn}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Record Payment</Text>
              </TouchableOpacity>
            </View>

            {selectedLeadAdvance > 0 && (
              <View style={[styles.paymentItem, { borderLeftColor: C.green, borderLeftWidth: 3 }]}>
                <View style={[styles.pIconBox, { backgroundColor: C.greenLight }]}>
                  <Ionicons name="star" size={18} color={C.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pAmount, { color: C.green }]}>₹{selectedLeadAdvance.toLocaleString()}</Text>
                  <Text style={styles.pMeta}>Initial Advance Paid</Text>
                </View>
                <Text style={styles.pDate}>Confirmed</Text>
              </View>
            )}

            {selectedLeadInstallments.length === 0 && selectedLeadAdvance === 0 ? (
              <Text style={styles.empty}>No payments recorded yet.</Text>
            ) : (
              selectedLeadInstallments.map(p => (
                <View key={p.id} style={styles.paymentItem}>
                  <View style={[styles.pIconBox, { backgroundColor: C.primaryLight }]}>
                    <Ionicons name="receipt-outline" size={18} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pAmount}>₹{p.amount.toLocaleString()}</Text>
                    <Text style={styles.pMeta}>{p.method.toUpperCase()} · {p.reference_no || 'No Ref'}</Text>
                  </View>
                  <Text style={styles.pDate}>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                </View>
              ))
            )}

            <TouchableOpacity
              style={[styles.bigBillBtn, generatingBill && { opacity: 0.6 }]}
              onPress={() => handleGenerateBill(selectedLead?.id || '')}
              disabled={generatingBill}
            >
              {generatingBill ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="document-text" size={18} color="#fff" />
                  <Text style={styles.bigBillBtnText}>Generate Invoice PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Payment Modal */}
      <Modal visible={payModal} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Record Payment</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput style={styles.input} placeholder="e.g. 50000" placeholderTextColor={C.textMuted} keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Transaction ID / Ref</Text>
              <TextInput style={styles.input} placeholder="Reference No." placeholderTextColor={C.textMuted} value={newRef} onChangeText={setNewRef} />
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setPayModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleRecordPayment}>
                <Text style={styles.saveBtnText}>Record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Total Modal */}
      <Modal visible={editTotalModal} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Set Package Value</Text>
            <Text style={styles.dialogSub}>Update the total deal amount for this lead.</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Total Amount (₹)</Text>
              <TextInput style={styles.input} placeholder="Total Price" placeholderTextColor={C.textMuted} keyboardType="numeric" value={newTotal} onChangeText={setNewTotal} />
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setEditTotalModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleUpdateTotal}>
                <Text style={styles.saveBtnText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Add Bank Modal */}
      <Modal visible={addBankModal} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Add New Bank Account</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bank Name</Text>
              <TextInput style={styles.input} placeholder="e.g. HDFC Bank" placeholderTextColor={C.textMuted} value={bankName} onChangeText={setBankName} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Beneficiary Name</Text>
              <TextInput style={styles.input} placeholder="e.g. Nomadller Pvt Ltd" placeholderTextColor={C.textMuted} value={beneficiary} onChangeText={setBeneficiary} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Initial Balance (₹)</Text>
              <TextInput style={styles.input} placeholder="0" placeholderTextColor={C.textMuted} keyboardType="numeric" value={initialBalance} onChangeText={setInitialBalance} />
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setAddBankModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleAddBank}>
                <Text style={styles.saveBtnText}>Add Bank</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bank Transaction Modal (Money In / Out) */}
      <Modal visible={bankTxModal} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{txType === 'income' ? 'Add Money' : 'Add Expense'}</Text>
            <Text style={styles.dialogSub}>{selectedBank?.bank_name}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput style={styles.input} placeholder="0" placeholderTextColor={C.textMuted} keyboardType="numeric" value={txAmount} onChangeText={setTxAmount} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} placeholder="e.g. Flight booking payment" placeholderTextColor={C.textMuted} value={txDesc} onChangeText={setTxDesc} />
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setBankTxModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: txType === 'income' ? C.green : (C.red || '#ef4444') }]} 
                onPress={handleBankTransaction}
              >
                <Text style={styles.saveBtnText}>{txType === 'income' ? 'Record Income' : 'Record Expense'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  tabContainer: { flexDirection: 'row', backgroundColor: C.surface, padding: 4, margin: S.xl, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: R.md },
  activeTab: { backgroundColor: C.surface2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  activeTabText: { color: C.primary },



  loadingContainer: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  listContent: { padding: S.xl, paddingBottom: 40, gap: S.md },

  statsGrid: { flexDirection: 'row', gap: S.sm, marginBottom: S.sm },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, gap: S.xs,
    borderTopWidth: 3, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  iconBox: { width: 36, height: 36, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center' },
  statValue: { color: C.textPrimary, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  statLabel: { color: C.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  teamBox: {
    backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, gap: S.md,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: C.textSecond, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  salesStatRow: { gap: S.xs },
  salesInfo: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  salesBullet: { width: 8, height: 8, borderRadius: 4 },
  salesNameText: { flex: 1, color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  salesValueText: { color: C.textSecond, fontSize: 13, fontWeight: '800' },
  salesProgressBg: { height: 4, backgroundColor: C.bg, borderRadius: 2, overflow: 'hidden' },
  salesProgressFill: { height: '100%', borderRadius: 2 },

  bookingCard: {
    backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, gap: S.md,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  leadAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  leadAvatarText: { fontSize: 18, fontWeight: '900' },
  bookingName: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  bookingDest: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.xs },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  progressContainer: { gap: S.xs },
  progressBar: { height: 6, backgroundColor: C.bg, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  bookingFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.border },
  salesName: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryLight, paddingHorizontal: S.sm, paddingVertical: 5, borderRadius: R.xs },
  receiptBtnText: { color: C.primary, fontSize: 11, fontWeight: '700' },

  emptyContainer: { alignItems: 'center', paddingVertical: 80, gap: S.md },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800' },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 260 },

  // Modal
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: S.xl, borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  modalSub: { color: C.textMuted, fontSize: 13, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  formContent: { padding: S.xl, gap: S.md, paddingBottom: 40 },
  detailCard: { backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, borderWidth: 1, borderColor: C.border, gap: S.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  detailValueLarge: { color: C.textPrimary, fontSize: 22, fontWeight: '900' },
  divider: { height: 1, backgroundColor: C.border },
  addBtn: { backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.sm, paddingVertical: 7, borderRadius: R.xs, gap: 4 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 24, fontStyle: 'italic' },
  paymentItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, padding: S.md, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border, gap: S.sm,
  },
  pIconBox: { width: 38, height: 38, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center' },
  pAmount: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  pMeta: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  pDate: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  bigBillBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    backgroundColor: C.primary, paddingVertical: S.lg, borderRadius: R.lg,
    marginTop: S.xl,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  bigBillBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Dialog
  overlay: { flex: 1, backgroundColor: '#00000044', justifyContent: 'center', alignItems: 'center', padding: S.xl },
  dialog: {
    backgroundColor: C.surface, borderRadius: R.xxl, padding: S.xxl, width: '100%', maxWidth: 360,
    gap: S.md, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
  },
  dialogTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800' },
  dialogSub: { color: C.textMuted, fontSize: 13, marginTop: -S.sm },
  inputGroup: { gap: S.xs },
  label: { color: C.textSecond, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: C.surface2, borderRadius: R.sm, padding: S.md,
    color: C.textPrimary, fontSize: 15, borderWidth: 1.5, borderColor: C.border,
  },
  btnRow: { flexDirection: 'row', gap: S.sm, marginTop: S.xs },
  btn: { flex: 1, paddingVertical: S.md, borderRadius: R.sm, alignItems: 'center' },
  cancelBtn: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { color: C.textSecond, fontSize: 14, fontWeight: '700' },
  saveBtn: { backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
