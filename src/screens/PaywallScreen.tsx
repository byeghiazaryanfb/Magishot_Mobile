import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../theme/ThemeContext';

const {width, height} = Dimensions.get('window');

interface PaywallScreenProps {
  visible?: boolean;
  onClose: () => void;
  onPurchase?: (planId: string) => void;
}

interface PricingPlan {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  billingPeriod: string;
  isPopular?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'weekly',
    title: '7-Day Full Access',
    subtitle: 'Then $11.99/week',
    price: 'USD 5.99',
    billingPeriod: 'Billed weekly',
    isPopular: true,
  },
  {
    id: 'yearly',
    title: 'Yearly Access',
    subtitle: 'was $59.99',
    price: 'USD 49.99',
    billingPeriod: 'Billed yearly',
  },
];

const PaywallScreen: React.FC<PaywallScreenProps> = ({
  onClose,
  onPurchase,
}) => {
  const {colors} = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<string>('weekly');
  const [timeLeft, setTimeLeft] = useState({hours: 0, minutes: 59, seconds: 59});
  const [joinedCount] = useState(Math.floor(Math.random() * 1000) + 1500);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return {...prev, seconds: prev.seconds - 1};
        } else if (prev.minutes > 0) {
          return {...prev, minutes: prev.minutes - 1, seconds: 59};
        } else if (prev.hours > 0) {
          return {hours: prev.hours - 1, minutes: 59, seconds: 59};
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  const handlePurchase = () => {
    onPurchase?.(selectedPlan);
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={require('../../assets/paywall_bg.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', colors.background]}
            style={styles.heroGradient}
          />

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeButton, {backgroundColor: 'rgba(0,0,0,0.5)'}]}
            onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

          {/* Hero Title */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Unlimited Access</Text>
            <Text style={styles.heroSubtitle}>Transform Your Photos</Text>
          </View>
        </View>

        {/* Timer Section */}
        <View style={styles.timerSection}>
          <Text style={[styles.offerText, {color: colors.textSecondary}]}>
            Offer ends in:
          </Text>
          <View style={styles.timerContainer}>
            <Text style={[styles.timerText, {color: colors.primary}]}>
              {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
            </Text>
          </View>
        </View>

        {/* Joined Badge */}
        <View style={[styles.joinedBadge, {backgroundColor: colors.primary + '20'}]}>
          <Text style={[styles.joinedText, {color: colors.primary}]}>
            {joinedCount} joined today!
          </Text>
        </View>

        {/* Pricing Cards */}
        <View style={styles.pricingContainer}>
          {PRICING_PLANS.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.pricingCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor:
                    selectedPlan === plan.id ? colors.primary : colors.border,
                  borderWidth: selectedPlan === plan.id ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.8}>
              <Text style={[styles.planTitle, {color: colors.primary}]}>
                {plan.title}
              </Text>
              <Text style={[styles.planSubtitle, {color: colors.textSecondary}]}>
                {plan.subtitle}
              </Text>
              <Text style={[styles.planPrice, {color: colors.textPrimary}]}>
                {plan.price}
              </Text>
              <Text style={[styles.planBilling, {color: colors.textTertiary}]}>
                {plan.billingPeriod}
              </Text>
              {plan.isPopular && (
                <View style={[styles.popularBadge, {backgroundColor: colors.primary}]}>
                  <Text style={styles.popularText}>Best Value</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>


        {/* CTA Button */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.ctaGradient}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handlePurchase}
            activeOpacity={0.9}>
            <Text style={styles.ctaText}>Start Trial</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Cancel Text */}
        <Text style={[styles.cancelText, {color: colors.textTertiary}]}>
          Cancel anytime, no questions asked.
        </Text>

        {/* Footer Links */}
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => openLink('https://example.com/terms')}>
            <Text style={[styles.footerLink, {color: colors.textSecondary}]}>
              Terms of use
            </Text>
          </TouchableOpacity>
          <View style={[styles.footerDivider, {backgroundColor: colors.border}]} />
          <TouchableOpacity onPress={() => openLink('https://example.com/privacy')}>
            <Text style={[styles.footerLink, {color: colors.textSecondary}]}>
              Privacy policy
            </Text>
          </TouchableOpacity>
          <View style={[styles.footerDivider, {backgroundColor: colors.border}]} />
          <TouchableOpacity onPress={() => console.log('Restore')}>
            <Text style={[styles.footerLink, {color: colors.textSecondary}]}>
              Restore
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    height: height * 0.4,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  heroContent: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  timerSection: {
    alignItems: 'center',
    marginTop: -20,
    paddingHorizontal: 20,
  },
  offerText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  timerContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 2,
  },
  joinedBadge: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  joinedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pricingContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  pricingCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    position: 'relative',
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  planSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
  },
  planBilling: {
    fontSize: 12,
    marginTop: 4,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  ctaGradient: {
    marginHorizontal: 20,
    marginTop: 32,
    borderRadius: 16,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaButton: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerDivider: {
    width: 1,
    height: 14,
  },
});

export default PaywallScreen;
