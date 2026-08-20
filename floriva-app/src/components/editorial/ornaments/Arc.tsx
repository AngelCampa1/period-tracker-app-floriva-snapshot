import { View } from 'react-native';

import { editorialPalette } from '@/src/theme/tokens';

type ArcProps = {
  color?: string;
  size?: number;
  opacity?: number;
};

export function Arc({ color = editorialPalette.accent, size = 120, opacity = 0.12 }: ArcProps) {
  const radii = [56, 42, 28];
  const alphas = [opacity, opacity * 0.7, opacity * 0.5];

  return (
    <View style={{ width: size, height: size }}>
      {radii.map((r, i) => {
        const dims = (r / 60) * size;
        const offset = (size - dims) / 2;
        return (
          <View
            key={r}
            style={{
              position: 'absolute',
              width: dims,
              height: dims,
              borderRadius: dims / 2,
              borderWidth: 1,
              borderColor: color,
              opacity: alphas[i],
              top: offset,
              left: offset,
            }}
          />
        );
      })}
    </View>
  );
}
