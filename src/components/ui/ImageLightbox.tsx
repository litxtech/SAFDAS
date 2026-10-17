import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';

type Props = {
  uri: string | null | undefined;
  visible: boolean;
  onClose: () => void;
};

/** Full-screen image preview. Tap the dark empty area to dismiss. */
export function ImageLightbox({ uri, visible, onClose }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          onPress={onClose}
          style={StyleSheet.absoluteFillObject}
        />
        <View pointerEvents="box-none" style={styles.stage}>
          {/* Absorbs taps on the photo so only empty space closes. */}
          <Pressable accessibilityRole="image" accessibilityLabel={t('cover')} style={styles.frame}>
            <Image source={{ uri }} style={styles.image} contentFit="contain" transition={120} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  frame: {
    width: '100%',
    height: '88%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
