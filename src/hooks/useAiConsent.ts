import {useState, useCallback, useRef} from 'react';
import {useAppSelector} from '../store/hooks';
import {AiConsentStorage} from '../utils/storage';

/**
 * Hook that gates AI generation behind a one-time consent dialog.
 *
 * Usage:
 *   const { requireConsent, consentDialog } = useAiConsent();
 *
 *   const handleGenerate = async () => {
 *     const allowed = await requireConsent();
 *     if (!allowed) return;
 *     // ... proceed with generation
 *   };
 *
 *   // Render consentDialog in JSX (it manages its own visibility)
 *   return <>{consentDialog}</>
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
