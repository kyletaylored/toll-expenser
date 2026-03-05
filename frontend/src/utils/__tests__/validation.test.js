import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizeString,
  escapeHtml,
  validateUsername,
  validatePassword,
  validateEmail,
  validateDateRange,
  validateLoginForm,
  checkRateLimit,
  clearRateLimit,
  detectXss,
  detectSqlInjection,
  sanitizeBusinessPurpose,
  validateBusinessPurpose,
} from '../validation';

describe('sanitizeString', () => {
  it('removes HTML injection characters', () => {
    expect(sanitizeString('<script>alert(1)</script>')).not.toContain('<');
    expect(sanitizeString('<script>alert(1)</script>')).not.toContain('>');
  });

  it('removes javascript: protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).not.toContain('javascript:');
  });

  it('removes event handler attributes', () => {
    expect(sanitizeString('onclick=alert(1)')).not.toMatch(/on\w+=/i);
  });

  it('truncates to maxLength', () => {
    expect(sanitizeString('hello world', 5)).toBe('hello');
  });

  it('uses default maxLength of 255', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeString(long)).toHaveLength(255);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString(42)).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });
});

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml('<b>Hello & "World"</b>')).toBe('&lt;b&gt;Hello &amp; &quot;World&quot;&lt;/b&gt;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's a test")).toBe('it&#039;s a test');
  });

  it('returns empty string for non-string input', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42)).toBe('');
  });

  it('passes through clean text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('user123')).toMatchObject({ valid: true });
    expect(validateUsername('user.name')).toMatchObject({ valid: true });
    expect(validateUsername('user-name')).toMatchObject({ valid: true });
    expect(validateUsername('user_name')).toMatchObject({ valid: true });
    expect(validateUsername('abc')).toMatchObject({ valid: true }); // min length
  });

  it('rejects empty or missing input', () => {
    expect(validateUsername('')).toMatchObject({ valid: false });
    expect(validateUsername(null)).toMatchObject({ valid: false });
    expect(validateUsername(undefined)).toMatchObject({ valid: false });
  });

  it('rejects usernames shorter than 3 characters', () => {
    expect(validateUsername('ab')).toMatchObject({ valid: false });
    expect(validateUsername('a')).toMatchObject({ valid: false });
  });

  it('rejects usernames longer than 50 characters', () => {
    expect(validateUsername('a'.repeat(51))).toMatchObject({ valid: false });
  });

  it('accepts usernames exactly at length boundaries', () => {
    expect(validateUsername('abc')).toMatchObject({ valid: true });       // min
    expect(validateUsername('a'.repeat(50))).toMatchObject({ valid: true }); // max
  });

  it('rejects special characters', () => {
    expect(validateUsername('user@name')).toMatchObject({ valid: false });
    expect(validateUsername('user name')).toMatchObject({ valid: false });
    expect(validateUsername('user!')).toMatchObject({ valid: false });
  });
});

describe('validatePassword', () => {
  it('accepts valid passwords', () => {
    expect(validatePassword('password123')).toMatchObject({ valid: true });
    expect(validatePassword('a'.repeat(128))).toMatchObject({ valid: true });
    expect(validatePassword('12345678')).toMatchObject({ valid: true }); // min length
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('short')).toMatchObject({ valid: false });
    expect(validatePassword('1234567')).toMatchObject({ valid: false });
  });

  it('rejects passwords longer than 128 characters', () => {
    expect(validatePassword('a'.repeat(129))).toMatchObject({ valid: false });
  });

  it('rejects empty or missing input', () => {
    expect(validatePassword('')).toMatchObject({ valid: false });
    expect(validatePassword(null)).toMatchObject({ valid: false });
  });
});

describe('validateEmail', () => {
  it('accepts valid email addresses', () => {
    expect(validateEmail('user@example.com')).toMatchObject({ valid: true });
    expect(validateEmail('user+tag@sub.domain.org')).toMatchObject({ valid: true });
    expect(validateEmail('a@b.co')).toMatchObject({ valid: true });
  });

  it('rejects malformed email addresses', () => {
    expect(validateEmail('not-an-email')).toMatchObject({ valid: false });
    expect(validateEmail('@domain.com')).toMatchObject({ valid: false });
    expect(validateEmail('user@')).toMatchObject({ valid: false });
    expect(validateEmail('user @domain.com')).toMatchObject({ valid: false });
  });

  it('rejects empty or missing input', () => {
    expect(validateEmail('')).toMatchObject({ valid: false });
    expect(validateEmail(null)).toMatchObject({ valid: false });
  });
});

describe('validateDateRange', () => {
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  const past = (days) => fmt(new Date(today.getTime() - days * 86400000));
  const future = (days) => fmt(new Date(today.getTime() + days * 86400000));

  it('accepts a valid date range', () => {
    expect(validateDateRange(past(30), past(1))).toMatchObject({ valid: true });
  });

  it('rejects when start is after end', () => {
    expect(validateDateRange(past(1), past(30))).toMatchObject({ valid: false });
  });

  it('rejects ranges exceeding 1 year', () => {
    expect(validateDateRange(past(366), fmt(today))).toMatchObject({ valid: false });
  });

  it('rejects invalid date strings', () => {
    expect(validateDateRange('not-a-date', past(1))).toMatchObject({ valid: false });
    expect(validateDateRange(past(30), 'not-a-date')).toMatchObject({ valid: false });
  });
});

