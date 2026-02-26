import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import ContactSupportModal from '../components/ContactSupportModal';
import CustomDialog from '../components/CustomDialog';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'photos' | 'filters' | 'sharing' | 'account' | 'general';
}

const faqData: FAQItem[] = [
  {
    id: '1',
    question: 'How do I take or select a photo?',
    answer: 'Tap the camera button to take a new photo, or tap the gallery icon to select an existing photo from your device. You can also drag and drop images into the photo area.',
    category: 'photos',
  },
  {
    id: '2',
    question: 'What photo formats are supported?',
    answer: 'We support JPEG, PNG, and HEIC formats. For best results, use high-resolution images with good lighting.',
    category: 'photos',
  },
  {
    id: '3',
    question: 'How do I apply filters and effects?',
    answer: 'Select a photo, then browse through the available filters and effects in the bottom panel. Tap on any filter to preview it, and tap the transform button to apply.',
    category: 'filters',
  },
  {
    id: '4',
    question: 'Can I adjust filter intensity?',
    answer: 'Some filters allow intensity adjustments. After selecting a filter, look for a slider control to fine-tune the effect strength.',
    category: 'filters',
  },
  {
    id: '5',
    question: 'How do I save my creations?',
    answer: 'After transforming an image, tap the Save button to download it to your device gallery. The image will be saved in full resolution.',
    category: 'sharing',
  },
  {
    id: '6',
    question: 'How do I share my photos?',
    answer: 'Tap the Share button after creating a transformation. You can share directly to social media apps, messaging apps, or copy the image to clipboard.',
    category: 'sharing',
  },
  {
    id: '7',
    question: 'Where can I find my transformation history?',
    answer: 'Go to the drawer menu and tap on "My Creations" to see all your previous transformations. You can view, share, or delete them from there.',
    category: 'sharing',
  },
  {
    id: '8',
    question: 'How do I change my profile settings?',
    answer: 'Open the drawer menu and tap on your profile or "Profile" option. From there you can edit your username, email, and other account details.',
    category: 'account',
  },
  {
    id: '9',
    question: 'How do I change the app theme?',
    answer: 'Open the drawer menu and go to Preferences. You can toggle Dark Mode or tap on "Color Theme" to choose from different color palettes.',
    category: 'account',
  },
  {
    id: '10',
    question: 'How do I upgrade to Pro?',
    answer: 'Tap on "Subscription" in the drawer menu to view our Pro plans. Pro users get access to exclusive filters, higher quality outputs, and no watermarks.',
    category: 'account',
  },
  {
    id: '11',
    question: 'Is my data safe?',
    answer: 'Yes! Your photos are processed securely and we do not store your personal images on our servers. All transformations are temporary and your privacy is our priority.',
    category: 'general',
  },
  {
    id: '12',
    question: 'How do I contact support?',
    answer: 'Scroll down to the bottom of this Help Center page and tap "Contact Support" to send us a message. We typically respond within 24 hours.',
    category: 'general',
  },
];

interface HelpTopicProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}

const HelpTopic: React.FC<HelpTopicProps> = ({icon, title, description, onPress}) => {
  const {colors} = useTheme();

  return (
    <TouchableOpacity
      style={[styles.topicCard, {backgroundColor: colors.cardBackground}]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={[styles.topicIconContainer, {backgroundColor: colors.primary + '20'}]}>
        <Ionicons name={icon as any} size={24} color={colors.primary} />
      </View>
      <Text style={[styles.topicTitle, {color: colors.textPrimary}]}>{title}</Text>
      <Text style={[styles.topicDescription, {color: colors.textSecondary}]}>{description}</Text>
    </TouchableOpacity>
  );
};

const FAQAccordion: React.FC<{item: FAQItem}> = ({item}) => {
  const {colors} = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.faqItem, {backgroundColor: colors.cardBackground}]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}>
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, {color: colors.textPrimary}]}>{item.question}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textTertiary}
        />
      </View>
      {expanded && (
        <Text style={[styles.faqAnswer, {color: colors.textSecondary}]}>{item.answer}</Text>
      )}
    </TouchableOpacity>
  );
};

type TopicCategory = 'photos' | 'filters' | 'sharing' | 'account' | null;

