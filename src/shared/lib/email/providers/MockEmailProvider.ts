/**
 * Mock email provider for development and testing.
 * 
 * Logs emails to console and stores them in memory.
 * Does not send actual emails.
 * Used in development/test environments.
 */

import { EmailMessage, EmailProvider, PasswordResetEmail } from '../types'

export class MockEmailProvider implements EmailProvider {
  private sentEmails: EmailMessage[] = []

  /**
   * Send email (logs to console and stores in memory).
   * @param message Email message to send
   * @returns Promise with mock message ID
   */
  async send(message: EmailMessage): Promise<{ messageId: string }> {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    console.log('[MOCK EMAIL SERVICE]')
    console.log('To:', message.to)
    console.log('Subject:', message.subject)
    console.log('HTML:', message.htmlContent.substring(0, 200) + '...')
    console.log('Message ID:', messageId)
    console.log('---')
    
    this.sentEmails.push({ ...message, sentAt: new Date() })
    return { messageId }
  }

  /**
   * Send password reset email (logs to console).
   * @param email Password reset email
   * @returns Promise with mock message ID
   */
  async sendPasswordReset(email: PasswordResetEmail): Promise<{ messageId: string }> {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    console.log('[MOCK PASSWORD RESET EMAIL]')
    console.log('To:', email.to)
    console.log('Subject:', email.subject)
    console.log('Username:', email.variables.username)
    console.log('Reset Link:', email.variables.resetLink)
    console.log('Expires At:', email.variables.expiresAt)
    console.log('Message ID:', messageId)
    console.log('---')
    
    this.sentEmails.push({ ...email, sentAt: new Date() })
    return { messageId }
  }

  /**
   * Get all sent emails (for testing).
   * @returns Array of sent email messages
   */
  getSentEmails(): EmailMessage[] {
    return [...this.sentEmails]
  }

  /**
   * Clear all sent emails (for testing).
   */
  clearSentEmails(): void {
    this.sentEmails = []
  }
}
