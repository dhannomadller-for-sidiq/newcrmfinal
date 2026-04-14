import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tfrnasqulivfzmyfskqy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcm5hc3F1bGl2ZnpteWZza3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTgxNjcsImV4cCI6MjA5MTY3NDE2N30.WiWtNAdpHA9AVihs5npYqupGfEFquw_t6NOexKjtSIY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
