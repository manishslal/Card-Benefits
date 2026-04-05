/**
 * Email provider factory.
 * 
 * Creates appropriate email provider instance based on environment configuration.
 * Supports: mock, sendgrid, mailgun.
 */

import { EmailProvider } from './types'
import { MockEmailProvider } from './providers/MockEmailProvider'
import { SendGridProvider } from './providers/SendGridProvider'
import { MailgunProvider } from './providers/MailgunProvider'

export class EmailProviderFactory {
  /**
   * Create email provider based on EMAIL_PROVIDER environment variable.
   * Defaults to MockEmailProvider if not specified.
   */
  static createProvider(): EmailProvider {
    const provider = process.env.EMAIL_PROVIDER || 'mock'

    switch (provider.toLowerCase()) {
      case 'sendgrid':
        return new SendGridProvider()
      case 'mailgun':
        return new MailgunProvider()
      case 'mock':
      default:
        return new MockEmailProvider()
    }
  }
}

/**
 * Global email provider instance (singleton pattern).
 * Created on first import/use.
 */
export const emailProvider = EmailProviderFactory.createProvider()
