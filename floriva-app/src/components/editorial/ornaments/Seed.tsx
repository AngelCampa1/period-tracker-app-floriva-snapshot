import Svg, { Ellipse } from 'react-native-svg';

import { editorialPalette } from '@/src/theme/tokens';

type SeedProps = {
  color?: string;
  size?: number;
};

export function Seed({ color = editorialPalette.accent, size = 14 }: SeedProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Ellipse cx={7} cy={7} rx={3} ry={6} fill={color} transform="rotate(20 7 7)" />
    </Svg>
  );
}
