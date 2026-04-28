 import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/lib/salesConstants';

export type TabType = 'assigned' | 'mine' | 'confirmed' | 'allocated';

export function useSalesLeads(tabType?: TabType) {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    
    try {
      console.log('--- FETCH LEADS DEBUG ---');
      console.log('TabType:', tabType);
      console.log('ProfileID:', profile.id);
      
      let query = supabase.from('leads').select('*');

      if (tabType === 'assigned') {
        query = query
          .eq('assigned_to', profile.id)
          .is('next_followup_at', null)
          .eq('returned_to_admin', false)
          .not('status', 'in', '(Lost,Converted,Allocated)');
      } else if (tabType === 'mine') {
        query = query
          .eq('added_by', profile.id)
          .is('next_followup_at', null)
          .eq('returned_to_admin', false)
          .not('status', 'in', '(Lost,Converted,Allocated)');
      } else if (tabType === 'confirmed') {
        // More robust OR syntax
        query = query
          .or(`assigned_to.eq.${profile.id},added_by.eq.${profile.id}`)
          .eq('status', 'Converted');
      } else if (tabType === 'allocated') {
        query = query
          .or(`assigned_to.eq.${profile.id},added_by.eq.${profile.id}`)
          .eq('status', 'Allocated');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase Query Error:', error);
        throw error;
      }
      
      console.log('Results Count:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('First result status:', data[0].status);
      }
      setLeads(data || []);
    } catch (error: any) {
      console.error('Error fetching leads:', error);
      Alert.alert('Error', error.message || 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [profile, tabType]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return { leads, loading, refresh: fetchLeads };
}
