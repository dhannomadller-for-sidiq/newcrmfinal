import { supabase } from './utils/supabase';

async function checkSchema() {
  const { data, error } = await supabase
    .from('confirmed_bookings')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  } else {
    // If table is empty, we can't see columns this way easily via PostgREST without data
    console.log('Table is empty, cannot determine columns via data keys.');
  }
}

checkSchema();
