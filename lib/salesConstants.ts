// ── Types ──────────────────────────────────────────────────────────────────
export type Lead = {
  id: string; name: string; contact_no: string; destination: string;
  status: string; assigned_to: string | null; added_by: string | null;
  email: string | null; travel_date: string | null; budget: number | null;
  next_followup_at: string | null; call_remarks: string | null;
  itinerary_id: string | null; itinerary_option: string | null;
  followup_status: string | null;
  itinerary_history: Array<{ id: string; title: string; option?: string | null; option_label?: string | null }>;
  returned_to_admin: boolean;
  ops_itinerary_edited?: boolean;
  ops_assigned_to?: string | null;
  created_at?: string;
  pax_count?: string | null;
};


export type Destination = { id: string; name: string };

export type Itinerary = { 
  id: string; 
  title: string; 
  destination_id: string; 
  pricing_data: Record<string, unknown>; 
  description?: string;
  important_notes?: string
};

// ── Constants ───────────────────────────────────────────────────────────────
export const OPTION_META: Record<string, { label: string; icon: string; color: string }> = {
  car:  { label: 'Self-Drive Car',  icon: 'car',     color: '#4C6EF5' },
  bike: { label: 'Self-Drive Bike', icon: 'bicycle', color: '#F59E0B' },
  cab:  { label: 'Cab Service',     icon: 'bus',     color: '#22C55E' },
};

export const STATUS_COLORS: Record<string, string> = {
  New:       '#4C6EF5',
  Contacted: '#F59E0B',
  Converted: '#22C55E',
  Lost:      '#EF4444',
  Allocated: '#A78BFA',
};

export const FOLLOWUP_STATUSES = [
  { key: 'itinerary_sent',       label: '1. Itinerary Sent',              icon: 'send-outline',              color: '#4C6EF5' },
  { key: 'itinerary_updated',    label: '2. Itinerary Updated',           icon: 'refresh-outline',           color: '#F59E0B' },
  { key: 'followup',             label: '3. Follow-up',                   icon: 'chatbubble-outline',        color: '#22C55E' },
  { key: 'different_location',   label: '4. Asking Different Location',   icon: 'location-outline',          color: '#A78BFA' },
  { key: 'advance_paid',         label: '5. Advance Paid & Confirmed',    icon: 'checkmark-circle-outline',  color: '#22C55E' },
  { key: 'dead',                 label: '6. Dead Lead',                   icon: 'skull-outline',             color: '#EF4444' },
];

export const FUP_COLORS: Record<string, string> = FOLLOWUP_STATUSES.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.color }), {});
export const FUP_LABELS: Record<string, string> = FOLLOWUP_STATUSES.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.label.split('. ')[1] || curr.label }), {});

export const TRIP_PLACE_SUGGESTIONS = [
  'Cochin International Airport - Kochi',
  'Trivandrum International Airport - Thiruvananthapuram',
  'Chennai International Airport - Chennai',
  'Calicut International Airport - Kozhikode',
  'Ngurah Rai International Airport - Denpasar',
  'Kuala Lumpur International Airport - Kuala Lumpur',
  'Singapore Changi Airport - Singapore',
  'Suvarnabhumi Airport - Bangkok',
  'Phuket International Airport - Phuket',
  'Krabi International Airport - Krabi'
];

export const CHECKLIST_ITEMS = [
  { key: 'passport', label: 'Passport Copy' },
  { key: 'id_card',  label: 'ID Card (Aadhar/Voter)' },
  { key: 'flights',  label: 'Flight Tickets' },
  { key: 'visa',     label: 'Visa Documents' },
  { key: 'hotel',    label: 'Hotel Vouchers' },
  { key: 'transport',label: 'Transport Vouchers' },
  { key: 'activity', label: 'Activity Vouchers' },
  { key: 'insurance',label: 'Travel Insurance' },
];
