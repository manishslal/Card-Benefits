/**
 * Form and Modal Components
 */

'use client';

import React, { ReactNode } from 'react';

/**
 * FormGroup - Label + input + error wrapper
 */
interface FormGroupProps {
  label: string;
  error?: string;
  required?: boolean;
  help?: string;
  children: ReactNode;
}

export function FormGroup({ label, error, required, help, children }: FormGroupProps) {
  const id = React.useId();

  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      {children}
      {error && <div className="form-error">{error}</div>}
      {help && <div className="form-hint">{help}</div>}
    </div>
  );
}

/**
 * FormInput - Text/email/number/URL input
 */
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  help?: string;
  required?: boolean;
}

export function FormInput({
  label,
  error,
  help,
  required,
  ...props
}: FormInputProps) {
  const id = React.useId();

  if (label) {
    return (
      <FormGroup label={label} error={error} help={help} required={required}>
        <input id={id} {...props} />
      </FormGroup>
    );
  }

  return (
    <>
      <input {...props} />
      {error && <div className="form-error">{error}</div>}
    </>
  );
}

/**
 * FormSelect - Dropdown with options
 */
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  help?: string;
  required?: boolean;
  options: Array<{ label: string; value: string }>;
}

export function FormSelect({
  label,
  error,
  help,
  required,
  options,
  ...props
}: FormSelectProps) {
  const id = React.useId();

  if (label) {
    return (
      <FormGroup label={label} error={error} help={help} required={required}>
        <select id={id} {...props}>
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormGroup>
    );
  }

  return (
    <>
      <select {...props}>
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <div className="form-error">{error}</div>}
    </>
  );
}

/**
 * FormToggle - Checkbox/switch
 */
interface FormToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export function FormToggle({ label, description, ...props }: FormToggleProps) {
  const id = React.useId();

  return (
    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
      <input id={id} type="checkbox" {...props} />
      <div>
        <label htmlFor={id} style={{ margin: 0 }}>
          {label}
        </label>
        {description && (
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Form - Wrapper with submission handling
 */
interface FormProps {
  onSubmit: (formData: FormData) => Promise<void> | void;
  children: ReactNode;
  error?: string;
  actions?: ReactNode;
}

export function Form({
  onSubmit,
  children,
  error,
  actions,
}: FormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      await onSubmit(formData);
    } catch (err) {
      console.error('Form submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ opacity: isSubmitting ? 0.6 : 1 }}>
      {error && (
        <div
          style={{
            padding: 'var(--space-md)',
            marginBottom: 'var(--space-lg)',
            backgroundColor: 'var(--color-error-light)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {children}

      {actions && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-md)',
            justifyContent: 'flex-end',
            marginTop: 'var(--space-xl)',
          }}
        >
          {actions}
        </div>
      )}
    </form>
  );
}

/**
 * Modal - Dialog component
 */
interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  actions?: ReactNode;
}

export function Modal({
  isOpen,
  title,
  children,
  onClose,
  size = 'md',
  actions,
}: ModalProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: '400px',
    md: '600px',
    lg: '800px',
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="modal-content"
        style={{
          width: sizes[size],
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-lg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2 id="modal-title" style={{ margin: 0, fontSize: 'var(--text-h4)' }}>
            {title}
          </h2>
          <button
            className="btn btn-icon"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-lg)', maxHeight: 'calc(90vh - 200px)', overflow: 'auto' }}>
          {children}
        </div>

        {/* Footer */}
        {actions && (
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-md)',
              justifyContent: 'flex-end',
              padding: 'var(--space-lg)',
              borderTop: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ConfirmDialog - Confirmation modal
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onCancel} disabled={isProcessing}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            disabled={isProcessing || loading}
          >
            {isProcessing ? '...' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
