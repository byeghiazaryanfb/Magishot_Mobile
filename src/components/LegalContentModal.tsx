import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {config} from '../utils/config';

type LegalType = 'terms' | 'privacy';

interface LegalContentModalProps {
  visible: boolean;
  type: LegalType;
  onClose: () => void;
}

const ENDPOINTS: Record<
  LegalType,
  {title: string; endpoint: string; fallbackUrl: string}
> = {
  terms: {
    title: 'Terms & Conditions',
    endpoint: 'terms_and_conditions',
    fallbackUrl: config.termsUrl,
  },
  privacy: {
    title: 'Privacy Policy',
    endpoint: 'privacy_policy',
    fallbackUrl: config.privacyUrl,
  },
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
          <Text style={styles.mdBody}>{renderInlineStyles(trimmed.slice(2))}</Text>
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

const LegalContentModal: React.FC<LegalContentModalProps> = ({visible, type, onClose}) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const {title, endpoint, fallbackUrl} = ENDPOINTS[type];

  const openInBrowser = () => {
    Linking.openURL(fallbackUrl).catch(() => {});
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setIsLoading(true);
    setContent('');
    setHasError(false);
    fetch(`${config.apiBaseUrl}/api/SystemSettings/${endpoint}`)
      .then(res => res.json())
      .then(json => {
        if (cancelled) return;
        const value = json.value || json.content || '';
        if (!value) {
          setHasError(true);
        } else {
          setContent(value);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasError(true);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, endpoint]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#FF1B6D" />
            </View>
          ) : hasError ? (
            <View style={styles.errorBlock}>
              <Ionicons name="cloud-offline-outline" size={36} color="rgba(255,255,255,0.5)" />
              <Text style={styles.errorTitle}>Couldn't load {title}</Text>
              <Text style={styles.errorBody}>
                Open the latest version in your browser to continue.
              </Text>
              <TouchableOpacity
                style={styles.errorButton}
                onPress={openInBrowser}
                activeOpacity={0.8}>
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={styles.errorButtonText}>Open in Browser</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
              {renderMarkdown(content)}
            </ScrollView>
          )}

          {!hasError && !isLoading && (
            <TouchableOpacity
              style={styles.browserLink}
              onPress={openInBrowser}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Ionicons
                name="open-outline"
                size={14}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.browserLinkText}>Open in browser</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
  button: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#FF1B6D',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  browserLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  browserLinkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  errorBlock: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  errorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  errorBody: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#FF1B6D',
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LegalContentModal;
