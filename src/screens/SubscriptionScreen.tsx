import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  pricePerMonth?: string;
  savings?: string;
  popular?: boolean;
}

const freePlanFeatures: PlanFeature[] = [
  {text: '5 transformations per day', included: true},
  {text: 'Basic filters & effects', included: true},
  {text: 'Standard quality output', included: true},
  {text: 'Watermark on images', included: true},
  {text: 'Unlimited transformations', included: false},
  {text: 'Premium filters & effects', included: false},
  {text: 'HD quality output', included: false},
  {text: 'No watermarks', included: false},
  {text: 'Priority processing', included: false},
  {text: 'Early access to features', included: false},
];

const proPlanFeatures: PlanFeature[] = [
  {text: 'Unlimited transformations', included: true},
  {text: 'All premium filters & effects', included: true},
  {text: 'Ultra HD quality output', included: true},
  {text: 'No watermarks', included: true},
  {text: 'Priority processing', included: true},
  {text: 'Early access to new features', included: true},
  {text: 'Exclusive Pro-only effects', included: true},
  {text: 'Priority customer support', included: true},
];

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$4.99',
    period: '/month',
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '$29.99',
    period: '/year',
    pricePerMonth: '$2.50/mo',
    savings: 'Save 50%',
    popular: true,
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '$79.99',
    period: 'one-time',
    savings: 'Best Value',
  },
];

const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlan] = useState<'free' | 'pro'>('free'); // TODO: Get from user state

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    // TODO: Implement actual in-app purchase
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
        'Coming Soon',
        'In-app purchases will be available soon. Thank you for your interest in MagiShot Pro!',
      );
    }, 1500);
  };

  const handleRestorePurchases = () => {
    Alert.alert(
      'Restore Purchases',
      'Looking for previous purchases...',
      [{text: 'OK'}],
    );
    // TODO: Implement restore purchases
  };

  const renderPlanCard = (plan: SubscriptionPlan) => {
    const isSelected = selectedPlan === plan.id;

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={() => setSelectedPlan(plan.id)}
        activeOpacity={0.7}>
        {plan.popular && (
          <View style={[styles.popularBadge, {backgroundColor: colors.primary}]}>
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
        )}
        {plan.savings && !plan.popular && (
          <View style={[styles.savingsBadge, {backgroundColor: '#10B981'}]}>
            <Text style={styles.savingsBadgeText}>{plan.savings}</Text>
          </View>
        )}
        <View style={styles.planCardContent}>
          <View style={styles.planCardLeft}>
            <View
              style={[
                styles.radioOuter,
                {borderColor: isSelected ? colors.primary : colors.textTertiary},
              ]}>
              {isSelected && (
                <View style={[styles.radioInner, {backgroundColor: colors.primary}]} />
              )}
            </View>
            <View>
              <Text style={[styles.planName, {color: colors.textPrimary}]}>
                {plan.name}
              </Text>
              {plan.pricePerMonth && (
                <Text style={[styles.planSubtext, {color: colors.textSecondary}]}>
                  {plan.pricePerMonth}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.planCardRight}>
            <Text style={[styles.planPrice, {color: colors.textPrimary}]}>
              {plan.price}
            </Text>
            <Text style={[styles.planPeriod, {color: colors.textSecondary}]}>
              {plan.period}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.backgroundSecondary}]}>
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={handleBack}
          activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
          Subscription
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        {/* Pro Badge */}
        <View style={styles.proBadgeContainer}>
          <LinearGradient
            colors={['#FF1B6D', '#FF758C']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.proBadge}>
            <Ionicons name="diamond" size={24} color="#fff" />
            <Text style={styles.proBadgeText}>MagiShot PRO</Text>
          </LinearGradient>
          <Text style={[styles.proTagline, {color: colors.textSecondary}]}>
            Unlock the full potential of your creativity
          </Text>
        </View>

        {/* Current Plan */}
        {currentPlan === 'free' && (
          <View style={[styles.currentPlanBanner, {backgroundColor: colors.cardBackground}]}>
            <View style={styles.currentPlanLeft}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.currentPlanText, {color: colors.textSecondary}]}>
                Current Plan:
              </Text>
              <Text style={[styles.currentPlanName, {color: colors.textPrimary}]}>
                Free
              </Text>
            </View>
          </View>
        )}

        {/* Features Comparison */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
            PRO FEATURES
          </Text>
          <View style={[styles.featuresCard, {backgroundColor: colors.cardBackground}]}>
            {proPlanFeatures.map((feature, index) => (
              <View
                key={index}
                style={[
                  styles.featureRow,
                  index !== proPlanFeatures.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  },
                ]}>
                <View style={[styles.featureIcon, {backgroundColor: colors.primary + '20'}]}>
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, {color: colors.textPrimary}]}>
                  {feature.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Subscription Plans */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
            CHOOSE YOUR PLAN
          </Text>
          <View style={styles.plansContainer}>
            {subscriptionPlans.map(plan => renderPlanCard(plan))}
          </View>
        </View>

        {/* Subscribe Button */}
        <TouchableOpacity
          style={[styles.subscribeButton, isLoading && styles.subscribeButtonDisabled]}
          onPress={handleSubscribe}
          disabled={isLoading}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['#FF1B6D', '#FF758C']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.subscribeButtonGradient}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="rocket" size={20} color="#fff" />
                <Text style={styles.subscribeButtonText}>
                  Subscribe Now
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Restore Purchases */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchases}
          activeOpacity={0.7}>
          <Text style={[styles.restoreButtonText, {color: colors.primary}]}>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={[styles.termsText, {color: colors.textTertiary}]}>
          Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period.
          Payment will be charged to your Apple ID or Google Play account. You can manage or cancel your subscription in your account settings.
        </Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  proBadgeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 10,
    marginBottom: 12,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  proTagline: {
    fontSize: 14,
    textAlign: 'center',
  },
  currentPlanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  currentPlanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentPlanText: {
    fontSize: 14,
  },
  currentPlanName: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  featuresCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    flex: 1,
  },
  plansContainer: {
    gap: 12,
  },
  planCard: {
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  savingsBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
  },
  savingsBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  planCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
  },
  planSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  planCardRight: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
  },
  planPeriod: {
    fontSize: 12,
  },
  subscribeButton: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  restoreButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  termsText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  bottomPadding: {
    height: 40,
  },
});

export default SubscriptionScreen;
