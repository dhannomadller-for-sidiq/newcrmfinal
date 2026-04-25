/**
 * NotificationService — local scheduled reminders for sales follow-ups
 *
 * How it works:
 * 1. When a salesperson sets next_followup_at via EditProfileModal →
 *    scheduleFollowupReminder() creates a local notification that fires at that time.
 * 2. Each notification ID is stored in AsyncStorage keyed by lead ID so it can
 *    be cancelled/replaced when the follow-up is rescheduled.
 * 3. On every app open (AuthContext + useEffect), rescheduleAll() is called to
 *    re-sync all upcoming follow-ups from Supabase.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ── Notification appearance while app is foregrounded ────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

const STORAGE_PREFIX = 'notif_id_';

// ── Request permission (call once on login) ───────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false; // simulators don't support push

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Schedule a single follow-up reminder ─────────────────────────────────────
export async function scheduleFollowupReminder(params: {
  leadId:   string;
  leadName: string;
  followupAt: string; // ISO timestamp from Supabase
}): Promise<void> {
  const { leadId, leadName, followupAt } = params;

  const triggerDate = new Date(followupAt);
  const now         = new Date();

  // Don't schedule past notifications
  if (triggerDate <= now) return;

  // Cancel existing notification for this lead (if rescheduled)
  await cancelLeadNotification(leadId);

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📞 Follow-up Due',
      body:  `Time to follow up with ${leadName}`,
      sound: true,
      data:  { leadId, screen: 'followups' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  // Persist notification ID so we can cancel it later
  await AsyncStorage.setItem(`${STORAGE_PREFIX}${leadId}`, notifId);
}

// ── Cancel a notification for one lead ───────────────────────────────────────
export async function cancelLeadNotification(leadId: string): Promise<void> {
  const key     = `${STORAGE_PREFIX}${leadId}`;
  const notifId = await AsyncStorage.getItem(key);
  if (notifId) {
    await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
    await AsyncStorage.removeItem(key);
  }
}

// ── Schedule 15-minute early reminder ────────────────────────────────────────
export async function scheduleEarlyReminder(params: {
  leadId: string; leadName: string; followupAt: string;
}): Promise<void> {
  const { leadId, leadName, followupAt } = params;
  const triggerDate = new Date(new Date(followupAt).getTime() - 15 * 60 * 1000);
  if (triggerDate <= new Date()) return;

  const earlyKey = `${STORAGE_PREFIX}early_${leadId}`;
  const oldId    = await AsyncStorage.getItem(earlyKey);
  if (oldId) {
    await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
  }

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Follow-up in 15 minutes',
      body:  `Upcoming: follow up with ${leadName}`,
      sound: true,
      data:  { leadId, screen: 'followups' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  await AsyncStorage.setItem(earlyKey, notifId);
}

// ── Re-sync all upcoming follow-ups from Supabase ────────────────────────────
// Called on every app launch for role=sale users
export async function rescheduleAll(userId: string): Promise<void> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const now = new Date().toISOString();

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, next_followup_at')
    .eq('added_by', userId)
    .not('next_followup_at', 'is', null)
    .gt('next_followup_at', now);

  if (!leads?.length) return;

  for (const lead of leads) {
    await scheduleFollowupReminder({
      leadId:     lead.id,
      leadName:   lead.name,
      followupAt: lead.next_followup_at!,
    });
    await scheduleEarlyReminder({
      leadId:     lead.id,
      leadName:   lead.name,
      followupAt: lead.next_followup_at!,
    });
  }
}