const HelpCenterScreen: React.FC = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TopicCategory>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContactSupport = () => {
    setShowContactModal(true);
  };

  const handleTopicPress = (topic: TopicCategory) => {
    setSelectedTopic(topic);
    setSearchQuery('');
  };

  const clearTopicFilter = () => {
    setSelectedTopic(null);
  };

  const filteredFAQ = faqData.filter(item => {
    // Filter by search query
    if (searchQuery) {
      return (
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    // Filter by selected topic
    if (selectedTopic) {
      return item.category === selectedTopic;
    }
    // Show all
    return true;
  });

  const getTopicTitle = (topic: TopicCategory): string => {
    switch (topic) {
      case 'photos':
        return 'Taking Photos';
      case 'filters':
        return 'Using Filters';
      case 'sharing':
        return 'Sharing';
      case 'account':
        return 'Account';
      default:
        return '';
    }
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
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>Help Center</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>

        {/* Search Bar */}
        <View style={[styles.searchContainer, {backgroundColor: colors.cardBackground}]}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, {color: colors.textPrimary}]}
            placeholder="Search for help..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Help Topics */}
        {!searchQuery && !selectedTopic && (
          <>
            <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>QUICK HELP</Text>
            <View style={styles.topicsGrid}>
              <HelpTopic
                icon="camera-outline"
                title="Taking Photos"
                description="Learn how to capture the best shots"
                onPress={() => handleTopicPress('photos')}
              />
              <HelpTopic
                icon="color-wand-outline"
                title="Using Filters"
                description="Apply stunning effects to your photos"
                onPress={() => handleTopicPress('filters')}
              />
              <HelpTopic
                icon="share-social-outline"
                title="Sharing"
                description="Share your creations everywhere"
                onPress={() => handleTopicPress('sharing')}
              />
              <HelpTopic
                icon="person-outline"
                title="Account"
                description="Manage your profile settings"
                onPress={() => handleTopicPress('account')}
              />
            </View>
          </>
        )}

        {/* Selected Topic Header */}
        {selectedTopic && !searchQuery && (
          <View style={styles.topicFilterHeader}>
            <View style={styles.topicFilterLeft}>
              <Text style={[styles.sectionTitle, {color: colors.textSecondary, marginBottom: 0}]}>
                {getTopicTitle(selectedTopic).toUpperCase()}
              </Text>
              <Text style={[styles.topicFilterCount, {color: colors.textTertiary}]}>
                {filteredFAQ.length} article{filteredFAQ.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.clearFilterButton, {backgroundColor: colors.primary + '20'}]}
              onPress={clearTopicFilter}
              activeOpacity={0.7}>
              <Ionicons name="close" size={16} color={colors.primary} />
              <Text style={[styles.clearFilterText, {color: colors.primary}]}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FAQ Section */}
        {!selectedTopic && (
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
            {searchQuery ? 'SEARCH RESULTS' : 'FREQUENTLY ASKED QUESTIONS'}
          </Text>
        )}
        <View style={styles.faqContainer}>
          {filteredFAQ.length > 0 ? (
            filteredFAQ.map(item => <FAQAccordion key={item.id} item={item} />)
          ) : (
            <View style={styles.noResultsContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.noResultsText, {color: colors.textSecondary}]}>
                No results found for "{searchQuery}"
              </Text>
            </View>
          )}
        </View>

        {/* Contact Support */}
        <View style={styles.contactSection}>
          <Text style={[styles.contactTitle, {color: colors.textPrimary}]}>
            Still need help?
          </Text>
          <Text style={[styles.contactDescription, {color: colors.textSecondary}]}>
            Our support team is here to assist you
          </Text>
          <TouchableOpacity
            style={[styles.contactButton, {backgroundColor: colors.primary}]}
            onPress={handleContactSupport}
            activeOpacity={0.8}>
            <Ionicons name="mail-outline" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Contact Support Modal */}
      <ContactSupportModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        onSuccess={() => setShowSuccessDialog(true)}
        onError={(msg) => {
          setErrorMessage(msg);
          setShowErrorDialog(true);
        }}
      />
      <CustomDialog
        visible={showSuccessDialog}
        icon="checkmark-circle"
        title="Message Sent!"
        message="Thank you for contacting us. We'll get back to you as soon as possible."
        buttons={[
          {text: 'Done', onPress: () => setShowSuccessDialog(false), style: 'default'},
        ]}
        onClose={() => setShowSuccessDialog(false)}
      />
      <CustomDialog
        visible={showErrorDialog}
        icon="alert-circle"
        iconColor="#FF4757"
        title="Error"
        message={errorMessage}
        buttons={[
          {text: 'OK', onPress: () => setShowErrorDialog(false), style: 'default'},
        ]}
        onClose={() => setShowErrorDialog(false)}
      />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  topicFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  topicFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicFilterCount: {
    fontSize: 12,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  topicCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
  },
  topicIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  topicDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  faqContainer: {
    gap: 8,
    marginBottom: 24,
  },
  faqItem: {
    padding: 16,
    borderRadius: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  contactSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  contactDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});

export default HelpCenterScreen;
