import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { UploadProgressBar } from '@/components/chat/UploadProgressBar';

type Props = {
  url: string;
  type: string | null;
  onPress?: () => void;
  onDoubleTap?: () => void;
  /** 0–1 while uploading; shows animated bar overlay. */
  uploadProgress?: number | null;
};

function useDoubleTap(onPress?: () => void, onDoubleTap?: () => void) {
  const lastTap = useRef(0);
  return () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      onDoubleTap?.();
      return;
    }
    lastTap.current = now;
    if (onDoubleTap) {
      setTimeout(() => {
        if (lastTap.current === now) onPress?.();
      }, 280);
    } else {
      onPress?.();
    }
  };
}

function VideoChrome({ uploadProgress }: { uploadProgress?: number | null }) {
  return (
    <>
      <View style={styles.videoScrim} />
      <View style={[styles.play, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
        <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
      </View>
      <View style={[styles.badge, { borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(0,0,0,0.28)' }]}>
        <Ionicons name="videocam" size={12} color="#FFFFFF" />
      </View>
      <View pointerEvents="none" style={[styles.edge, { borderColor: 'rgba(255,255,255,0.18)' }]} />
      {uploadProgress != null ? <UploadProgressBar progress={uploadProgress} /> : null}
    </>
  );
}

function ChatVideoMedia({ onPress, onDoubleTap, uploadProgress }: Omit<Props, 'type' | 'url'>) {
  const handlePress = useDoubleTap(onPress, onDoubleTap);
  // Static poster only — mounting expo-video per bubble heats lists while scrolling.
  return (
    <Pressable onPress={handlePress} style={styles.frame}>
      <View style={[styles.image, styles.fallbackBg]} />
      <VideoChrome uploadProgress={uploadProgress} />
    </Pressable>
  );
}

function ChatImageMedia({ url, onPress, onDoubleTap, uploadProgress }: Omit<Props, 'type'>) {
  const handlePress = useDoubleTap(onPress, onDoubleTap);
  return (
    <Pressable onPress={handlePress} style={styles.frame}>
      <Image source={{ uri: url }} style={styles.image} contentFit="cover" />
      <View pointerEvents="none" style={[styles.edge, { borderColor: 'rgba(255,255,255,0.18)' }]} />
      {uploadProgress != null ? <UploadProgressBar progress={uploadProgress} /> : null}
    </Pressable>
  );
}

/** Thin translucent frame — video cells use a static poster; playback is fullscreen-only. */
export function ChatMedia({ url, type, onPress, onDoubleTap, uploadProgress }: Props) {
  if (type === 'video') {
    return <ChatVideoMedia onPress={onPress} onDoubleTap={onDoubleTap} uploadProgress={uploadProgress} />;
  }
  return <ChatImageMedia url={url} onPress={onPress} onDoubleTap={onDoubleTap} uploadProgress={uploadProgress} />;
}

const styles = StyleSheet.create({
  frame: {
    width: 228,
    height: 168,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: 2,
  },
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: { width: '100%', height: '100%' },
  fallbackBg: { backgroundColor: '#1a1d24' },
  videoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
