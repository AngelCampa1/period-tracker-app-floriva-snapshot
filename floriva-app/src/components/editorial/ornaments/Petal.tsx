import { View } from 'react-native';

import { editorialPalette } from '@/src/theme/tokens';

type PetalProps = {
  color?: string;
  size?: number;
  opacity?: number;
};

export function Petal({ color = editorialPalette.accent, size = 56, opacity = 1 }: PetalProps) {
  const w = Math.round((32 / 56) * size);
  const h = Math.round((48 / 56) * size);
  const rBottom = Math.round(w / 2);
  const rTop = Math.round(w * 0.38);
  const offsetBottom = Math.round((4 / 56) * size);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: offsetBottom,
      }}
    >
      <View
        style={{
          width: w,
          height: h,
          backgroundColor: color,
          opacity,
          borderBottomLeftRadius: rBottom,
          borderBottomRightRadius: rBottom,
          borderTopLeftRadius: rTop,
          borderTopRightRadius: rTop,
        }}
      />
    </View>
  );
}
