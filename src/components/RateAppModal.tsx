import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';

interface RateAppModalProps {
  visible: boolean;
  onClose: () => void;
}

const RateAppModal: React.FC<RateAppModalProps> = ({visible, onClose}) => {
  const {colors} = useTheme();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleStarPress = (star: number) => {
    setRating(star);
  };

  const handleSubmit = () => {
    if (rating >= 4) {
      // Good rating - redirect to app store
      openAppStore();
    }
    setSubmitted(true);
  };

  const openAppStore = () => {
    // Replace with your actual app store IDs
    const iosAppId = 'your-ios-app-id';
    const androidPackage = 'com.everhome.app';

    if (Platform.OS === 'ios') {
      Linking.openURL(`https://apps.apple.com/app/id${iosAppId}?action=write-review`);
    } else {
      Linking.openURL(`https://play.google.com/store/apps/details?id=${androidPackage}`);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setRating(0);
    setFeedback('');
    setSubmitted(false);
    onClose();
  };

  const getRatingText = () => {
    switch (rating) {
      case 1:
        return 'We\'re sorry to hear that';
      case 2:
        return 'We\'ll try to do better';
      case 3:
        return 'Thanks for the feedback!';
      case 4:
        return 'We\'re glad you like it!';
      case 5:
        return 'Awesome! You\'re the best!';
      default:
        return 'Tap a star to rate';
    }
  };

  const getRatingEmoji = () => {
    switch (rating) {
      case 1:
        return '😢';
      case 2:
        return '😕';
      case 3:
        return '😊';
      case 4:
        return '😄';
      case 5:
        return '🤩';
      default:
        return '⭐';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <View style={[styles.container, {backgroundColor: colors.backgroundSecondary}]}>
          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
            onPress={handleClose}
            activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          {!submitted ? (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.emoji}>{getRatingEmoji()}</Text>
                <Text style={[styles.title, {color: colors.textPrimary}]}>
                  Enjoying MagiShot?
                </Text>
                <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
                  {getRatingText()}
                </Text>
              </View>

              {/* Star Rating */}
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleStarPress(star)}
                    activeOpacity={0.7}
                    style={styles.starButton}>
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={40}
                      color={star <= rating ? '#FFD700' : colors.textTertiary}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Feedback Input (for low ratings) */}
              {rating > 0 && rating < 4 && (
                <View style={styles.feedbackContainer}>
                  <Text style={[styles.feedbackLabel, {color: colors.textSecondary}]}>
                    How can we improve?
                  </Text>
                  <TextInput
                    style={[
                      styles.feedbackInput,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="Tell us what we can do better..."
                    placeholderTextColor={colors.textTertiary}
                    value={feedback}
                    onChangeText={setFeedback}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Buttons */}
              <View style={styles.buttonsContainer}>
                {rating > 0 && (
                  <TouchableOpacity
                    style={[styles.submitButton, {backgroundColor: colors.primary}]}
                    onPress={handleSubmit}
                    activeOpacity={0.8}>
                    <Text style={styles.submitButtonText}>
                      {rating >= 4 ? 'Rate on Store' : 'Submit Feedback'}
                    </Text>
                    {rating >= 4 && (
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.laterButton, {borderColor: colors.border}]}
                  onPress={handleClose}
                  activeOpacity={0.7}>
                  <Text style={[styles.laterButtonText, {color: colors.textSecondary}]}>
                    Maybe Later
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Thank You State */}
              <View style={styles.thankYouContainer}>
                <View style={[styles.thankYouIcon, {backgroundColor: colors.primary + '20'}]}>
                  <Ionicons name="heart" size={48} color={colors.primary} />
                </View>
                <Text style={[styles.thankYouTitle, {color: colors.textPrimary}]}>
                  Thank You!
                </Text>
                <Text style={[styles.thankYouMessage, {color: colors.textSecondary}]}>
                  {rating >= 4
                    ? 'Your support means everything to us!'
                    : 'We appreciate your feedback and will work hard to improve.'}
                </Text>
                <TouchableOpacity
                  style={[styles.doneButton, {backgroundColor: colors.primary}]}
                  onPress={handleClose}
                  activeOpacity={0.8}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  starButton: {
    padding: 4,
  },
  feedbackContainer: {
    width: '100%',
    marginBottom: 20,
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  laterButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  thankYouContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  thankYouIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  thankYouTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
  },
  thankYouMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RateAppModal;
