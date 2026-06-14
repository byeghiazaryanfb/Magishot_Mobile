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
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PACKAGE_TYPE, type PurchasesPackage} from 'react-native-purchases';
import {useTheme} from '../theme/ThemeContext';
import LegalContentModal from '../components/LegalContentModal';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {setCustomerInfo} from '../store/slices/subscriptionSlice';
import {useIsPro} from '../hooks/useSubscription';
import {
  getCurrentOffering,
  getLastOfferingDiagnostic,
  purchasePackage,
  restorePurchases,
  refreshCustomerInfo,
  isProActive,
  ENTITLEMENT_ID,
} from '../services/purchases';

const MANAGE_SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions';

const {height} = Dimensions.get('window');

interface PaywallScreenProps {
  visible?: boolean;
  onClose: () => void;
  /**
   * Called when a purchase or trial is completed.
   * @param productIdentifier  The RevenueCat product ID (e.g. the Apple product ID)
   * @param isTrial            True when the user is fresh AND chose a free-trial plan.
   * @param coinsToGrant       Coin amount the backend should credit for this purchase
   *                           (20 for a fresh-user free trial, otherwise the plan's
   *                           full bonusCoins).
   */
  onPurchase?: (
    productIdentifier: string,
    isTrial: boolean,
    coinsToGrant: number,
  ) => void;
}

interface PricingPlan {
  id: 'weekly' | 'monthly' | 'yearly';
  title: string;
  price: string;
  billingPeriod: string;
  /** Optional effective per-unit rate, e.g. "≈ $3.75/mo" on a yearly plan. */
  pricePerUnit?: string;
  /** Coins granted when the paid period is active (not during trial). */
  bonusCoins: number;
  /** Coins granted at the start of the free-trial period. */
  trialBonusCoins?: number;
  trialText?: string;
  isPopular?: boolean;
}

const FEATURES = [
  'Unlimited AI photo transformations',
  'Virtual Try-On & outfit swap',
  'Animated videos & AI comics',
  'Pro editor with AI effects',
  'Restore & enhance old photos',
];

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'weekly',
    title: 'Pro Weekly',
    price: '$6.99',
    billingPeriod: 'per week',
    bonusCoins: 700,
    trialBonusCoins: 20,   // 20 coins during the free-trial, 700 once paid kicks in
    trialText: '7-day free trial',
  },
  {
    id: 'monthly',
    title: 'Pro Monthly',
    price: '$24.99',
    billingPeriod: 'per month',
    bonusCoins: 2500,
  },
  {
    id: 'yearly',
    title: 'Pro Yearly',
    price: '$44.99',
    billingPeriod: 'per year',
    pricePerUnit: '≈ $3.75/mo',
    bonusCoins: 5000,
    isPopular: true,
  },
];

const planToPackageType: Record<PricingPlan['id'], PACKAGE_TYPE> = {
  weekly: PACKAGE_TYPE.WEEKLY,
  monthly: PACKAGE_TYPE.MONTHLY,
  yearly: PACKAGE_TYPE.ANNUAL,
};

