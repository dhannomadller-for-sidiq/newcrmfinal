import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAdmin = segments[0] === '(admin)';
    const inSales = segments[0] === '(sales)';
    const inOperations = segments[0] === '(operations)';
    const inFinance = segments[0] === '(finance)';
    const inLogin = segments[0] === 'login';

    if (!session) {
      if (!inLogin) router.replace('/login');
      return;
    }

    // Session exists but profile not yet loaded — wait
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
  }, [session, profile, loading]);

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(sales)" options={{ headerShown: false }} />
      <Stack.Screen name="(operations)" options={{ headerShown: false }} />
      <Stack.Screen name="(finance)" options={{ headerShown: false }} />
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
