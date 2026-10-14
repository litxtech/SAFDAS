import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  children?: React.ReactNode;
  onClose: () => void;
};

export function AppModal({ visible, title, body, children, onClose }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {body ? <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { borderRadius: radius.xl, padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
});
