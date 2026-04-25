import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermission, rescheduleAll } from '@/utils/notifications';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const router   = useRouter();
  const segments = useSegments();

  // ── Handle notification taps (open app to followups screen) ──────────────
  const notifResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    notifResponseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.screen === 'followups' && session) {
        router.push('/(sales)/followups' as any);
      }
    });

    return () => {
      notifResponseListener.current?.remove();
    };
  }, [session]);

  // ── Route guard + notification bootstrap ─────────────────────────────────
  useEffect(() => {
    if (loading) return;

    const inAdmin      = segments[0] === '(admin)';
    const inSales      = segments[0] === '(sales)';
    const inOperations = segments[0] === '(operations)';
    const inFinance    = segments[0] === '(finance)';
    const inLogin      = segments[0] === 'login';

    if (!session) {
      if (!inLogin) router.replace('/login');
      return;
    }

    if (!profile) return;

    if (profile.role === 'admin' && !inAdmin) {
      router.replace('/(admin)');
    } else if (profile.role === 'sale' && !inSales) {
      router.replace('/(sales)');
    } else if (profile.role === 'operations' && !inOperations) {
      router.replace('/(operations)');
    } else if (profile.role === 'finance' && !inFinance) {
      router.replace('/(finance)');
    }

    // ── Bootstrap notifications for sales users ───────────────────────────
    if (profile.role === 'sale') {
      requestNotificationPermission().then(granted => {
        if (granted) {
          rescheduleAll(profile.id).catch(console.warn);
        }
      });
    }

  }, [session, profile, loading]);

  return (
    <Stack>
      <Stack.Screen name="login"        options={{ headerShown: false }} />
      <Stack.Screen name="(admin)"      options={{ headerShown: false }} />
      <Stack.Screen name="(sales)"      options={{ headerShown: false }} />
      <Stack.Screen name="(operations)" options={{ headerShown: false }} />
      <Stack.Screen name="(finance)"    options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