const PaywallScreen: React.FC<PaywallScreenProps> = ({onClose, onPurchase}) => {
  const {colors} = useTheme();
  const dispatch = useAppDispatch();
  const isPro = useIsPro();
  const customerInfo = useAppSelector(state => state.subscription.customerInfo);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan['id']>('weekly');
  const [legalModal, setLegalModal] = useState<{visible: boolean; type: 'terms' | 'privacy'}>({
    visible: false,
    type: 'terms',
  });
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);
  const [offeringDiag, setOfferingDiag] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const offering = await getCurrentOffering();
      if (cancelled) return;
      const pkgs = offering?.availablePackages ?? [];
      setPackages(pkgs);
      setOfferingsLoaded(true);
      const diag = `${getLastOfferingDiagnostic()}${
        pkgs.length
          ? ` types=[${pkgs
              .map(p => `${p.packageType}:${p.product.identifier}`)
              .join(', ')}]`
          : ''
      }`;
      setOfferingDiag(diag);
      console.log('[Paywall] Offering loaded —', diag);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Determine which plan ID the user is currently subscribed to, by matching
   * the active entitlement's productIdentifier against the loaded packages.
   * Returns null if the user is not subscribed or packages haven't loaded yet.
   */
  const getCurrentPlanId = (): PricingPlan['id'] | null => {
    const activeProductId =
      customerInfo?.entitlements.active[ENTITLEMENT_ID]?.productIdentifier;
    if (!activeProductId || packages.length === 0) return null;
    const matchedPkg = packages.find(
      p => p.product.identifier === activeProductId,
    );
    if (!matchedPkg) return null;
    const entry = Object.entries(planToPackageType).find(
      ([, type]) => type === matchedPkg.packageType,
    );
    return (entry?.[0] as PricingPlan['id']) ?? null;
  };

  const currentPlanId = getCurrentPlanId();
  // After cancellation Apple keeps the entitlement active until the period
  // ends; willRenew=false is the signal that the user has cancelled.
  const isCanceled =
    isPro &&
    customerInfo?.entitlements.active[ENTITLEMENT_ID]?.willRenew === false;

  const findPackage = (planId: PricingPlan['id']): PurchasesPackage | null => {
    const wanted = planToPackageType[planId];
    return packages.find(p => p.packageType === wanted) ?? null;
  };

  const handleManageSubscription = async () => {
    try {
      await Linking.openURL(MANAGE_SUBSCRIPTION_URL);
    } catch {
      Alert.alert(
        'Manage Subscription',
        'Open the App Store → tap your profile → Subscriptions to manage your plan.',
      );
    }
  };

  const handlePurchase = async () => {
    if (purchasing) return;

    // If already on this exact plan and it's still renewing, nothing to do.
    if (isPro && currentPlanId === selectedPlan && !isCanceled) return;

    // If the user already had this plan but cancelled it, Apple does not let
    // us un-cancel programmatically — send them to App Store Subscriptions.
    if (isPro && currentPlanId === selectedPlan && isCanceled) {
      handleManageSubscription();
      return;
    }

    const pkg = findPackage(selectedPlan);
    if (!pkg) {
      console.warn(
        '[Paywall] No matching package for plan',
        selectedPlan,
        'packages:',
        packages.map(p => ({id: p.identifier, type: p.packageType})),
      );
      // NOTE: diagnostic text is shown in all builds temporarily so we can
      // read the real offering state from TestFlight/production. Revert to the
      // generic user-facing message once the production paywall is confirmed.
      Alert.alert(
        'Plan unavailable',
        `No package for "${selectedPlan}".\n\n${offeringDiag}`,
      );
      return;
    }

    setPurchasing(true);
    try {
      console.log(
        '[Paywall] Starting purchase for',
        pkg.identifier,
        pkg.product.identifier,
      );
      const result = await purchasePackage(pkg);
      if (result) {
        // Trial-bonus rule: a brand-new user who never had a prior
        // subscription AND chose a package that offers a free trial gets the
        // 20-coin trial bonus. Everyone else gets the plan's full coin
        // amount. We OR-merge with periodType so we still flag a trial when
        // RevenueCat does report it explicitly.
        const entitlement =
          result.customerInfo.entitlements.active[ENTITLEMENT_ID];
        const priorPurchases =
          result.customerInfo.allPurchasedProductIdentifiers || [];
        const isFirstSubscriptionPurchase = priorPurchases.filter(
          id => id !== result.productIdentifier,
        ).length === 0;
        const packageOffersFreeTrial =
          (pkg.product.introPrice?.price ?? -1) === 0;
        const isTrial =
          entitlement?.periodType === 'trial' ||
          (isFirstSubscriptionPurchase && packageOffersFreeTrial);

        const selectedPricingPlan = PRICING_PLANS.find(p => p.id === selectedPlan);
        const fullPlanCoins = selectedPricingPlan?.bonusCoins ?? 0;
        const trialCoins = selectedPricingPlan?.trialBonusCoins ?? 20;
        const coinsToGrant = isTrial ? trialCoins : fullPlanCoins;

        console.log('[Paywall] Purchase succeeded — coin grant decision:', {
          productIdentifier: result.productIdentifier,
          isPro: isProActive(result.customerInfo),
          isTrial,
          coinsToGrant,
          isFirstSubscriptionPurchase,
          packageOffersFreeTrial,
          introPrice: pkg.product.introPrice,
          periodType: entitlement?.periodType,
          priorPurchases,
        });
        dispatch(setCustomerInfo(result.customerInfo));
        // For tier upgrades (PRODUCT_CHANGE), the customerInfo returned by
        // purchasePackage can still carry the previous productIdentifier
        // until RC syncs. Force a fresh fetch so the drawer's plan label and
        // any other UI that reads productIdentifier flips to the new tier
        // immediately.
        refreshCustomerInfo().then(fresh => {
          if (fresh) dispatch(setCustomerInfo(fresh));
        });
        if (isProActive(result.customerInfo)) {
          onPurchase?.(result.productIdentifier, isTrial, coinsToGrant);
          onClose();
        } else {
          Alert.alert(
            'Purchase processed',
            'Your purchase went through, but Pro access is not active yet. Please try Restore or contact support.',
          );
        }
      }
    } catch (err: any) {
      console.warn(
        '[Paywall] Purchase error:',
        err?.code,
        err?.message,
        err?.userCancelled,
      );
      if (!err?.userCancelled) {
        Alert.alert(
          'Purchase failed',
          err?.message || 'Something went wrong. Please try again.',
        );
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (info) {
        dispatch(setCustomerInfo(info));
        if (isProActive(info)) {
          Alert.alert('Purchases restored', 'Your subscription has been restored.');
          onClose();
        } else {
          Alert.alert(
            'No purchases found',
            'We could not find an active subscription to restore.',
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message || 'Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  /**
   * CTA label:
   *  - Pro, selected = current, not cancelled → "Current Plan" (disabled)
   *  - Pro, selected = current, cancelled     → "Reactivate in App Store"
   *  - Pro, selected ≠ current                → "Switch to [Plan]"
   *  - New user, weekly selected              → "Start Free Trial"
   *  - New user, other plan selected          → "Continue"
   */
  const ctaText = (() => {
    if (isPro) {
      if (currentPlanId === selectedPlan) {
        return isCanceled ? 'Reactivate in App Store' : 'Current Plan';
      }
      const planTitle =
        PRICING_PLANS.find(p => p.id === selectedPlan)?.title ?? selectedPlan;
      return `Switch to ${planTitle}`;
    }
    return selectedPlan === 'weekly' ? 'Start Free Trial' : 'Continue';
  })();

  const ctaDisabled =
    purchasing ||
    !offeringsLoaded ||
    (isPro && currentPlanId === selectedPlan && !isCanceled);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
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

          <TouchableOpacity
            style={[styles.closeButton, {backgroundColor: 'rgba(0,0,0,0.5)'}]}
            onPress={onClose}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

        </View>

        <View style={styles.featuresContainer}>
          {FEATURES.map(feature => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={[styles.featureText, {color: colors.textSecondary}]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />

        {/* Plan cards — shown for all users; active plan gets an ACTIVE badge */}
        <View style={styles.pricingContainer}>
          {PRICING_PLANS.map(plan => {
            const isSelected = selectedPlan === plan.id;
            const isCurrentPlan = plan.id === currentPlanId;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.pricingCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPlan(plan.id)}
                activeOpacity={0.8}>
                <View style={styles.cardLeft}>
                  <View
                    style={[
                      styles.radioOuter,
                      {borderColor: isSelected ? colors.primary : colors.border},
                    ]}>
                    {isSelected && (
                      <View style={[styles.radioInner, {backgroundColor: colors.primary}]} />
                    )}
                  </View>
                  <View style={styles.cardTextColumn}>
                    <Text style={[styles.planTitle, {color: colors.textPrimary}]}>
                      {plan.trialText ? plan.trialText : plan.title}
                    </Text>
                    <View style={styles.coinRow}>
                      <Ionicons name="logo-bitcoin" size={14} color={colors.primary} />
                      <Text style={[styles.coinText, {color: colors.textSecondary}]}>
                        {plan.trialBonusCoins
                          ? `${plan.trialBonusCoins} coins now · ${plan.bonusCoins.toLocaleString()} after trial`
                          : `${plan.bonusCoins.toLocaleString()} bonus coins`}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <Text style={[styles.planPrice, {color: colors.textPrimary}]}>
                    {plan.trialText ? 'Free' : plan.price}
                  </Text>
                  <Text style={[styles.planBilling, {color: colors.textTertiary}]}>
                    {plan.trialText
                      ? `then ${plan.price} / week`
                      : plan.billingPeriod}
                  </Text>
                  {plan.pricePerUnit && (
                    <Text style={[styles.planPerUnit, {color: colors.textTertiary}]}>
                      {plan.pricePerUnit}
                    </Text>
                  )}
                </View>

                {plan.trialText && !isCurrentPlan && (
                  <View style={[styles.popularBadge, {backgroundColor: colors.primary}]}>
                    <Text style={styles.popularText}>{plan.title.toUpperCase()}</Text>
                  </View>
                )}
                {plan.isPopular && !plan.trialText && !isCurrentPlan && (
                  <View style={[styles.popularBadge, {backgroundColor: colors.primary}]}>
                    <Text style={styles.popularText}>BEST VALUE</Text>
                  </View>
                )}
                {isCurrentPlan && (
                  <View
                    style={[
                      styles.activeBadge,
                      {
                        backgroundColor: isCanceled
                          ? colors.warning + '22'
                          : colors.primary + '22',
                        borderColor: isCanceled ? colors.warning : colors.primary,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.activeBadgeText,
                        {color: isCanceled ? colors.warning : colors.primary},
                      ]}>
                      {isCanceled ? 'CANCELED' : 'ACTIVE'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={[styles.ctaGradient, ctaDisabled && styles.ctaDisabled]}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handlePurchase}
            disabled={ctaDisabled}
            activeOpacity={0.9}>
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>{ctaText}</Text>
            )}
          </TouchableOpacity>
        </LinearGradient>

        {isPro ? (
          <TouchableOpacity
            onPress={handleManageSubscription}
            style={styles.secondaryAction}>
            <Text style={[styles.secondaryActionText, {color: colors.textSecondary}]}>
              Manage Subscription
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.disclosureText, {color: colors.textTertiary}]}>
            Auto-renewing subscription. Payment is charged to your Apple ID at
            purchase confirmation. Your subscription renews automatically at
            the same price unless you turn off auto-renew at least 24 hours
            before the end of the current period. Manage or cancel anytime in
            Settings → Apple ID → Subscriptions.
          </Text>
        )}

        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => setLegalModal({visible: true, type: 'terms'})}>
            <Text style={[styles.footerLink, {color: colors.textSecondary}]}>Terms of use</Text>
          </TouchableOpacity>
          <View style={[styles.footerDivider, {backgroundColor: colors.border}]} />
          <TouchableOpacity onPress={() => setLegalModal({visible: true, type: 'privacy'})}>
            <Text style={[styles.footerLink, {color: colors.textSecondary}]}>Privacy policy</Text>
          </TouchableOpacity>
          <View style={[styles.footerDivider, {backgroundColor: colors.border}]} />
          <TouchableOpacity onPress={handleRestore} disabled={restoring}>
            <Text style={[styles.footerLink, {color: colors.textSecondary}]}>
              {restoring ? 'Restoring…' : 'Restore'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LegalContentModal
        visible={legalModal.visible}
        type={legalModal.type}
        onClose={() => setLegalModal(prev => ({...prev, visible: false}))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scrollView: {flex: 1},
  scrollContent: {flexGrow: 1, paddingBottom: 20},
  spacer: {flex: 1, minHeight: 16},
  heroSection: {height: height * 0.45, position: 'relative'},
  heroImage: {width: '100%', height: '100%', top:0},
  heroGradient: {...StyleSheet.absoluteFillObject},
  closeButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {color: '#fff', fontSize: 24, fontWeight: '300'},
  featuresContainer: {
    paddingHorizontal: 24,
    marginTop: -150,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  pricingContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 10,
  },
  pricingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    position: 'relative',
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  cardTextColumn: {
    flex: 1,
    marginLeft: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  planTitle: {fontSize: 16, fontWeight: '700'},
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  coinText: {fontSize: 12, fontWeight: '500'},
  planPrice: {fontSize: 22, fontWeight: '800'},
  planBilling: {fontSize: 11, marginTop: 2},
  planPerUnit: {fontSize: 10, marginTop: 2, fontWeight: '500'},
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5},
  activeBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeBadgeText: {fontSize: 10, fontWeight: '700', letterSpacing: 0.5},
  ctaGradient: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ctaText: {color: '#fff', fontSize: 18, fontWeight: '700'},
  disclosureText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    marginHorizontal: 20,
    lineHeight: 16,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 12,
  },
  footerLink: {fontSize: 13, fontWeight: '500'},
  footerDivider: {width: 1, height: 14},
});

export default PaywallScreen;
