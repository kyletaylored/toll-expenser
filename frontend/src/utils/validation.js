/**
 * Input Validation and Sanitization Utilities
 *
 * Provides validation and sanitization functions for user inputs
 * to prevent XSS, injection attacks, and malformed data.
 */

/**
 * Sanitize string input by removing/escaping dangerous characters
 */
export function sanitizeString(input, maxLength = 255) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/[<>'"]/g, '') // Remove HTML/script injection chars
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize HTML by escaping special characters
 */
export function escapeHtml(input) {
  if (typeof input !== 'string') return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return input.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Validate username
 * - 3-50 characters
 * - Alphanumeric, dots, underscores, hyphens only
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 50) {
    return { valid: false, error: 'Username must be less than 50 characters' };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, dots, underscores, and hyphens',
    };
  }

  return { valid: true };
}

/**
 * Validate password
 * - 8-128 characters
 * - No specific character requirements (NTTA handles this)
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must be less than 128 characters' };
  }

  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (email.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  return { valid: true };
}

/**
 * Validate date input
 */
export function validateDate(dateString) {
  if (!dateString) {
    return { valid: false, error: 'Date is required' };
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  // Check if date is in reasonable range (not more than 10 years in past or future)
  const now = new Date();
  const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  const oneYearFuture = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  if (date < tenYearsAgo) {
    return { valid: false, error: 'Date cannot be more than 10 years in the past' };
  }

  if (date > oneYearFuture) {
    return { valid: false, error: 'Date cannot be more than 1 year in the future' };
  }

  return { valid: true, date };
}

/**
 * Validate date range
 */
export function validateDateRange(startDate, endDate) {
  const startValidation = validateDate(startDate);
  if (!startValidation.valid) {
    return { valid: false, error: `Start date: ${startValidation.error}` };
  }

  const endValidation = validateDate(endDate);
  if (!endValidation.valid) {
    return { valid: false, error: `End date: ${endValidation.error}` };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  // Check if range is not too large (max 1 year)
  const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (end - start > maxRange) {
    return { valid: false, error: 'Date range cannot exceed 1 year' };
  }

  return { valid: true };
}

/**
 * Sanitize business purpose input
 */
export function sanitizeBusinessPurpose(input) {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/[<>]/g, '') // Remove HTML chars
    .trim()
    .slice(0, 500); // Max 500 characters
}

/**
 * Validate business purpose
 */
export function validateBusinessPurpose(input) {
  if (!input) {
    return { valid: false, error: 'Business purpose is required' };
  }

  if (input.length < 3) {
    return { valid: false, error: 'Business purpose must be at least 3 characters' };
  }

  if (input.length > 500) {
    return { valid: false, error: 'Business purpose must be less than 500 characters' };
  }

  return { valid: true };
}

/**
 * Rate limiting helper
 * Returns true if action is allowed, false if rate limited
 */
const rateLimitStore = new Map();

export function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimitStore.get(key) || { attempts: 0, resetTime: now + windowMs };

  // Reset if window has passed
  if (now > record.resetTime) {
    record.attempts = 0;
    record.resetTime = now + windowMs;
  }

  // Check if rate limited
  if (record.attempts >= maxAttempts) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  // Increment attempts
  record.attempts++;
  rateLimitStore.set(key, record);

  return { allowed: true };
}

/**
 * Clear rate limit for a key
 */
export function clearRateLimit(key) {
  rateLimitStore.delete(key);
}

/**
 * Validate and sanitize all login form inputs
 */
export function validateLoginForm(username, password) {
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return usernameValidation;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return passwordValidation;
  }

  return {
    valid: true,
    sanitized: {
      username: sanitizeString(username, 50),
      password: password, // Don't sanitize password, just validate
    },
  };
}

/**
 * Detect potential SQL injection patterns
 * (Paranoid check, shouldn't be needed but adds defense in depth)
 */
export function detectSqlInjection(input) {
  if (typeof input !== 'string') return false;

  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)/i,
    /(\bselect\b.*\bfrom\b)/i,
    /(\binsert\b.*\binto\b)/i,
    /(\bdelete\b.*\bfrom\b)/i,
    /(\bdrop\b.*\btable\b)/i,
    /(\bupdate\b.*\bset\b)/i,
    /(--|;|\/\*|\*\/)/,
    /(\bor\b.*=.*)/i,
    /(\band\b.*=.*)/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Detect potential XSS patterns
 */
export function detectXss(input) {
  if (typeof input !== 'string') return false;

  const xssPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[\s\S]*?onerror[\s\S]*?>/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Comprehensive input validation for paranoid mode
 */
export function validateInput(input, type = 'text') {
  if (detectSqlInjection(input)) {
    return { valid: false, error: 'Invalid input detected (SQL)' };
  }

  if (detectXss(input)) {
    return { valid: false, error: 'Invalid input detected (XSS)' };
  }

  switch (type) {
    case 'username':
      return validateUsername(input);
    case 'password':
      return validatePassword(input);
    case 'email':
      return validateEmail(input);
    case 'date':
      return validateDate(input);
    case 'business-purpose':
      return validateBusinessPurpose(input);
    default:
      return { valid: true };
  }
}
