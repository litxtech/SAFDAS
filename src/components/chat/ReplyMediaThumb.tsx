import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

/** Compact media thumb for reply composer strip. */
export function ReplyMediaThumb({ url, type }: { url: string; type: string | null }) {
  return (
    <View style={styles.wrap}>
      {type === 'video' ? (
        <View style={[styles.thumb, styles.fallback]} />
      ) : (
        <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
      )}
      {type === 'video' ? (
        <View style={styles.badge}>
          <Ionicons name="play" size={10} color="#fff" style={{ marginLeft: 1 }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  thumb: { width: '100%', height: '100%' },
  fallback: { backgroundColor: '#1a1d24' },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
