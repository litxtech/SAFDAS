import { Stack } from 'expo-router';
import { isRtlLocale, useI18nStore } from '@/i18n';
import { stackScreenOptions } from '@/navigation/screenOptions';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

export default function AuthLayout() {
  const rtl = isRtlLocale(useI18nStore((state) => state.locale));
  return (
    <Stack screenOptions={stackScreenOptions(rtl)}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="forgot" />
      <Stack.Screen name="complete-profile" />
    </Stack>
  );
}
