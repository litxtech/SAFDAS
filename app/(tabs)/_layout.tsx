import { Tabs } from 'expo-router';
import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import { useAuthStore } from '@/stores/authStore';

export default function TabsLayout() {
  const isStaff = useAuthStore((state) => state.isStaff);
  return (
    <Tabs tabBar={(props) => <LiquidTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="worship" />
      <Tabs.Screen name="create" options={{ href: isStaff ? null : undefined }} />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="admin" options={{ href: isStaff ? undefined : null }} />
    </Tabs>
  );
}
