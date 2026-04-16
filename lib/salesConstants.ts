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
};

export type Destination = { id: string; name: string };

export type Itinerary = { 
  id: string; 
  title: string; 
  destination_id: string; 
  pricing_data: Record<string, unknown>; 
  description?: string 
};

// ── Constants ───────────────────────────────────────────────────────────────
export const OPTION_META: Record<string, { label: string; icon: string; color: string }> = {
  car:  { label: 'Self-Drive Car',  icon: 'car',     color: '#6366f1' },
  bike: { label: 'Self-Drive Bike', icon: 'bicycle', color: '#f59e0b' },
  cab:  { label: 'Cab Service',     icon: 'bus',     color: '#10b981' },
};

export const STATUS_COLORS: Record<string, string> = {
  New: '#6366f1', 
  Contacted: '#f59e0b', 
  Converted: '#10b981', 
  Lost: '#ef4444',
  Allocated: '#8b5cf6',
};

export const FOLLOWUP_STATUSES = [
  { key: 'itinerary_sent',       label: '1. Itinerary Sent',              icon: 'send-outline',              color: '#6366f1' },
  { key: 'itinerary_updated',    label: '2. Itinerary Updated',           icon: 'refresh-outline',           color: '#f59e0b' },
  { key: 'followup',             label: '3. Follow-up',                   icon: 'chatbubble-outline',        color: '#10b981' },
  { key: 'different_location',   label: '4. Asking Different Location',   icon: 'location-outline',          color: '#8b5cf6' },
  { key: 'advance_paid',         label: '5. Advance Paid & Confirmed',    icon: 'checkmark-circle-outline',  color: '#10b981' },
  { key: 'dead',                 label: '6. Dead Lead',                   icon: 'skull-outline',             color: '#ef4444' },
];

export const FUP_COLORS: Record<string, string> = FOLLOWUP_STATUSES.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.color }), {});
export const FUP_LABELS: Record<string, string> = FOLLOWUP_STATUSES.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.label.split('. ')[1] || curr.label }), {});
