import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ink } from '@/components/listen/chrome';
import { useT, type I18nKey } from '@/i18n';
import type { StudioRecording, StudioStatus, StudioVisibility } from '@/services/studio/types';

type Tone = 'green' | 'amber' | 'red' | 'muted' | 'blue';

type Chip = { key: string; label: I18nKey; tone: Tone };

const TONE: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: 'rgba(29,185,84,0.18)', fg: '#1DB954' },
  amber: { bg: 'rgba(255,193,7,0.16)', fg: '#FFC107' },
  red: { bg: 'rgba(255,107,107,0.16)', fg: '#ff6b6b' },
  muted: { bg: 'rgba(255,255,255,0.08)', fg: ink.muted },
  blue: { bg: 'rgba(100,160,255,0.16)', fg: '#7EB6FF' },
};

export function studioStatusChips(
  status: StudioStatus,
  visibility: StudioVisibility,
): Chip[] {
  switch (status) {
    case 'pending_review':
      return [{ key: 'pending', label: 'studioStatusPendingReview', tone: 'amber' }];
    case 'published': {
      const chips: Chip[] = [{ key: 'approved', label: 'studioStatusApproved', tone: 'green' }];
      if (visibility === 'public') {
        chips.push({ key: 'listed', label: 'studioStatusListed', tone: 'green' });
      } else if (visibility === 'unlisted') {
        chips.push({ key: 'unlisted', label: 'studioStatusUnlisted', tone: 'blue' });
      } else {
        chips.push({ key: 'private', label: 'studioStatusPrivate', tone: 'muted' });
      }
      return chips;
    }
    case 'rejected':
      return [{ key: 'rejected', label: 'studioStatusRejected', tone: 'red' }];
    case 'hidden':
      return [{ key: 'hidden', label: 'studioStatusHidden', tone: 'red' }];
    case 'draft':
      return [{ key: 'draft', label: 'studioStatusDraft', tone: 'muted' }];
    case 'uploading':
      return [{ key: 'uploading', label: 'studioStatusUploading', tone: 'amber' }];
    case 'processing':
      return [{ key: 'processing', label: 'studioStatusProcessing', tone: 'amber' }];
    case 'deleted':
      return [{ key: 'deleted', label: 'studioStatusDeleted', tone: 'red' }];
    default:
      return [];
  }
}

type Props = {
  recording: Pick<StudioRecording, 'status' | 'visibility'>;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function StudioStatusBadges({ recording, style, compact }: Props) {
  const t = useT();
  const chips = studioStatusChips(recording.status, recording.visibility);
  if (!chips.length) return null;

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
      {chips.map((chip) => {
        const tone = TONE[chip.tone];
        return (
          <View
            key={chip.key}
            style={{
              backgroundColor: tone.bg,
              paddingHorizontal: compact ? 8 : 10,
              paddingVertical: compact ? 3 : 4,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: tone.fg, fontSize: compact ? 11 : 12, fontWeight: '800' }}>{t(chip.label)}</Text>
          </View>
        );
      })}
    </View>
  );
}
