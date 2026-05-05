import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';

interface CoinInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

const CoinInfoModal: React.FC<CoinInfoModalProps> = ({visible, onClose}) => {
  const {colors} = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, {backgroundColor: colors.cardBackground}]}>
          <View style={styles.header}>
            <View style={[styles.coinCircle, {backgroundColor: colors.primary}]}>
              <Text style={styles.coinSymbol}>★</Text>
            </View>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              What are coins?
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <Text style={[styles.intro, {color: colors.textSecondary}]}>
              Coins are your in-app currency for MagiShot's AI-powered features.
              Spend them on:
            </Text>

            <View style={styles.bulletList}>
              {[
                'AI photo transformations',
                'Virtual Try-On & outfit swap',
                'Animated videos & AI comics',
                'Pro editor effects',
                'Photo restore & enhance',
              ].map(item => (
                <View key={item} style={styles.bulletRow}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={[styles.bulletText, {color: colors.textPrimary}]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
              How to earn coins
            </Text>
            <View style={styles.earnTable}>
              <EarnRow
                label="Start a 7-day free trial"
                value="+20 coins"
                colors={colors}
              />
              <EarnRow label="Weekly plan" value="+700 / week" colors={colors} />
              <EarnRow label="Monthly plan" value="+2,500 / month" colors={colors} />
              <EarnRow label="Yearly plan" value="+5,000 / year" colors={colors} />
            </View>

            <View style={[styles.tipBox, {borderColor: colors.border}]}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.primary}
                style={styles.tipIcon}
              />
              <Text style={[styles.tipText, {color: colors.textSecondary}]}>
                Coins never expire and they stack up across renewals. You can
                only spend them while your Pro subscription is active — if it
                ends, your balance is preserved and unlocks again when you
                resubscribe.
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.cta, {backgroundColor: colors.primary}]}
            onPress={onClose}
            activeOpacity={0.85}>
            <Text style={styles.ctaText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const EarnRow: React.FC<{label: string; value: string; colors: any}> = ({
  label,
  value,
  colors,
}) => (
  <View style={styles.earnRow}>
    <Text style={[styles.earnLabel, {color: colors.textSecondary}]}>{label}</Text>
    <Text style={[styles.earnValue, {color: colors.primary}]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 20,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 12,
  },
  coinCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinSymbol: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  bulletList: {
    marginTop: 14,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletText: {
    fontSize: 14,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  earnTable: {
    gap: 8,
  },
  earnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  earnLabel: {
    fontSize: 14,
    flex: 1,
  },
  earnValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipBox: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  cta: {
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CoinInfoModal;
