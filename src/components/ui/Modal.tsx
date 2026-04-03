'use client';

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  closeButton?: boolean;
  className?: string;
}

/**
 * Modal Component - Design System Implementation
 * Includes backdrop blur, smooth animations, and focus management
 */
const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      children,
      closeButton = true,
      className = '',
    },
    ref
  ) => {
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
      return () => {
        document.body.style.overflow = 'unset';
      };
    }, [isOpen]);

    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
          onClose();
        }
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
          role="presentation"
        />

        {/* Modal */}
        <div
          ref={ref}
          className={`
            fixed inset-0 z-50 flex items-center justify-center p-4
            animate-scale-in
          `}
        >
          <div
            className={`
              bg-[var(--color-bg)] rounded-2xl shadow-xl
              max-w-lg w-full max-h-[90vh] overflow-y-auto
              relative
              ${className}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-8 border-b border-[var(--color-border)]">
                <h2 className="text-2xl font-bold text-[var(--color-text)]">
                  {title}
                </h2>
                {closeButton && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-md hover:bg-[var(--color-bg-secondary)] transition-colors"
                    aria-label="Close modal"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-8">
              {children}
            </div>
          </div>
        </div>
      </>
    );
  }
);

Modal.displayName = 'Modal';

export default Modal;
