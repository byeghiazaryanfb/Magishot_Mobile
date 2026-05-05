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
import LinearGradient from 'react-native-linear-gradient';
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

  // Stack buttons vertically when there are more than 2
  const stackVertically = buttons.length > 2;

  useEffect(() => {
    if (visible && autoDismissMs && onClose) {
      timerRef.current = setTimeout(onClose, autoDismissMs);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [visible, autoDismissMs, onClose]);

  const handleBackdropPress = () => {
    if (onClose) onClose();
  };

  const renderButton = (button: DialogButton, index: number) => {
    const isCancelStyle = button.style === 'cancel';
    const isDestructive = button.style === 'destructive';
    const isDefault = !isCancelStyle && !isDestructive;
    const sizeStyle = stackVertically ? styles.buttonFull : styles.buttonFlex;

    if (isDefault) {
      return (
        <LinearGradient
          key={index}
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={[styles.button, sizeStyle]}>
          <TouchableOpacity
            style={styles.buttonInner}
            onPress={button.onPress}
            activeOpacity={0.85}>
            <Text style={styles.buttonTextLight}>{button.text}</Text>
          </TouchableOpacity>
        </LinearGradient>
      );
    }

    if (isDestructive) {
      return (
        <TouchableOpacity
          key={index}
          style={[
            styles.button,
            sizeStyle,
            {backgroundColor: colors.error + '15', borderWidth: 1, borderColor: colors.error + '50'},
          ]}
          onPress={button.onPress}
          activeOpacity={0.8}>
          <Text style={[styles.buttonText, {color: colors.error}]}>
            {button.text}
          </Text>
        </TouchableOpacity>
      );
    }

    // cancel
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.button,
          sizeStyle,
          {backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border},
        ]}
        onPress={button.onPress}
        activeOpacity={0.8}>
        <Text style={[styles.buttonText, {color: colors.textSecondary}]}>
          {button.text}
        </Text>
      </TouchableOpacity>
    );
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
              <View style={[styles.iconOuter, {backgroundColor: primaryColor + '20'}]}>
                <View style={[styles.iconInner, {backgroundColor: primaryColor}]}>
                  <Ionicons name={icon as any} size={28} color="#fff" />
                </View>
              </View>

              {/* Title */}
              <Text style={[styles.title, {color: colors.textPrimary}]}>
                {title}
              </Text>

              {/* Message — split on \n so newlines render correctly */}
              <View style={styles.messageBlock}>
                {message.split('\n').map((line, i) =>
                  line.trim() === '' ? (
                    <View key={i} style={styles.messageSpacer} />
                  ) : (
                    <Text key={i} style={[styles.message, {color: colors.textSecondary}]}>
                      {line}
                    </Text>
                  ),
                )}
              </View>

              {/* Buttons */}
              <View
                style={[
                  styles.buttonContainer,
                  stackVertically
                    ? styles.buttonContainerVertical
                    : styles.buttonContainerHorizontal,
                ]}>
                {buttons.map((button, index) => renderButton(button, index))}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
  },
  iconOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  messageBlock: {
    width: '100%',
    marginBottom: 28,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageSpacer: {
    height: 10,
  },
  buttonContainer: {
    width: '100%',
  },
  buttonContainerHorizontal: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonContainerVertical: {
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonFull: {
    width: '100%',
  },
  buttonFlex: {
    flex: 1,
  },
  buttonInner: {
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 15,
    paddingHorizontal: 12,
  },
  buttonTextLight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default CustomDialog;
