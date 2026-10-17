import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export function stackScreenOptions(rtl: boolean): NativeStackNavigationOptions {
  return {
    headerShown: false,
    animation: Platform.OS === 'ios' ? 'simple_push' : rtl ? 'ios_from_left' : 'ios_from_right',
    animationDuration: 220,
    gestureEnabled: true,
    fullScreenGestureEnabled: false,
  };
}
