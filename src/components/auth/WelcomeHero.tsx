import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';

const MARK = require('../../../assets/icon.png');

function SoftOrb({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style: object;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function Lattice({ dark }: { dark: boolean }) {
  const stroke = dark ? 'rgba(167, 139, 250, 0.14)' : 'rgba(124, 58, 237, 0.1)';
  const cells = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <View pointerEvents="none" style={styles.lattice}>
      {cells.map((row) =>
        cells.map((col) => (
          <View
            key={`${row}-${col}`}
            style={[
              styles.diamond,
              {
                borderColor: stroke,
                left: col * 46 - 40,
                top: row * 46 - 36,
              },
            ]}
          />
        )),
      )}
    </View>
  );
}

export function WelcomeHero({ height }: { height: number }) {
  const { name } = useTheme();
  const dark = name === 'dark';
  const { width } = useWindowDimensions();
  const artSize = Math.min(width * 0.62, height * 0.78, 248);

  return (
    <View style={[styles.stage, { height }]}>
      <LinearGradient
        colors={
          dark
            ? ['#2F2748', '#221C38', '#17141F']
            : ['#F8F5FF', '#F3EEFF', '#FFFFFF']
        }
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SoftOrb
        size={height * 0.72}
        color={dark ? 'rgba(124, 58, 237, 0.28)' : 'rgba(139, 92, 246, 0.18)'}
        style={{ top: -height * 0.12, alignSelf: 'center', left: width * 0.18 }}
      />
      <SoftOrb
        size={height * 0.5}
        color={dark ? 'rgba(167, 139, 250, 0.16)' : 'rgba(237, 228, 255, 0.95)'}
        style={{ bottom: -height * 0.08, right: -20 }}
      />
      <SoftOrb
        size={height * 0.36}
        color={dark ? 'rgba(91, 33, 182, 0.32)' : 'rgba(124, 58, 237, 0.08)'}
        style={{ bottom: height * 0.1, left: -28 }}
      />
      <Lattice dark={dark} />
      <View style={[styles.glow, { width: artSize * 1.15, height: artSize * 0.42, bottom: height * 0.1 }]}>
        <LinearGradient
          colors={
            dark
              ? ['rgba(139, 92, 246, 0)', 'rgba(139, 92, 246, 0.32)', 'rgba(139, 92, 246, 0)']
              : ['rgba(124, 58, 237, 0)', 'rgba(124, 58, 237, 0.12)', 'rgba(124, 58, 237, 0)']
          }
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={[
          styles.artPlate,
          {
            width: artSize,
            height: artSize,
            backgroundColor: dark ? 'rgba(243, 238, 255, 0.94)' : 'transparent',
            borderRadius: artSize * 0.28,
          },
        ]}
      >
        <Image
          source={MARK}
          style={{ width: artSize, height: artSize }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lattice: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  diamond: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 6,
    transform: [{ rotate: '45deg' }],
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  artPlate: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
