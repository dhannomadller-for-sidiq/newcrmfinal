import { supabase } from './supabase';

const FALLBACK_RATE = 85;
const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

/**
 * Fetches the live USD to INR exchange rate.
 * Uses a cached value from the 'settings' table if available and recently updated.
 */
export async function getLiveUsdRate(): Promise<number> {
  try {
    // 1. Try to get cached rate from DB
    const { data: cached } = await supabase
      .from('settings')
      .select('value, updated_at')
      .eq('key', 'usd_rate')
      .single();

    const now = new Date().getTime();
    const cacheAge = cached ? now - new Date(cached.updated_at).getTime() : Infinity;
    
    // If cache is less than 1 hour old, use it
    if (cached && cacheAge < 3600000) {
      return parseFloat(cached.value);
    }

    // 2. Fetch fresh rate from API
    const response = await fetch(API_URL);
    const data = await response.json();
    const rate = data.rates.INR;

    if (rate) {
      // 3. Update cache in DB (swallow errors if table missing)
      await supabase.from('settings').upsert({ 
        key: 'usd_rate', 
        value: rate.toString(),
        updated_at: new Date().toISOString()
      });
      
      return rate;
    }

    return cached ? parseFloat(cached.value) : FALLBACK_RATE;
  } catch (error) {
    console.error('Error fetching live rate:', error);
    return FALLBACK_RATE;
  }
}
