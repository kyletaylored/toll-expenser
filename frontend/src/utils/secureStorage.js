/**
 * Secure Storage Utility
 *
 * Provides encrypted storage for sensitive data using Web Crypto API.
 * Encrypts data before storing in localStorage/sessionStorage.
 */

import logger from './logger';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const ENCRYPTION_PREFIX = 'ENC:'; // Prefix to identify encrypted data

/**
 * Generate a cryptographic key from a password/seed
 */
async function deriveKey(password) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('ntta-toll-tracker-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 */
async function encrypt(data, key) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    encoder.encode(JSON.stringify(data))
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  // Convert to base64 for storage, add prefix to identify as encrypted
  return ENCRYPTION_PREFIX + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 */
async function decrypt(encryptedString, key) {
  try {
    // Remove encryption prefix if present
    const dataWithoutPrefix = encryptedString.startsWith(ENCRYPTION_PREFIX)
      ? encryptedString.slice(ENCRYPTION_PREFIX.length)
      : encryptedString;

    // Convert from base64
    const combined = Uint8Array.from(atob(dataWithoutPrefix), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedData));
  } catch (error) {
    logger.error('Decryption failed:', error.message);
    return null;
  }
}

/**
 * Generate encryption key from browser fingerprint
 * Uses available browser information as seed
 */
function generateBrowserFingerprint() {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
  ];

  return components.join('|');
}

/**
 * Secure Storage Class
 */
class SecureStorage {
  constructor(storage = sessionStorage) {
    this.storage = storage;
    this.keyPromise = null;
  }

  /**
   * Initialize encryption key
   */
  async init() {
    if (!this.keyPromise) {
      const fingerprint = generateBrowserFingerprint();
      this.keyPromise = deriveKey(fingerprint);
    }
    return this.keyPromise;
  }

  /**
   * Set encrypted item
   */
  async setItem(key, value) {
    try {
      const encryptionKey = await this.init();
      const encrypted = await encrypt(value, encryptionKey);
      this.storage.setItem(key, encrypted);
      return true;
    } catch (error) {
      logger.error('SecureStorage setItem error:', error.message);
      return false;
    }
  }

  /**
   * Get and decrypt item
   * Handles migration from plain text to encrypted storage
   */
  async getItem(key) {
    try {
      const stored = this.storage.getItem(key);
      if (!stored) return null;

      // Check if data is already encrypted
      if (stored.startsWith(ENCRYPTION_PREFIX)) {
        const encryptionKey = await this.init();
        const decrypted = await decrypt(stored, encryptionKey);

        // If decryption fails, the data might be corrupted - clear it
        if (decrypted === null) {
          logger.warn(`Failed to decrypt ${key}, clearing corrupted data`);
          this.storage.removeItem(key);
          return null;
        }

        return decrypted;
      }

      // Data is plain text - migrate it to encrypted format
      logger.info(`Migrating ${key} from plain text to encrypted storage`);
      try {
        const plainData = JSON.parse(stored);

        // Re-save as encrypted
        await this.setItem(key, plainData);

        return plainData;
      } catch (parseError) {
        // If it's not valid JSON, treat as string
        const plainData = stored;
        await this.setItem(key, plainData);
        return plainData;
      }
    } catch (error) {
      logger.error('SecureStorage getItem error:', error.message);
      return null;
    }
  }

  /**
   * Remove item
   */
  removeItem(key) {
    this.storage.removeItem(key);
  }

  /**
   * Clear all items
   */
  clear() {
    this.storage.clear();
  }

  /**
   * Check if key exists
   */
  hasItem(key) {
    return this.storage.getItem(key) !== null;
  }
}

// Create singleton instances
export const secureSessionStorage = new SecureStorage(sessionStorage);
export const secureLocalStorage = new SecureStorage(localStorage);

/**
 * Helper to migrate existing plain storage to encrypted
 */
export async function migrateToSecureStorage(keys, storage, secureStorage) {
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value) {
      try {
        const parsed = JSON.parse(value);
        await secureStorage.setItem(key, parsed);
        storage.removeItem(key);
      } catch (error) {
        console.error(`Failed to migrate ${key}:`, error);
      }
    }
  }
}

/**
 * Check if Web Crypto API is available
 */
export function isSecureStorageSupported() {
  return !!(
    window.crypto &&
    window.crypto.subtle &&
    window.crypto.subtle.encrypt &&
    window.crypto.subtle.decrypt
  );
}

export default SecureStorage;
