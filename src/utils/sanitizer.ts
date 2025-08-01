import DOMPurify from 'dompurify';

export const sanitizeTaskText = (text: string): string => {
  // First trim and normalize whitespace
  const trimmed = text.trim().replace(/\s+/g, ' ');
  
  // Then sanitize to prevent XSS
  // Allow only text content, no HTML tags or attributes
  const sanitized = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false
  });
  
  return sanitized;
};

export const sanitizeForDisplay = (text: string): string => {
  // For display, we might want to allow some basic formatting
  // but for now, we'll keep it strict
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false
  });
};