import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { C, R, S } from '@/lib/theme';
import { STATUS_COLORS } from '@/lib/salesConstants';
import { getLiveUsdRate } from '@/utils/liveRate';

// ── Period filter ─────────────────────────────────────────────────────────────
type Period = 'today' | 'week' | 'month' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'all',   label: 'All'   },
];

function getPeriodStart(p: Period): string | null {
  const now = new Date();
  if (p === 'today') { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return d.toISOString(); }
  if (p === 'week')  { const d = new Date(now); d.setDate(now.getDate() - 6); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  if (p === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); }
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SalesPerson = { id: string; name: string; total: number; converted: number; rate: number };
type StatusCount = { status: string; count: number; color: string };

// ── Sub-components ────────────────────────────────────────────────────────────
function ActionBtn({ icon, label, color, bg, onPress }: { icon: string; label: string; color: string; bg: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={ab.wrap}>
      <View style={[ab.circle, { backgroundColor: bg, borderColor: color + '30', borderWidth: 1 }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={ab.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  wrap:   { alignItems: 'center', gap: 6, flex: 1 },
  circle: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  label:  { color: C.textMuted, fontSize: 11, fontWeight: '600' },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  const [period, setPeriod] = useState<Period>('all');
  const [loading, setLoading] = useState(false);

  // Hero stats
  const [leadCount, setLeadCount] = useState('—');
  const [convRate,  setConvRate]  = useState('—');
  const [newCount,  setNewCount]  = useState('—');
  const [convCount, setConvCount] = useState('—');

  // Today's follow-ups
  const [followupsToday, setFollowupsToday] = useState('—');

  // Status breakdown
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);

  // Team performance
  const [teamPerf, setTeamPerf] = useState<SalesPerson[]>([]);

  // Meta stats
  const [meta, setMeta] = useState({ team: '—', destinations: '—', itineraries: '—' });

  // USD Rate
  const [usdRate, setUsdRate] = useState<string>('95');
  const [savingRate, setSavingRate] = useState(false);

  const fetchAll = useCallback(async (p: Period) => {
    setLoading(true);
    const from = getPeriodStart(p);

    try {
      // ── 1. Leads with status for period ──────────────────────────────────
      let leadsQ = supabase.from('leads').select('status, added_by, next_followup_at');
      if (from) leadsQ = leadsQ.gte('created_at', from);
      const { data: leadsData } = await leadsQ;

      const leads      = leadsData ?? [];
      const total      = leads.length;
      // Count both Converted AND Allocated as "won" — Allocated means confirmed + sent to Ops
      const wonStatuses = ['Converted', 'Allocated'];
      const converted  = leads.filter(l => wonStatuses.includes(l.status)).length;
      const newLeads   = leads.filter(l => l.status === 'New').length;
      const rate       = total > 0 ? `${Math.round((converted / total) * 100)}%` : '0%';

      setLeadCount(total.toString());
      setConvCount(converted.toString());
      setNewCount(newLeads.toString());
      setConvRate(rate);

      // ── 2. Status breakdown ────────────────────────────────────────────────
      const statusOrder = ['New', 'Contacted', 'Converted', 'Lost', 'Allocated'];
      const statusMap: Record<string, number> = {};
      leads.forEach(l => { statusMap[l.status] = (statusMap[l.status] ?? 0) + 1; });
      const counts: StatusCount[] = statusOrder
        .filter(s => (statusMap[s] ?? 0) > 0)
        .map(s => ({ status: s, count: statusMap[s] ?? 0, color: STATUS_COLORS[s] ?? C.primary }));
      setStatusCounts(counts);

      // ── 3. Today's follow-ups (always global, not period-filtered) ────────
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { count: fupCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('next_followup_at', todayStart.toISOString())
        .lte('next_followup_at', todayEnd.toISOString());
      setFollowupsToday((fupCount ?? 0).toString());

      // ── 4. Team performance ────────────────────────────────────────────────
      const { data: salesProfiles } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'sale')
        .eq('status', 'active')
        .order('name');


      const perfMap: Record<string, SalesPerson> = {};
      (salesProfiles ?? []).forEach(sp => {
        perfMap[sp.id] = { id: sp.id, name: sp.name, total: 0, converted: 0, rate: 0 };
      });
      const wonStatuses2 = ['Converted', 'Allocated'];
      leads.forEach(l => {
        if (perfMap[l.added_by]) {
          perfMap[l.added_by].total++;
          if (wonStatuses2.includes(l.status)) perfMap[l.added_by].converted++;
        }
      });
      const team = Object.values(perfMap).map(sp => ({
        ...sp,
        rate: sp.total > 0 ? Math.round((sp.converted / sp.total) * 100) : 0,
      })).sort((a, b) => b.converted - a.converted);
      setTeamPerf(team);

      // ── 5. Meta (team size, dests, itins) — non-period ───────────────────
      const [teamCount, destCount, itinCount] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['sale', 'operations', 'finance']),
        supabase.from('destinations').select('*', { count: 'exact', head: true }),
        supabase.from('itineraries').select('*', { count: 'exact', head: true }),
      ]);
      setMeta({
        team:         teamCount.count?.toString()  ?? '0',
        destinations: destCount.count?.toString()  ?? '0',
        itineraries:  itinCount.count?.toString()  ?? '0',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsdRate = async () => {
    const rate = await getLiveUsdRate();
    setUsdRate(rate.toString());
  };

  useFocusEffect(useCallback(() => {
    fetchAll(period);
    fetchUsdRate();
  }, [period]));

  const saveUsdRate = async () => {
    setSavingRate(true);
    const { error } = await supabase.from('settings').upsert({ key: 'usd_rate', value: usdRate });
    setSavingRate(false);
    if (error) {
      if (error.code === '42P01') {
        Alert.alert('Database Setup Required', 'The "settings" table is missing. Please create it in Supabase to save global settings.');
      } else {
        Alert.alert('Error', error.message);
      }
    } else {
      Alert.alert('Success', 'USD Exchange Rate updated.');
    }
  };

  const handlePeriod = (p: Period) => { setPeriod(p); fetchAll(p); };

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? 'All';
  const totalForBar = statusCounts.reduce((s, c) => s + c.count, 0);

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor={C.surface} />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <View style={st.topBar}>
        <View style={st.brandRow}>
          <View style={st.brandDot} />
          <Text style={st.brandName}>Nomadller</Text>
        </View>
        <View style={st.topRight}>
          <TouchableOpacity style={st.iconBtn}>
            <Ionicons name="notifications-outline" size={18} color={C.textSecond} />
          </TouchableOpacity>
          <View style={st.avatar}>
            <Text style={st.avatarTxt}>{(profile?.name ?? 'A')[0].toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* ── Page title ───────────────────────────────────────────────────── */}
      <View style={st.pageTitleRow}>
        <View>
          <Text style={st.pageTitle}>Sales Dashboard</Text>
          <Text style={st.pageSub}>{greeting}, {profile?.name?.split(' ')[0] ?? 'Admin'}</Text>
        </View>
        <TouchableOpacity style={st.addBtn} onPress={() => router.push('/(admin)/leads' as any)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={st.addBtnTxt}>Add Lead</Text>
        </TouchableOpacity>
      </View>

      {/* ── Period filter ─────────────────────────────────────────────────── */}
      <View style={st.filterRow}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p.key} onPress={() => handlePeriod(p.key)}
            style={[st.filterPill, period === p.key && st.filterPillActive]} activeOpacity={0.75}>
            <Text style={[st.filterPillTxt, period === p.key && st.filterPillTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <View style={st.hero}>
        <View style={st.heroTop}>
          <View>
            <Text style={st.heroContext}>Leads · {periodLabel}</Text>
            <View style={{ minHeight: 68 }}>
              {loading
                ? <ActivityIndicator color="#fff" size="large" style={{ marginTop: 4 }} />
                : <Text style={st.heroNum}>{leadCount}</Text>
              }
            </View>
          </View>
          <View style={st.heroBadge}>
            <Text style={st.heroBadgeSub}>Conv. Rate</Text>
            <Text style={st.heroBadgeVal}>{convRate}</Text>
          </View>
        </View>

        {/* New / Converted / Period sub-row */}
        <View style={st.heroSubRow}>
          <View style={st.heroSubItem}>
            <View style={[st.heroSubDot, { backgroundColor: C.blue }]} />
            <Text style={st.heroSubLabel}>New</Text>
            <Text style={st.heroSubVal}>{newCount}</Text>
          </View>
          <View style={st.heroSubDivider} />
          <View style={st.heroSubItem}>
            <View style={[st.heroSubDot, { backgroundColor: C.green }]} />
            <Text style={st.heroSubLabel}>Converted</Text>
            <Text style={st.heroSubVal}>{convCount}</Text>
          </View>
          <View style={st.heroSubDivider} />
          <View style={st.heroSubItem}>
            <View style={[st.heroSubDot, { backgroundColor: C.amber }]} />
            <Text style={st.heroSubLabel}>Filter</Text>
            <Text style={st.heroSubVal}>{periodLabel}</Text>
          </View>
        </View>
        <View style={st.heroAccent} />
      </View>

      {/* ── [1.2] TODAY'S FOLLOW-UPS BANNER ──────────────────────────────── */}
      <TouchableOpacity
        style={st.fupBanner}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/(admin)/leads', params: { filter: 'today' } } as any)}
      >
        <View style={st.fupLeft}>
          <View style={st.fupIconWrap}>
            <Ionicons name="alarm" size={18} color={C.amber} />
          </View>
          <View>
            <Text style={st.fupTitle}>Today's Follow-ups</Text>
            <Text style={st.fupSub}>Across all salespeople</Text>
          </View>
        </View>
        <View style={st.fupRight}>
          <Text style={st.fupCount}>{followupsToday}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
        </View>
      </TouchableOpacity>

      {/* ── [1.3] STATUS BREAKDOWN BAR ───────────────────────────────────── */}
      {statusCounts.length > 0 && (
        <View style={st.breakdownCard}>
          <Text style={st.breakdownTitle}>Lead Status Breakdown</Text>

          {/* Segmented bar */}
          <View style={st.bar}>
            {statusCounts.map((sc, i) => (
              <View
                key={sc.status}
                style={[
                  st.barSeg,
                  {
                    flex: sc.count,
                    backgroundColor: sc.color,
                    borderTopLeftRadius: i === 0 ? 6 : 0,
                    borderBottomLeftRadius: i === 0 ? 6 : 0,
                    borderTopRightRadius: i === statusCounts.length - 1 ? 6 : 0,
                    borderBottomRightRadius: i === statusCounts.length - 1 ? 6 : 0,
                  },
                ]}
              />
            ))}
          </View>

          {/* Legend */}
          <View style={st.legend}>
            {statusCounts.map(sc => (
              <View key={sc.status} style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: sc.color }]} />
                <Text style={st.legendLabel}>{sc.status}</Text>
                <Text style={[st.legendCount, { color: sc.color }]}>{sc.count}</Text>
                <Text style={st.legendPct}>
                  {totalForBar > 0 ? `${Math.round((sc.count / totalForBar) * 100)}%` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <View style={st.actionsCard}>
        <ActionBtn icon="add-circle-outline"  label="Add Lead"  color={C.primary}    bg={C.primaryLight} onPress={() => router.push('/(admin)/leads' as any)} />
        <ActionBtn icon="people-outline"      label="Team"      color={C.textSecond} bg={C.surface2}     onPress={() => router.push('/(admin)/salespersons' as any)} />
        <ActionBtn icon="trophy-outline"      label="Targets"   color={C.amber}      bg={C.amberLight}   onPress={() => router.push('/(admin)/targets' as any)} />
        <ActionBtn icon="map-outline"         label="Places"    color={C.teal}       bg={C.tealLight}    onPress={() => router.push('/(admin)/destinations' as any)} />
      </View>

      {/* ── [1.1] TEAM PERFORMANCE CARDS ─────────────────────────────────── */}
      <View>
        <View style={st.sectionRow}>
          <Text style={st.sectionTitle}>Team Performance</Text>
          <Text style={st.sectionSub}>{periodLabel}</Text>
        </View>

        {teamPerf.length === 0 ? (
          <View style={st.emptyTeam}>
            <Text style={st.emptyTeamTxt}>No salespeople added yet</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -S.lg }}>
            <View style={{ flexDirection: 'row', gap: S.sm, paddingHorizontal: S.lg }}>
              {teamPerf.map((sp, idx) => {
                const rankColor = idx === 0 ? C.amber : idx === 1 ? C.textSecond : C.textMuted;
                return (
                  <View key={sp.id} style={st.perfCard}>
                    {/* Rank badge */}
                    <View style={[st.rankBadge, { borderColor: rankColor + '40' }]}>
                      <Text style={[st.rankNum, { color: rankColor }]}>#{idx + 1}</Text>
                    </View>

                    {/* Avatar */}
                    <View style={[st.perfAvatar, { backgroundColor: C.primaryLight }]}>
                      <Text style={st.perfAvatarTxt}>{sp.name[0]?.toUpperCase()}</Text>
                    </View>

                    <Text style={st.perfName} numberOfLines={1}>{sp.name}</Text>

                    {/* Stats row */}
                    <View style={st.perfStats}>
                      <View style={st.perfStat}>
                        <Text style={st.perfStatVal}>{sp.total}</Text>
                        <Text style={st.perfStatLabel}>Leads</Text>
                      </View>
                      <View style={st.perfStatDivider} />
                      <View style={st.perfStat}>
                        <Text style={[st.perfStatVal, { color: C.green }]}>{sp.converted}</Text>
                        <Text style={st.perfStatLabel}>Won</Text>
                      </View>
                    </View>

                    {/* Conversion rate bar */}
                    <View style={st.perfBarTrack}>
                      <View style={[st.perfBarFill, { width: `${sp.rate}%`, backgroundColor: sp.rate >= 50 ? C.green : sp.rate >= 25 ? C.amber : C.primary }]} />
                    </View>
                    <Text style={st.perfRateTxt}>{sp.rate}% conv. rate</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      <View style={st.sectionRow}>
        <Text style={st.sectionTitle}>Overview</Text>
      </View>
      <View style={st.overviewGrid}>
        {[
          { label: 'Itineraries', value: meta.itineraries, color: C.amber,  bg: C.amberLight,  icon: 'document-text-outline', route: '/(admin)/itineraries' },
          { label: 'Team',        value: meta.team,        color: C.green,  bg: C.greenLight,  icon: 'people-outline',        route: '/(admin)/salespersons' },
          { label: 'Destinations',value: meta.destinations,color: C.purple, bg: C.purpleLight, icon: 'map-outline',           route: '/(admin)/destinations' },
        ].map(item => (
          <TouchableOpacity key={item.label} activeOpacity={0.75} onPress={() => router.push(item.route as any)}
            style={[st.overviewTile, { backgroundColor: item.bg }]}>
            <View style={[st.overviewIcon, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon as any} size={16} color={item.color} />
            </View>
            <Text style={[st.overviewVal, { color: item.color }]}>{item.value}</Text>
            <Text style={st.overviewLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── USD Rate Settings ─────────────────────────────────────────────── */}
      <View style={st.card}>
        <View style={st.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[st.iconCircle, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="cash-outline" size={20} color="#f59e0b" />
            </View>
            <View>
              <Text style={st.cardTitle}>USD Exchange Rate</Text>
              <Text style={st.cardSub}>Base rate for pricing calculations</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 15, alignItems: 'center' }}>
          <View style={{ flex: 1, backgroundColor: C.surface2, borderRadius: R.sm, paddingHorizontal: 12, height: 48, justifyContent: 'center', borderWidth: 1, borderColor: C.border }}>
            <TextInput
              style={{ color: C.textPrimary, fontSize: 16, fontWeight: '700' }}
              value={usdRate}
              onChangeText={setUsdRate}
              keyboardType="numeric"
              placeholder="95"
              placeholderTextColor="#475569"
            />
          </View>
          <TouchableOpacity 
            style={{ backgroundColor: C.primary, height: 48, paddingHorizontal: 20, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center' }}
            onPress={saveUsdRate}
            disabled={savingRate}
          >
            {savingRate ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>UPDATE</Text>}
          </TouchableOpacity>
        </View>
        <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 10 }}>
          * Itineraries will use <Text style={{ color: C.amber, fontWeight: '700' }}>{Number(usdRate) + 2}</Text> (Live Rate + 2) for INR auto-calculation.
        </Text>
      </View>

    </ScrollView>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: 56, gap: S.xl },

  // Top bar
  topBar:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: S.xs },
  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  brandName: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  topRight:  { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  iconBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  avatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primaryLight, borderWidth: 2, borderColor: C.primary + '50', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: C.primary, fontSize: 14, fontWeight: '900' },

  // Page title
  pageTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pageTitle:    { color: C.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  pageSub:      { color: C.textMuted, fontSize: 12, marginTop: 2 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primary, borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 9, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  addBtnTxt:    { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Filter
  filterRow:           { flexDirection: 'row', gap: S.xs, backgroundColor: C.surface, borderRadius: R.full, padding: 4, borderWidth: 1, borderColor: C.border },
  filterPill:          { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: R.full },
  filterPillActive:    { backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  filterPillTxt:       { color: C.textMuted, fontSize: 13, fontWeight: '700' },
  filterPillTxtActive: { color: '#fff', fontWeight: '800' },

  // Hero
  hero:          { backgroundColor: C.primary, borderRadius: R.xxl, padding: S.xl, overflow: 'hidden', shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 10, gap: S.lg },
  heroTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroContext:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  heroNum:       { color: '#fff', fontSize: 64, fontWeight: '900', letterSpacing: -3, lineHeight: 68 },
  heroBadge:     { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: R.lg, padding: S.md, alignItems: 'center', minWidth: 80 },
  heroBadgeSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroBadgeVal:  { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  heroSubRow:    { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: R.lg, padding: S.md },
  heroSubItem:   { flex: 1, alignItems: 'center', gap: 4 },
  heroSubDot:    { width: 6, height: 6, borderRadius: 3 },
  heroSubLabel:  { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600' },
  heroSubVal:    { color: '#fff', fontSize: 16, fontWeight: '800' },
  heroSubDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  heroAccent:    { position: 'absolute', right: -30, top: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.07)' },

  // [1.2] Follow-ups banner
  fupBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg,
    borderWidth: 1, borderColor: C.amberLight,
    borderLeftWidth: 4, borderLeftColor: C.amber,
  },
  fupLeft:    { flexDirection: 'row', alignItems: 'center', gap: S.md },
  fupIconWrap:{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.amberLight, justifyContent: 'center', alignItems: 'center' },
  fupTitle:   { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
  fupSub:     { color: C.textMuted, fontSize: 11, marginTop: 1 },
  fupRight:   { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  fupCount:   { color: C.amber, fontSize: 26, fontWeight: '900', letterSpacing: -1 },

  // [1.3] Status breakdown
  breakdownCard:  { backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, gap: S.md, borderWidth: 1, borderColor: C.border },
  breakdownTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  bar:            { height: 12, flexDirection: 'row', borderRadius: 6, overflow: 'hidden', gap: 2 },
  barSeg:         { height: '100%' },
  legend:         { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: '45%' },
  legendDot:      { width: 8, height: 8, borderRadius: 4 },
  legendLabel:    { color: C.textSecond, fontSize: 11, flex: 1 },
  legendCount:    { fontSize: 12, fontWeight: '800' },
  legendPct:      { color: C.textMuted, fontSize: 10, width: 32, textAlign: 'right' },

  // Quick actions
  actionsCard: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.xxl, padding: S.lg, borderWidth: 1, borderColor: C.border },

  // Section header
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:{ color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionSub:  { color: C.textMuted, fontSize: 12 },

  // [1.1] Team performance cards
  emptyTeam:    { backgroundColor: C.surface, borderRadius: R.xl, padding: S.xxl, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  emptyTeamTxt: { color: C.textMuted, fontSize: 13 },

  perfCard: {
    width: 150, backgroundColor: C.surface, borderRadius: R.xl,
    padding: S.lg, gap: S.sm, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  rankBadge:     { position: 'absolute', top: 10, right: 10, borderWidth: 1, borderRadius: R.xs, paddingHorizontal: 5, paddingVertical: 2 },
  rankNum:       { fontSize: 10, fontWeight: '800' },
  perfAvatar:    { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  perfAvatarTxt: { color: C.primary, fontSize: 20, fontWeight: '900' },
  perfName:      { color: C.textPrimary, fontSize: 13, fontWeight: '800', textAlign: 'center', maxWidth: 120 },
  perfStats:     { flexDirection: 'row', gap: S.sm, width: '100%' },
  perfStat:      { flex: 1, alignItems: 'center', gap: 2 },
  perfStatVal:   { color: C.textPrimary, fontSize: 20, fontWeight: '900' },
  perfStatLabel: { color: C.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  perfStatDivider:{ width: 1, backgroundColor: C.border, marginVertical: 4 },
  perfBarTrack:  { height: 4, backgroundColor: C.border, borderRadius: 2, width: '100%', overflow: 'hidden' },
  perfBarFill:   { height: '100%', borderRadius: 2 },
  perfRateTxt:   { color: C.textMuted, fontSize: 10, fontWeight: '600' },

  // Overview grid
  overviewGrid: { flexDirection: 'row', gap: S.sm },
  overviewTile: { flex: 1, borderRadius: R.xl, padding: S.md, gap: S.xs, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  overviewIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  overviewVal:  { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  overviewLabel:{ color: C.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  card: { backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  cardSub: { color: C.textMuted, fontSize: 12 },
});
