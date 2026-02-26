import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface PriceBadgeProps {
  estimatedCoins?: number;
  isFree?: boolean;
  variant: 'inline' | 'modal';
}

const PriceBadge: React.FC<PriceBadgeProps> = ({estimatedCoins, isFree, variant}) => {
  if (!isFree && (!estimatedCoins || estimatedCoins <= 0)) {
    return null;
  }

  const isInline = variant === 'inline';
  const positionStyle = isInline ? styles.inlinePosition : styles.modalPosition;

  if (isFree) {
    return (
      <View style={[styles.badge, styles.freeBadge, positionStyle]}>
        <Text style={[styles.badgeText, isInline ? styles.inlineText : styles.modalText]}>FREE</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.coinsBadge, positionStyle]}>
      <Text style={[styles.badgeText, isInline ? styles.inlineText : styles.modalText]}>
        {estimatedCoins} ★
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  freeBadge: {
    backgroundColor: '#22C55E',
  },
  coinsBadge: {
    backgroundColor: '#F59E0B',
  },
  inlinePosition: {
    top: -6,
    left: -6,
  },
  modalPosition: {
    top: 4,
    left: 4,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inlineText: {
    fontSize: 13,
  },
  modalText: {
    fontSize: 12,
  },
});

export default PriceBadge;
