import {useState, useCallback, useRef} from 'react';
import {useAppSelector} from '../store/hooks';
import {AiConsentStorage} from '../utils/storage';

/**
 * Hook that gates AI generation behind a one-time consent dialog.
 * Once the user accepts, the choice is persisted per-account and the dialog
 * is never shown again on subsequent generations.
 *
 * Usage:
 *   const {requireConsent, consentVisible, onConsentAccept, onConsentDecline} = useAiConsent();
 *
 *   const handleGenerate = async () => {
 *     if (!(await requireConsent())) return;
 *     // ... proceed with generation
 *   };
 */
export function useAiConsent() {
  const email = useAppSelector(state => state.auth.email);
  const [visible, setVisible] = useState(false);
  const resolveRef = useRef<((allowed: boolean) => void) | null>(null);

  const requireConsent = useCallback(async (): Promise<boolean> => {
    const consented = await AiConsentStorage.hasConsented(email || undefined);
    if (consented) return true;

    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
      setVisible(true);
    });
  }, [email]);

  const onAccept = useCallback(async () => {
    await AiConsentStorage.setConsented(email || undefined);
    setVisible(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, [email]);

  const onDecline = useCallback(() => {
    setVisible(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return {requireConsent, consentVisible: visible, onConsentAccept: onAccept, onConsentDecline: onDecline};
}
