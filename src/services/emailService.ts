/**
 * Email service for sending emails via API
 */

import api from './api';
import config from '../utils/config';

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
}

interface SendEmailResponse {
  success: boolean;
  message?: string;
}

class EmailService {
  /**
   * Send an email
   */
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    accessToken?: string,
  ): Promise<SendEmailResponse> {
    const data: SendEmailRequest = {
      to,
      subject,
      body,
    };
    return api.post<SendEmailResponse>('/api/email/send', data, accessToken);
  }

  /**
   * Send a support request email
   */
  async sendSupportEmail(
    userEmail: string,
    userName: string,
    subject: string,
    message: string,
    accessToken?: string,
  ): Promise<SendEmailResponse> {
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF1B6D;">Support Request</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>From:</strong> ${userName} (${userEmail})</p>
          <p><strong>Subject:</strong> ${subject}</p>
        </div>
        <div style="padding: 20px 0;">
          <h3>Message:</h3>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #888; font-size: 12px;">This email was sent from the MagiShot mobile app.</p>
      </div>
    `;

    return this.sendEmail(
      config.supportEmail,
      `[Support] ${subject}`,
      htmlBody,
      accessToken,
    );
  }
}

export default new EmailService();
