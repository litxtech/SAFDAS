export type ThemeName = 'dark' | 'light';
export type ThemePreference = ThemeName | 'system';

export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryMuted: string;
  onPrimary: string;
  text: string;
  textSecondary: string;
  textInverse: string;
  border: string;
  divider: string;
  success: string;
  error: string;
  warning: string;
  icon: string;
  iconMuted: string;
  tabBar: string;
  tabBarBorder: string;
  overlay: string;
  incomingBubble: string;
  outgoingBubble: string;
  unread: string;
  shadow: string;
  skeleton: string;
  statusBar: 'light' | 'dark';
};

export const themes: Record<ThemeName, ThemeColors> = {
  dark: {
    background: '#191B24',
    backgroundSecondary: '#20222D',
    surface: '#282B36',
    surfaceElevated: '#303341',
    primary: '#A65CD6',
    primaryLight: '#BB82E8',
    primaryDark: '#7543A8',
    primaryMuted: 'rgba(166, 92, 214, 0.16)',
    onPrimary: '#FFFFFF',
    text: '#F7F7FA',
    textSecondary: '#A8AAB9',
    textInverse: '#20212B',
    border: '#383B49',
    divider: '#343744',
    success: '#45C6A5',
    error: '#F07183',
    warning: '#F1BB68',
    icon: '#F7F7FA',
    iconMuted: '#A8AAB9',
    tabBar: 'rgba(32, 34, 45, 0.82)',
    tabBarBorder: 'rgba(255, 255, 255, 0.08)',
    overlay: 'rgba(12, 13, 18, 0.62)',
    incomingBubble: '#303341',
    outgoingBubble: '#7543A8',
    unread: 'rgba(166, 92, 214, 0.14)',
    shadow: '#000000',
    skeleton: '#343744',
    statusBar: 'light',
  },
  light: {
    background: '#F8F8FC',
    backgroundSecondary: '#F0F0F6',
    surface: '#FFFFFF',
    surfaceElevated: '#F5F2FA',
    primary: '#8745BD',
    primaryLight: '#A65CD6',
    primaryDark: '#7543A8',
    primaryMuted: '#F1E6FA',
    onPrimary: '#FFFFFF',
    text: '#20212B',
    textSecondary: '#777987',
    textInverse: '#F7F7FA',
    border: '#E7E4ED',
    divider: '#ECEAF1',
    success: '#16856B',
    error: '#CF4058',
    warning: '#A56B13',
    icon: '#20212B',
    iconMuted: '#777987',
    tabBar: 'rgba(255, 255, 255, 0.86)',
    tabBarBorder: 'rgba(32, 33, 43, 0.06)',
    overlay: 'rgba(32, 33, 43, 0.4)',
    incomingBubble: '#F0F0F6',
    outgoingBubble: '#8745BD',
    unread: '#F1E6FA',
    shadow: '#20212B',
    skeleton: '#ECEAF1',
    statusBar: 'dark',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const type = {
  caption: 12,
  small: 13,
  body: 15,
  title: 17,
  headline: 22,
  display: 32,
} as const;
