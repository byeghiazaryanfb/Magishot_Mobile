import React from 'react';
import Svg, {Path, G} from 'react-native-svg';

interface TryOnIconProps {
  size?: number;
  color?: string;
  focused?: boolean;
}

const TryOnIcon: React.FC<TryOnIconProps> = ({
  size = 24,
  color = '#000',
  focused = false,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Cart */}
      <Path
        d="M4 4h2l.4 2M6.4 6h13.2l-1.8 9H8.2L6.4 6zM8 19a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z"
        stroke={color}
        strokeWidth={focused ? 2 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* T-shirt inside cart */}
      <G transform="translate(8.5, 7.5) scale(0.35)">
        <Path
          d="M20.38 8.57l-1.23 1.85a1 1 0 0 1-.84.45H16v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-10H5.69a1 1 0 0 1-.84-.45L3.62 8.57a1 1 0 0 1 .07-1.18L7 3.18A1 1 0 0 1 7.81 3H10v1a2 2 0 0 0 4 0V3h2.19a1 1 0 0 1 .78.36l3.34 4.18a1 1 0 0 1 .07 1.03z"
          fill={focused ? color : 'none'}
          stroke={color}
          strokeWidth={focused ? 1.5 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
};

export default TryOnIcon;
