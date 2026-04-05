/**
 * Email service types and interfaces.
 * 
 * Defines the contract for email providers and message structures.
 * Supports multiple provider implementations (Mock, SendGrid, Mailgun).
 */

export interface EmailMessage {
  to: string
  subject: string
  htmlContent: string
  textContent: string
  fromAddress?: string
  templateId?: string
  variables?: Record<string, string>
  sentAt?: Date
}

export interface PasswordResetEmail extends EmailMessage {
  variables: {
    resetLink: string
    expiresAt: string
    username: string
  }
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ messageId: string }>
  sendPasswordReset(email: PasswordResetEmail): Promise<{ messageId: string }>
}

export interface SendEmailResult {
  messageId: string
  sent: boolean
  timestamp: Date
}
