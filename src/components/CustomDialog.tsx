import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';

interface DialogButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'destructive' | 'cancel';
}

interface CustomDialogProps {
  visible: boolean;
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: DialogButton[];
  onClose?: () => void;
  autoDismissMs?: number;
}

const CustomDialog: React.FC<CustomDialogProps> = ({
  visible,
  icon = 'information-circle',
  iconColor,
  title,
  message,
  buttons,
  onClose,
  autoDismissMs,
}) => {
  const {colors} = useTheme();
  const primaryColor = iconColor || colors.primary;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && autoDismissMs && onClose) {
      timerRef.current = setTimeout(onClose, autoDismissMs);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [visible, autoDismissMs, onClose]);

  const handleBackdropPress = () => {
    if (onClose) {
      onClose();
    }
  };

  const getButtonStyle = (style?: 'default' | 'destructive' | 'cancel') => {
    switch (style) {
      case 'destructive':
        return {backgroundColor: colors.error};
      case 'cancel':
        return {backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.textTertiary};
      default:
        return {backgroundColor: colors.primary};
    }
  };

  const getButtonTextStyle = (style?: 'default' | 'destructive' | 'cancel') => {
    switch (style) {
      case 'cancel':
        return {color: colors.textSecondary};
      default:
        return {color: '#fff'};
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.container, {backgroundColor: colors.backgroundSecondary}]}>
              {/* Icon */}
              <View style={[styles.iconOuter, {backgroundColor: primaryColor + '30'}]}>
                <View style={[styles.iconInner, {backgroundColor: primaryColor}]}>
                  <Ionicons name={icon as any} size={28} color="#fff" />
                </View>
              </View>

              {/* Title */}
              <Text style={[styles.title, {color: colors.textPrimary}]}>
                {title}
              </Text>

              {/* Message */}
              <Text style={[styles.message, {color: colors.textSecondary}]}>
                {message}
              </Text>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      getButtonStyle(button.style),
                      buttons.length > 1 && styles.buttonMultiple,
                    ]}
                    onPress={button.onPress}
                    activeOpacity={0.8}>
                    <Text style={[styles.buttonText, getButtonTextStyle(button.style)]}>
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  iconOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMultiple: {
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomDialog;
