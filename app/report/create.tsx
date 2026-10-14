import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT, type I18nKey } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const REASONS: { id: string; label: I18nKey }[] = [
  { id: 'harassment', label: 'reasonHarassment' },
  { id: 'hate', label: 'reasonHate' },
  { id: 'violence', label: 'reasonViolence' },
  { id: 'sexual', label: 'reasonSexual' },
  { id: 'child_safety', label: 'reasonChild' },
  { id: 'scam', label: 'reasonScam' },
  { id: 'spam', label: 'reasonSpam' },
  { id: 'fake', label: 'reasonFake' },
  { id: 'privacy', label: 'reasonPrivacy' },
  { id: 'copyright', label: 'reasonCopyright' },
  { id: 'other', label: 'reasonOther' },
];

const URGENT = new Set(['violence', 'child_safety', 'sexual']);

export default function ReportCreateScreen() {
  const params = useLocalSearchParams<{ targetType?: string; targetId?: string }>();
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [reason, setReason] = useState<string>('spam');
  const [details, setDetails] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!userId) return;
    setLoading(true);
    const { data, error: insertError } = await requireSupabase()
      .from('reports')
      .insert({
        reporter_id: userId,
        target_type: params.targetType ?? 'profile',
        target_id: params.targetId ?? null,
        reason,
        details,
        priority: URGENT.has(reason) ? 'urgent' : 'normal',
      })
      .select('id, reference_code')
      .single();
    setLoading(false);
    if (insertError || !data) setError(insertError?.message ?? t('reportSendFailed'));
    else {
      setReference(data.reference_code as string);
      setReportId(data.id as string);
    }
  }

  if (reference && reportId) {
    return (
      <Screen>
        <AppCard elevated>
          <Text style={{ color: colors.success, fontSize: 28, fontWeight: '800' }}>{t('reportReceivedTitle')}</Text>
          <Text style={{ color: colors.text, lineHeight: 22, marginTop: 8 }}>{t('reportReceivedBody')}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{t('reportReceivedSla')}</Text>
          <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 12 }}>{reference}</Text>
          <AppButton label={t('viewReport')} onPress={() => router.replace({ pathname: '/report/[id]', params: { id: reportId } })} />
          <AppButton label={t('ok')} variant="secondary" onPress={() => router.back()} />
        </AppCard>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppHeader title={t('reportAction')} subtitle={t('reportHint')} />
      {REASONS.map((item) => (
        <Pressable key={item.id} onPress={() => setReason(item.id)}>
          <Text style={{ color: reason === item.id ? colors.primary : colors.text, paddingVertical: 8, fontWeight: reason === item.id ? '700' : '400' }}>{t(item.label)}</Text>
        </Pressable>
      ))}
      <AppInput label={t('details')} multiline value={details} onChangeText={setDetails} style={{ minHeight: 120, textAlignVertical: 'top' }} />
      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
      <AppButton label={t('send')} loading={loading} onPress={() => void submit()} />
    </Screen>
  );
}
