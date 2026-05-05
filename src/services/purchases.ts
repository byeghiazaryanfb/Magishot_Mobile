import {Platform} from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';

export const ENTITLEMENT_ID = 'MagiShot Pro';
export const OFFERING_DEFAULT = 'default';

const IOS_API_KEY = 'appl_JxgiIbXgzjgVedhVHeUSTmTGQTD';
const ANDROID_API_KEY = '';

let configured = false;

export const configurePurchases = (): void => {
  if (configured) return;
  const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
  if (!apiKey) {
    console.warn('[Purchases] Missing API key for platform', Platform.OS);
    return;
  }
  Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({apiKey});
  configured = true;
};

export const loginPurchasesUser = async (
  appUserId: string,
): Promise<CustomerInfo | null> => {
  try {
    const {customerInfo} = await Purchases.logIn(appUserId);
    return customerInfo;
  } catch (err) {
    console.warn('[Purchases] logIn failed', err);
    return null;
  }
};

export const logoutPurchasesUser = async (): Promise<void> => {
  try {
    await Purchases.logOut();
  } catch (err) {
    console.warn('[Purchases] logOut failed', err);
  }
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.warn('[Purchases] getCustomerInfo failed', err);
    return null;
  }
};

/**
 * Forces RevenueCat to drop its local CustomerInfo cache and re-fetch from
 * the server. Useful right after a tier upgrade (PRODUCT_CHANGE) where the
 * cache can briefly retain the old productIdentifier.
 */
export const refreshCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    await Purchases.invalidateCustomerInfoCache();
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.warn('[Purchases] refreshCustomerInfo failed', err);
    return null;
  }
};

export const getCurrentOffering = async (): Promise<PurchasesOffering | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? offerings.all[OFFERING_DEFAULT] ?? null;
  } catch (err) {
    console.warn('[Purchases] getOfferings failed', err);
    return null;
  }
};

export const purchasePackage = async (
  pkg: PurchasesPackage,
): Promise<{customerInfo: CustomerInfo; productIdentifier: string} | null> => {
  const {customerInfo, productIdentifier} = await Purchases.purchasePackage(pkg);
  return {customerInfo, productIdentifier};
};

export const restorePurchases = async (): Promise<CustomerInfo | null> => {
  try {
    return await Purchases.restorePurchases();
  } catch (err) {
    console.warn('[Purchases] restorePurchases failed', err);
    throw err;
  }
};

export const isProActive = (info: CustomerInfo | null): boolean => {
  if (!info) return false;
  return !!info.entitlements.active[ENTITLEMENT_ID];
};

export const addCustomerInfoListener = (
  callback: (info: CustomerInfo) => void,
): (() => void) => {
  Purchases.addCustomerInfoUpdateListener(callback);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(callback);
  };
};
