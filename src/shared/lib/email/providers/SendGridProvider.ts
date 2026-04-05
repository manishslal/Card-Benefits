/**
 * SendGrid email provider (stub for Wave 2).
 * 
 * Placeholder for SendGrid integration.
 * To be implemented in Wave 2.
 */

import { EmailMessage, EmailProvider, PasswordResetEmail } from '../types'

export class SendGridProvider implements EmailProvider {
  async send(_message: EmailMessage): Promise<{ messageId: string }> {
    throw new Error('SendGrid provider not implemented in Wave 1. Set EMAIL_PROVIDER=mock in .env')
  }

  async sendPasswordReset(_email: PasswordResetEmail): Promise<{ messageId: string }> {
    throw new Error('SendGrid provider not implemented in Wave 1. Set EMAIL_PROVIDER=mock in .env')
  }
}