describe('validateLoginForm', () => {
  it('returns valid with sanitized credentials', () => {
    const result = validateLoginForm('user123', 'password123');
    expect(result.valid).toBe(true);
    expect(result.sanitized.username).toBe('user123');
    expect(result.sanitized.password).toBe('password123');
  });

  it('fails fast on invalid username', () => {
    expect(validateLoginForm('ab', 'password123')).toMatchObject({ valid: false });
  });

  it('fails on invalid password', () => {
    expect(validateLoginForm('user123', 'short')).toMatchObject({ valid: false });
  });

  it('sanitizes username but not password', () => {
    const result = validateLoginForm('user_123', 'p@ssw0rd!!');
    expect(result.valid).toBe(true);
    expect(result.sanitized.password).toBe('p@ssw0rd!!'); // password passed through
  });
});

describe('checkRateLimit / clearRateLimit', () => {
  const KEY = 'test-rate-limit';

  beforeEach(() => clearRateLimit(KEY));

  it('allows requests under the limit', () => {
    expect(checkRateLimit(KEY, 3, 60000).allowed).toBe(true);
    expect(checkRateLimit(KEY, 3, 60000).allowed).toBe(true);
    expect(checkRateLimit(KEY, 3, 60000).allowed).toBe(true);
  });

  it('blocks after reaching maxAttempts', () => {
    checkRateLimit(KEY, 3, 60000);
    checkRateLimit(KEY, 3, 60000);
    checkRateLimit(KEY, 3, 60000);
    const blocked = checkRateLimit(KEY, 3, 60000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('clears the rate limit', () => {
    checkRateLimit(KEY, 1, 60000);
    checkRateLimit(KEY, 1, 60000); // now blocked
    clearRateLimit(KEY);
    expect(checkRateLimit(KEY, 1, 60000).allowed).toBe(true);
  });
});

describe('detectXss', () => {
  it('detects script tags', () => {
    expect(detectXss('<script>alert(1)</script>')).toBe(true);
    expect(detectXss('<SCRIPT SRC="evil.js"></SCRIPT>')).toBe(true);
  });

  it('detects inline event handlers', () => {
    expect(detectXss('onclick=alert(1)')).toBe(true);
    expect(detectXss('onerror = "evil()"')).toBe(true);
  });

  it('detects javascript: protocol', () => {
    expect(detectXss('javascript:void(0)')).toBe(true);
  });

  it('detects iframe tags', () => {
    expect(detectXss('<iframe src="evil.com">')).toBe(true);
  });

  it('allows clean input', () => {
    expect(detectXss('Hello, world!')).toBe(false);
    expect(detectXss('user_name-123')).toBe(false);
    expect(detectXss('Client meeting on Monday')).toBe(false);
  });
});

describe('detectSqlInjection', () => {
  it('detects UNION SELECT', () => {
    expect(detectSqlInjection('UNION SELECT * FROM users')).toBe(true);
    expect(detectSqlInjection("' union select password from users--")).toBe(true);
  });

  it('detects DROP TABLE', () => {
    expect(detectSqlInjection('DROP TABLE users')).toBe(true);
  });

  it('detects comment sequences', () => {
    expect(detectSqlInjection("admin'--")).toBe(true);
    expect(detectSqlInjection('value; DROP TABLE')).toBe(true);
  });

  it('allows clean input', () => {
    expect(detectSqlInjection('user123')).toBe(false);
    expect(detectSqlInjection('John Smith')).toBe(false);
    expect(detectSqlInjection('Client meeting at 3pm')).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(detectSqlInjection(null)).toBe(false);
    expect(detectSqlInjection(42)).toBe(false);
  });
});

describe('sanitizeBusinessPurpose', () => {
  it('removes HTML angle brackets', () => {
    expect(sanitizeBusinessPurpose('<b>meeting</b>')).not.toContain('<');
  });

  it('trims and truncates to 500 chars', () => {
    expect(sanitizeBusinessPurpose('  hello  ')).toBe('hello');
    expect(sanitizeBusinessPurpose('a'.repeat(600))).toHaveLength(500);
  });

  it('returns empty string for missing input', () => {
    expect(sanitizeBusinessPurpose('')).toBe('');
    expect(sanitizeBusinessPurpose(null)).toBe('');
  });
});

describe('validateBusinessPurpose', () => {
  it('accepts valid business purposes', () => {
    expect(validateBusinessPurpose('Client meeting')).toMatchObject({ valid: true });
    expect(validateBusinessPurpose('abc')).toMatchObject({ valid: true }); // min length
  });

  it('rejects missing or too-short input', () => {
    expect(validateBusinessPurpose('')).toMatchObject({ valid: false });
    expect(validateBusinessPurpose(null)).toMatchObject({ valid: false });
    expect(validateBusinessPurpose('ab')).toMatchObject({ valid: false });
  });

  it('rejects input over 500 characters', () => {
    expect(validateBusinessPurpose('a'.repeat(501))).toMatchObject({ valid: false });
  });
});
