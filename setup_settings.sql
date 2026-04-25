-- Create a settings table to store global configurations like exchange rates
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize with a default USD rate if not already present
INSERT INTO settings (key, value)
VALUES ('usd_rate', '95')
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (assuming anyone can see the rate)
DROP POLICY IF EXISTS "Allow public read access" ON settings;
CREATE POLICY "Allow public read access" ON settings
  FOR SELECT USING (true);

-- Allow admins to update settings
DROP POLICY IF EXISTS "Allow authenticated update" ON settings;
CREATE POLICY "Allow authenticated update" ON settings
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert" ON settings;
CREATE POLICY "Allow authenticated insert" ON settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Main Settlement Fields
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS total_amount_usd NUMERIC DEFAULT 0;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS advance_paid NUMERIC DEFAULT 0;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS due_amount NUMERIC DEFAULT 0;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS due_amount_usd NUMERIC DEFAULT 0;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{}';

-- Guest Details
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS guest_pax INTEGER;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS guest_contact TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS guest_list TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS travel_start_date DATE;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS travel_end_date DATE;

-- ID & Documents
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS id_card_type TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS id_card_no TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS id_card_name TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS passport_no TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS passport_name TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS pan_no TEXT;

-- Flight Details (Arrival)
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_pnr TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_flight_no TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_dep_place TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_dep_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_dep_time TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_arr_airport TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_arr_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_arr_time TEXT;

-- Flight Details (Departure)
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_pnr TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_flight_no TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_dep_place TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_dep_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_dep_time TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_arr_airport TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_arr_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_arr_time TEXT;

-- Train Details (Arrival)
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_pnr TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_no TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_name TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_dep_place TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_dep_time TEXT;

-- Train Details (Departure)
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_pnr TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_no TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_name TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_arr_station TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_arr_time TEXT;

-- Add checklist field to destinations for modular operations steps
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS checklist TEXT;

-- Add ops_assigned_to to leads for operations management
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ops_assigned_to UUID;

-- ═══════════════════════════════════════════════════════════════════
-- FIX 406 ERROR: Add RLS policies for confirmed_bookings
-- This is the most common cause of 406 Not Acceptable in Supabase
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE confirmed_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read confirmed_bookings" ON confirmed_bookings;
DROP POLICY IF EXISTS "Allow insert confirmed_bookings" ON confirmed_bookings;
DROP POLICY IF EXISTS "Allow update confirmed_bookings" ON confirmed_bookings;
DROP POLICY IF EXISTS "Allow delete confirmed_bookings" ON confirmed_bookings;
DROP POLICY IF EXISTS "Allow all confirmed_bookings" ON confirmed_bookings;

-- Allow full access for authenticated users (internal admin app)
CREATE POLICY "Allow all confirmed_bookings" ON confirmed_bookings
  FOR ALL USING (true) WITH CHECK (true);

-- Also ensure leads table has proper access
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all leads" ON leads;
CREATE POLICY "Allow all leads" ON leads
  FOR ALL USING (true) WITH CHECK (true);

-- Ensure destinations table has proper access
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all destinations" ON destinations;
CREATE POLICY "Allow all destinations" ON destinations
  FOR ALL USING (true) WITH CHECK (true);

-- Ensure itineraries table has proper access
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all itineraries" ON itineraries;
CREATE POLICY "Allow all itineraries" ON itineraries
  FOR ALL USING (true) WITH CHECK (true);

-- Ensure profiles table has proper access
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all profiles" ON profiles;
CREATE POLICY "Allow all profiles" ON profiles
  FOR ALL USING (true) WITH CHECK (true);


-- Train Date Fixes
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_dep_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_dep_date TEXT;

-- Full Train Details Parity
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_arr_station TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_arr_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_train_arr_time TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_dep_place TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_dep_time TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_train_arr_date TEXT;

-- Bus Details (Arrival)
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_bus_name TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_bus_dep_station TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_bus_dep_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_bus_dep_time TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_bus_arr_station TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_bus_arr_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_bus_arr_time TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS arr_bus_operator_contact TEXT;

-- Bus Details (Departure)
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_bus_name TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_bus_dep_station TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_bus_dep_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_bus_dep_time TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_bus_arr_station TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_bus_arr_date TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_bus_arr_time TEXT;
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS dep_bus_operator_contact TEXT;

-- ============================================================
-- USD Financial Fields (required for Convert All to USD)
-- ============================================================
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS total_amount_usd NUMERIC(10,2);
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS advance_paid_usd NUMERIC(10,2);
ALTER TABLE confirmed_bookings ADD COLUMN IF NOT EXISTS due_amount_usd   NUMERIC(10,2);

-- ============================================================
-- BANK MANAGEMENT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  beneficiary_name TEXT NOT NULL,
  balance NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES banks(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('income', 'expense')),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for bank tables
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all banks" ON banks;
CREATE POLICY "Allow all banks" ON banks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all bank_transactions" ON bank_transactions;
CREATE POLICY "Allow all bank_transactions" ON bank_transactions FOR ALL USING (true) WITH CHECK (true);



-- ============================================================
-- ⚠️  FULL RESET — Keeps admin login only
--     Deletes: leads, bookings, payments, profiles,
--              itineraries, destinations
--     Run in Supabase SQL Editor to wipe all data.
-- ============================================================

-- 1. Delete all operational data (order matters — child tables first)
DELETE FROM call_logs;
DELETE FROM payments;
DELETE FROM confirmed_bookings;
DELETE FROM leads;

-- 2. Delete non-admin profiles
DELETE FROM profiles
WHERE role IN ('sale', 'operations', 'finance');

-- NOTE: Supabase Auth users still exist. 
-- You must manually delete them from Supabase Dashboard -> Auth -> Users
-- to reuse the same emails.


-- 3. Delete itineraries and destinations
DELETE FROM itineraries;
DELETE FROM destinations;



