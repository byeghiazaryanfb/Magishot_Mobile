import React from 'react';
import {useTheme} from '../theme/ThemeContext';
import CustomDialog from './CustomDialog';

interface AiConsentDialogProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const AiConsentDialog: React.FC<AiConsentDialogProps> = ({visible, onAccept, onDecline}) => {
  const {colors} = useTheme();

  return (
    <CustomDialog
      visible={visible}
      icon="cloud-upload-outline"
      iconColor={colors.primary}
      title="AI Processing Notice"
      message={
        'To generate your image or video, your photo will be securely uploaded to our servers for AI processing. ' +
        "Don't worry — you can delete them completely any time from your gallery.\n\n" +
        'Do you agree to proceed?'
      }
      buttons={[
        {text: 'Cancel', onPress: onDecline, style: 'cancel'},
        {text: 'I Agree', onPress: onAccept, style: 'default'},
      ]}
      onClose={onDecline}
    />
  );
};

export default AiConsentDialog;
