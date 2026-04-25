import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { Lead, Itinerary, OPTION_META } from '@/lib/salesConstants';
import { generatePaymentBill } from '@/utils/billGenerator';

export function BookingDetailModal({ visible, onClose, lead, bookingData, itineraries, destinations, onSuccess, styles }: {
  visible: boolean;
  onClose: () => void;
  lead: Lead | null;
  bookingData: any;
  itineraries: Itinerary[];
  destinations?: any[];
  onSuccess: () => void;
  styles: any;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [opsStaff, setOpsStaff] = React.useState<any[]>([]);
  const [selectedOpsId, setSelectedOpsId] = React.useState<string | null>(null);
  const [generatingBill, setGeneratingBill] = React.useState(false);

  React.useEffect(() => {
    if (visible && (lead?.status === 'Converted' || lead?.status === 'Allocated')) {
      fetchOpsStaff();
    }
  }, [visible, lead]);

  async function fetchOpsStaff() {
    const { data } = await supabase.from('profiles').select('id, name').eq('role', 'operations');
    setOpsStaff(data || []);
    if (lead?.ops_assigned_to) {
      setSelectedOpsId(lead.ops_assigned_to);
    }
  }

  const itin = lead?.itinerary_id ? itineraries.find(i => i.id === lead.itinerary_id) : null;
  const pricingData = (itin && lead?.itinerary_option) ? (itin.pricing_data[lead.itinerary_option] as any) : null;
  const optMeta = lead?.itinerary_option ? OPTION_META[lead.itinerary_option] : null;

  const destObj = destinations?.find(d => d.name === lead?.destination);
  const ids = destObj?.checklist?.split(',').filter(Boolean) || [];
  const hasFlights = ids.includes('flights');
  const hasTrain = ids.includes('train');
  const storedMode = bookingData?.checklist?.transport_mode;
  const displayMode = storedMode || (hasTrain && !hasFlights ? 'train' : 'flights');

  async function handleAllocateLead() {
    if (!lead) return;
    if (!selectedOpsId) {
      Alert.alert('Selection Required', 'Please select an operations staff member to allot this lead.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('leads')
      .update({ 
        status: 'Allocated',
        ops_assigned_to: selectedOpsId
      })
      .eq('id', lead.id);
    
    setSubmitting(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    
    onSuccess();
    onClose();
    Alert.alert('Success', 'Lead allocated to Operations!');
  }

  async function handleGenerateBill() {
    if (!lead) return;
    try {
      setGeneratingBill(true);
      await generatePaymentBill(lead.id);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate bill: ' + error.message);
    } finally {
      setGeneratingBill(false);
    }
  }

  async function acknowledgeOpsEdit() {
    if (!lead) return;
    const { error } = await supabase.from('leads').update({ ops_itinerary_edited: false }).eq('id', lead.id);
    if (!error) onSuccess();
  }

  const FlightLeg = ({ title, icon, color, flightNo, depPlace, depDate, depTime, arrAirport, arrDate, arrTime }: any) => (
    <View style={[styles.bookCard, { borderLeftWidth: 4, borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[styles.bookGridValue, { color }]}>{title}</Text>
        <Text style={{ color: '#64748b', fontSize: 13, marginLeft: 'auto' }}>#{flightNo || 'TBD'}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookGridLabel}>DEPARTURE</Text>
          <Text style={styles.bookGridValue}>{depPlace || '—'}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>{depDate || '--/--'} • {depTime || '--:--'}</Text>
        </View>
        <Ionicons name="airplane" size={16} color="#1e293b" style={{ marginHorizontal: 12 }} />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={[styles.bookGridLabel, { textAlign: 'right' }]}>ARRIVAL</Text>
          <Text style={[styles.bookGridValue, { textAlign: 'right' }]}>{arrAirport || '—'}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right' }}>{arrDate || '--/--'} • {arrTime || '--:--'}</Text>
        </View>
      </View>
    </View>
  );

  const TrainLeg = ({ title, icon, color, trainNo, trainName, depPlace, depDate, depTime, arrStation, arrDate, arrTime }: any) => (
    <View style={[styles.bookCard, { borderLeftWidth: 4, borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[styles.bookGridValue, { color }]}>{title}</Text>
        <Text style={{ color: '#64748b', fontSize: 13, marginLeft: 'auto' }}>#{trainNo || 'TBD'} - {trainName || 'Train'}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookGridLabel}>DEPARTURE</Text>
          <Text style={styles.bookGridValue}>{depPlace || '—'}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>{depDate || '--/--'} • {depTime || '--:--'}</Text>
        </View>
        <Ionicons name="train" size={16} color="#1e293b" style={{ marginHorizontal: 12 }} />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={[styles.bookGridLabel, { textAlign: 'right' }]}>ARRIVAL</Text>
          <Text style={[styles.bookGridValue, { textAlign: 'right' }]}>{arrStation || '—'}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right' }}>{arrDate || '--/--'} • {arrTime || '--:--'}</Text>
        </View>
      </View>
    </View>
  );

  const BusLeg = ({ title, icon, color, busName, busOperatorContact, depStation, depDate, depTime, arrStation, arrDate, arrTime }: any) => (
    <View style={[styles.bookCard, { borderLeftWidth: 4, borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[styles.bookGridValue, { color }]}>{title}</Text>
        <Text style={{ color: '#64748b', fontSize: 13, marginLeft: 'auto' }}>{busName || 'Bus'} {busOperatorContact ? `• ${busOperatorContact}` : ''}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookGridLabel}>DEPARTURE</Text>
          <Text style={styles.bookGridValue}>{depStation || '—'}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>{depDate || '--/--'} • {depTime || '--:--'}</Text>
        </View>
        <Ionicons name="bus" size={16} color="#1e293b" style={{ marginHorizontal: 12 }} />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={[styles.bookGridLabel, { textAlign: 'right' }]}>ARRIVAL</Text>
          <Text style={[styles.bookGridValue, { textAlign: 'right' }]}>{arrStation || '—'}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right' }}>{arrDate || '--/--'} • {arrTime || '--:--'}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Booking Details</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#94a3b8" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.formContent}>
          {lead && (
            <View style={styles.bookSection}>
              <View style={styles.bookHeader}>
                <Text style={styles.bookBadge}>LEAD INFO</Text>
                <Text style={styles.bookMainTitle}>{lead.name}</Text>
                <Text style={styles.bookSubTitle}>{lead.contact_no} • {lead.destination}</Text>
              </View>

              {lead.ops_itinerary_edited && (
                <TouchableOpacity 
                  style={{ backgroundColor: '#ef444415', padding: 15, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#ef4444', marginBottom: 16 }} 
                  onPress={acknowledgeOpsEdit}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="warning" size={20} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '900' }}>ITINERARY MODIFIED BY OPERATIONS</Text>
                      <Text style={{ color: '#ef4444aa', fontSize: 11, fontWeight: '600', marginTop: 2 }}>Tap here to acknowledge this update.</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {bookingData?.checklist && (
                <View style={[styles.bookCard, { borderColor: '#10b98144', backgroundColor: '#10b98108' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.bookGridLabel, { color: '#10b981' }]}>OPERATIONS PROGRESS</Text>
                    <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '900' }}>
                      {Math.round((Object.values(bookingData.checklist).filter(v => !!v).length / 7) * 100)}%
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: '100%', backgroundColor: '#10b981', width: `${((Object.values(bookingData?.checklist || {}).filter((v: any) => !!v).length / 7) * 100)}%` as any }} />
                  </View>
                </View>
              )}

              <View style={styles.bookCard}>
                <Text style={styles.bookCardTitle}>💰 Payment Summary</Text>
                <View style={styles.bookGrid}>
                  <View style={styles.bookGridItem}><Text style={styles.bookGridLabel}>Total ($)</Text><Text style={styles.bookGridValue}>${(bookingData?.total_amount_usd || (bookingData?.total_amount ? bookingData.total_amount / 95 : 0)).toFixed(2)}</Text></View>
                  <View style={styles.bookGridItem}><Text style={styles.bookGridLabel}>Paid ($)</Text><Text style={styles.bookGridValue}>${(bookingData?.advance_paid ? bookingData.advance_paid / 95 : 0).toFixed(2)}</Text></View>
                  <View style={styles.bookGridItem}><Text style={styles.bookGridLabel}>Due ($)</Text><Text style={[styles.bookGridValue, { color: '#ef4444' }]}>${(bookingData?.due_amount_usd || ((bookingData?.total_amount - bookingData?.advance_paid) / 95)).toFixed(2)}</Text></View>
                </View>
              </View>

              <View style={styles.bookCard}>
                <Text style={styles.bookCardTitle}>🛂 Passport Info</Text>
                <View style={styles.bookRow}><Text style={styles.bookLabel}>Passport No:</Text><Text style={styles.bookValue}>{bookingData?.passport_no || '—'}</Text></View>
                <View style={styles.bookRow}><Text style={styles.bookLabel}>Name on Passport:</Text><Text style={styles.bookValue}>{bookingData?.passport_name || '—'}</Text></View>
                <View style={styles.bookRow}><Text style={styles.bookLabel}>PAN Card No:</Text><Text style={styles.bookValue}>{bookingData?.pan_no || '—'}</Text></View>
              </View>

              {((storedMode === 'flights' || (!storedMode && (bookingData?.arr_flight_no || bookingData?.dep_flight_no || bookingData?.arr_pnr || bookingData?.dep_pnr)))) ? (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 10 }]}>✈️ Flight Schedules</Text>
                  <FlightLeg 
                    title="Arrival Journey" 
                    icon="airplane-outline" 
                    color="#10b981"
                    flightNo={bookingData?.arr_flight_no}
                    depPlace={bookingData?.arr_dep_place}
                    depDate={bookingData?.arr_dep_date}
                    depTime={bookingData?.arr_dep_time}
                    arrAirport={bookingData?.arr_arr_airport}
                    arrDate={bookingData?.arr_arr_date}
                    arrTime={bookingData?.arr_arr_time}
                  />
                  <FlightLeg 
                    title="Departure Journey" 
                    icon="airplane-outline" 
                    color="#3e82f6"
                    flightNo={bookingData?.dep_flight_no}
                    depPlace={bookingData?.dep_dep_place}
                    depDate={bookingData?.dep_dep_date}
                    depTime={bookingData?.dep_dep_time}
                    arrAirport={bookingData?.dep_arr_airport}
                    arrDate={bookingData?.dep_arr_date}
                    arrTime={bookingData?.dep_arr_time}
                  />
                </>
              ) : null}

              {((storedMode === 'train' || (!storedMode && (bookingData?.arr_train_no || bookingData?.dep_train_no || bookingData?.arr_train_pnr || bookingData?.dep_train_pnr)))) ? (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 10 }]}>🚆 Train Schedules</Text>
                  <TrainLeg 
                    title="Arrival Journey" 
                    icon="train-outline" 
                    color="#10b981"
                    trainNo={bookingData?.arr_train_no}
                    trainName={bookingData?.arr_train_name}
                    depPlace={bookingData?.arr_train_dep_place}
                    depDate={bookingData?.arr_train_dep_date}
                    depTime={bookingData?.arr_train_dep_time}
                    arrStation={bookingData?.arr_train_arr_station}
                    arrDate={bookingData?.arr_train_arr_date}
                    arrTime={bookingData?.arr_train_arr_time}
                  />
                  <TrainLeg 
                    title="Departure Journey" 
                    icon="train-outline" 
                    color="#3b82f6"
                    trainNo={bookingData?.dep_train_no}
                    trainName={bookingData?.dep_train_name}
                    depPlace={bookingData?.dep_train_dep_place}
                    depDate={bookingData?.dep_train_dep_date}
                    depTime={bookingData?.dep_train_dep_time}
                    arrStation={bookingData?.dep_train_arr_station}
                    arrDate={bookingData?.dep_train_arr_date}
                    arrTime={bookingData?.dep_train_arr_time}
                  />
                </>
              ) : null}

              {((storedMode === 'bus' || (!storedMode && (bookingData?.arr_bus_name || bookingData?.dep_bus_name)))) ? (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 10 }]}>🚌 Bus Schedules</Text>
                  <BusLeg 
                    title="Arrival Journey" 
                    icon="bus-outline" 
                    color="#10b981"
                    busName={bookingData?.arr_bus_name}
                    busOperatorContact={bookingData?.arr_bus_operator_contact}
                    depStation={bookingData?.arr_bus_dep_station}
                    depDate={bookingData?.arr_bus_dep_date}
                    depTime={bookingData?.arr_bus_dep_time}
                    arrStation={bookingData?.arr_bus_arr_station}
                    arrDate={bookingData?.arr_bus_arr_date}
                    arrTime={bookingData?.arr_bus_arr_time}
                  />
                  <BusLeg 
                    title="Departure Journey" 
                    icon="bus-outline" 
                    color="#8b5cf6"
                    busName={bookingData?.dep_bus_name}
                    busOperatorContact={bookingData?.dep_bus_operator_contact}
                    depStation={bookingData?.dep_bus_dep_station}
                    depDate={bookingData?.dep_bus_dep_date}
                    depTime={bookingData?.dep_bus_dep_time}
                    arrStation={bookingData?.dep_bus_arr_station}
                    arrDate={bookingData?.dep_bus_arr_date}
                    arrTime={bookingData?.dep_bus_arr_time}
                  />
                </>
              ) : null}

              {itin && (
                <View style={styles.bookCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={styles.bookCardTitle}>🌍 Itinerary Details</Text>
                    {optMeta && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: optMeta.color + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Ionicons name={optMeta.icon as any} size={14} color={optMeta.color} />
                        <Text style={{ color: optMeta.color, fontSize: 11, fontWeight: '800' }}>{optMeta.label.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.bookGridValue, { fontSize: 18 }]}>{itin.title}</Text>
                  {itin.description && <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 18, marginTop: 4 }}>{itin.description}</Text>}
                  
                  {pricingData && (
                    <View style={{ marginTop: 16, gap: 16 }}>
                      {pricingData.inclusions?.length > 0 && (
                        <View>
                          <Text style={[styles.bookGridLabel, { color: '#10b981', marginBottom: 8 }]}>✅ INCLUSIONS</Text>
                          {pricingData.inclusions.map((item: string, idx: number) => (
                            <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                              <Text style={{ color: '#cbd5e1', fontSize: 13, flex: 1 }}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {pricingData.exclusions?.length > 0 && (
                        <View>
                          <Text style={[styles.bookGridLabel, { color: '#f87171', marginBottom: 8 }]}>❌ EXCLUSIONS</Text>
                          {pricingData.exclusions.map((item: string, idx: number) => (
                            <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                              <Ionicons name="close-circle" size={14} color="#f87171" />
                              <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {(lead.status === 'Converted' || lead.status === 'Allocated') && (
                <View style={{ marginTop: 20, gap: 15 }}>
                  <View style={[styles.bookCard, { backgroundColor: '#1e293b55' }]}>
                    <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>
                      {lead.status === 'Allocated' ? 'Update Operations Assignment' : 'Allot to Operations Staff'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      {opsStaff.map(staff => (
                        <TouchableOpacity 
                          key={staff.id} 
                          style={[
                            { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
                            selectedOpsId === staff.id && { backgroundColor: '#6366f1', borderColor: '#6366f1' }
                          ]}
                          onPress={() => setSelectedOpsId(staff.id)}
                        >
                          <Text style={{ color: selectedOpsId === staff.id ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: '700' }}>
                            {staff.name || 'Staff Member'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {opsStaff.length === 0 && (
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>No operations staff available.</Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#8b5cf6' }]} onPress={handleAllocateLead} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="rocket-outline" size={18} color="#fff" />
                        <Text style={styles.saveBtnText}>
                          {lead.status === 'Allocated' ? 'Update Assignment' : 'Allocate to Operations'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {bookingData && (
                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: '#10b981', marginTop: 24 }]} 
                  onPress={handleGenerateBill} 
                  disabled={generatingBill}
                >
                  {generatingBill ? <ActivityIndicator color="#fff" /> : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="receipt-outline" size={18} color="#fff" />
                      <Text style={styles.saveBtnText}>Download Payment Receipt</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

