import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import config from '../utils/config';

interface SocialSignInTermsModalProps {
  visible: boolean;
  providerLabel: string;
  isLoading?: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

type LegalKind = 'terms' | 'privacy';

const SocialSignInTermsModal: React.FC<SocialSignInTermsModalProps> = ({
  visible,
  providerLabel,
  isLoading = false,
  onAccept,
  onCancel,
}) => {
  const [accepted, setAccepted] = useState(false);
  const [legalModal, setLegalModal] = useState<{
    visible: boolean;
    title: string;
    content: string;
    isLoading: boolean;
  }>({visible: false, title: '', content: '', isLoading: false});

  const openLegalContent = async (type: LegalKind) => {
    const title = type === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';
    const endpoint =
      type === 'terms' ? 'terms_and_conditions' : 'privacy_policy';
    setLegalModal({visible: true, title, content: '', isLoading: true});
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/SystemSettings/${endpoint}`,
      );
      const json = await response.json();
      const markdown = json.value || json.content || '';
      setLegalModal(prev => ({...prev, content: markdown, isLoading: false}));
    } catch {
      setLegalModal(prev => ({
        ...prev,
        content: 'Failed to load content. Please try again.',
        isLoading: false,
      }));
    }
  };

  const closeLegalContent = () =>
    setLegalModal(prev => ({...prev, visible: false}));

  const handleCancel = () => {
    if (isLoading) return;
    setAccepted(false);
    onCancel();
  };

  const handleAccept = () => {
    if (!accepted || isLoading) return;
    onAccept();
  };

  const renderInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={i} style={styles.mdBold}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return part;
    });
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <View key={index} style={{height: 10}} />;

      if (trimmed.startsWith('### ')) {
        return (
          <Text key={index} style={styles.mdH3}>
            {trimmed.replace(/^### /, '').replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <Text key={index} style={styles.mdH2}>
            {trimmed.replace(/^## /, '').replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('# ')) {
        return (
          <Text key={index} style={styles.mdH1}>
            {trimmed.replace(/^# /, '').replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (/^[-*_]{3,}$/.test(trimmed)) {
        return <View key={index} style={styles.mdHr} />;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <View key={index} style={styles.mdBulletRow}>
            <Text style={styles.mdBulletDot}>{'•'}</Text>
            <Text style={styles.mdBody}>
              {renderInlineStyles(trimmed.slice(2))}
            </Text>
          </View>
        );
      }
      return (
        <Text key={index} style={styles.mdBody}>
          {renderInlineStyles(trimmed)}
        </Text>
      );
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={legalModal.visible ? closeLegalContent : handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Almost there!</Text>
          <Text style={styles.subtitle}>
            To finish creating your account with {providerLabel}, please review
            and accept our terms.
          </Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAccepted(prev => !prev)}
            activeOpacity={0.7}>
            <Ionicons
              name={accepted ? 'checkbox' : 'square-outline'}
              size={22}
              color={accepted ? '#FF1B6D' : 'rgba(255,255,255,0.5)'}
            />
            <Text style={styles.checkboxText}>
              I agree to the{' '}
              <Text
                style={styles.link}
                onPress={() => openLegalContent('terms')}>
                Terms & Conditions
              </Text>
              {' '}and{' '}
              <Text
                style={styles.link}
                onPress={() => openLegalContent('privacy')}>
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          <LinearGradient
            colors={
              accepted
                ? ['#FF1B6D', '#FF758C']
                : ['rgba(255,27,109,0.4)', 'rgba(255,117,140,0.4)']
            }
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.acceptGradient}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              disabled={!accepted || isLoading}
              activeOpacity={0.9}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.acceptText}>Continue</Text>
              )}
            </TouchableOpacity>
          </LinearGradient>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isLoading}
            activeOpacity={0.7}>
            <Text
              style={[styles.cancelText, isLoading && styles.cancelDisabled]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        {legalModal.visible && (
          <View style={styles.legalOverlay}>
            <View style={styles.legalContainer}>
              <View style={styles.legalHeader}>
                <Text style={styles.legalTitle}>{legalModal.title}</Text>
                <TouchableOpacity
                  onPress={closeLegalContent}
                  style={styles.legalClose}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              {legalModal.isLoading ? (
                <View style={styles.legalLoading}>
                  <ActivityIndicator size="large" color="#FF1B6D" />
                </View>
              ) : (
                <ScrollView
                  style={styles.legalScroll}
                  showsVerticalScrollIndicator>
                  {renderMarkdown(legalModal.content)}
                </ScrollView>
              )}
              <TouchableOpacity
                style={styles.legalButton}
                onPress={closeLegalContent}
                activeOpacity={0.8}>
                <Text style={styles.legalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF1B6D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.7)',
  },
  link: {
    color: '#FF1B6D',
    fontWeight: '600',
  },
  acceptGradient: {
    alignSelf: 'stretch',
    borderRadius: 12,
    marginBottom: 8,
  },
  acceptButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  legalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  legalContainer: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  legalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  legalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  legalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalLoading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  legalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  legalButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#FF1B6D',
  },
  legalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mdH1: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  mdH2: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  mdH3: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 6,
    marginTop: 12,
  },
  mdBody: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  mdBold: {
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  mdBulletRow: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 4,
  },
  mdBulletDot: {
    fontSize: 14,
    color: '#FF1B6D',
    marginRight: 8,
    marginTop: 1,
  },
  mdHr: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
});

export default SocialSignInTermsModal;
