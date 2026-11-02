import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AdminInset, AdminSection } from '@/components/admin/AdminKit';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { fetchPendingForAdmin, moderateRecording } from '@/services/studio/api';
import { openStudioDetail } from '@/services/studio/nav';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminStudioScreen() {
  const isStaff = useAuthStore((state) => state.isStaff);
  const t = useT();
  const show = useToastStore((state) => state.show);
  const { colors } = useTheme();
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['admin-studio-pending'],
    enabled: isStaff,
    queryFn: () => fetchPendingForAdmin(),
  });

  if (!isStaff) return <Redirect href="/(tabs)" />;

  async function act(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    try {
      await moderateRecording(id, action, action === 'reject' ? reason.trim() || undefined : undefined);
      void client.invalidateQueries({ queryKey: ['admin-studio-pending'] });
      show(action === 'approve' ? t('studioApproved') : t('studioRejected'), 'success');
      if (action === 'reject') setReason('');
    } catch (error) {
      show(error instanceof Error ? error.message : t('studioModerateFailed'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll>
      <AppHeader title={t('studioAdminTitle')} subtitle={t('studioAdminHint')} />
      <AdminInset>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={t('studioRejectReason')}
          placeholderTextColor={colors.textSecondary}
          style={{
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: 12,
          }}
        />

        {query.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {!query.isLoading && !(query.data?.length ?? 0) ? (
          <AppEmptyState title={t('studioNoPending')} description={t('studioNoPendingHint')} />
        ) : null}

        {(query.data ?? []).map((item) => (
          <AdminSection key={item.id} title={item.title}>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
              {item.profiles?.display_name || item.profiles?.username || item.owner_id}
              {' · '}
              {item.content_type}
              {' · '}
              {Math.round(item.duration_seconds)}s
            </Text>
            {item.description ? (
              <Text style={{ color: colors.text, marginBottom: 10 }} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => openStudioDetail(item.id)}
                style={chip(colors.backgroundSecondary, colors.text)}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>{t('studioOpen')}</Text>
              </Pressable>
              <Pressable
                disabled={busyId === item.id}
                onPress={() => void act(item.id, 'approve')}
                style={chip('#1DB954', '#000')}
              >
                <Text style={{ color: '#000', fontWeight: '800' }}>{t('studioApprove')}</Text>
              </Pressable>
              <Pressable
                disabled={busyId === item.id}
                onPress={() => void act(item.id, 'reject')}
                style={chip(colors.error, '#fff')}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>{t('studioReject')}</Text>
              </Pressable>
            </View>
          </AdminSection>
        ))}
      </AdminInset>
    </Screen>
  );
}

function chip(bg: string, _fg: string) {
  return {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}
