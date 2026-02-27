/**
 * Transaction Cache Utility
 *
 * Caches transactions by their unique CustomerTripId to avoid redundant API calls.
 * Transactions older than a few days are cached for up to 7 days, while recent
 * transactions (last 3 days) have a shorter cache duration (1 hour) since they
 * may still be updated.
 *
 * Now uses encrypted storage for sensitive financial data.
 */

import { secureLocalStorage } from './secureStorage';
import logger from './logger';

const CACHE_KEY = 'ntta_transaction_cache';
const RECENT_TRANSACTION_THRESHOLD_DAYS = 3;
const RECENT_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour for recent transactions
const OLD_CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for older transactions

/**
 * Get the cache from encrypted localStorage
 */
async function getCache() {
  try {
    const cached = await secureLocalStorage.getItem(CACHE_KEY);
    if (!cached) return { transactions: {}, metadata: {} };
    return cached;
  } catch (error) {
    logger.error('Error reading transaction cache:', error.message);
    return { transactions: {}, metadata: {} };
  }
}

/**
 * Save the cache to encrypted localStorage
 */
async function saveCache(cache) {
  try {
    await secureLocalStorage.setItem(CACHE_KEY, cache);
  } catch (error) {
    logger.error('Error saving transaction cache:', error.message);
  }
}

/**
 * Determine if a transaction is "recent" (within the last 3 days)
 */
function isRecentTransaction(transaction) {
  try {
    const tripDate = new Date(transaction.TripDate);
    const now = new Date();
    const daysAgo = (now - tripDate) / (1000 * 60 * 60 * 24);
    return daysAgo < RECENT_TRANSACTION_THRESHOLD_DAYS;
  } catch (error) {
    // If we can't parse the date, treat as recent to be safe
    return true;
  }
}

/**
 * Get the appropriate cache duration for a transaction
 */
function getCacheDuration(transaction) {
  return isRecentTransaction(transaction)
    ? RECENT_CACHE_DURATION_MS
    : OLD_CACHE_DURATION_MS;
}

/**
 * Add transactions to the cache
 */
export async function cacheTransactions(transactions) {
  try {
    if (!Array.isArray(transactions)) {
      logger.warn('cacheTransactions: transactions is not an array');
      return;
    }

    const cache = await getCache();
    const now = Date.now();

    transactions.forEach(transaction => {
      const id = transaction.CustomerTripId;
      if (!id) return;

      const cacheDuration = getCacheDuration(transaction);

      cache.transactions[id] = transaction;
      cache.metadata[id] = {
        cachedAt: now,
        expiresAt: now + cacheDuration,
        isRecent: isRecentTransaction(transaction),
      };
    });

    await saveCache(cache);
  } catch (error) {
    logger.error('Error caching transactions:', error.message);
  }
}

/**
 * Get cached transactions for a date range
 * Returns cached transactions array
 */
export async function getCachedTransactions(startDate, endDate) {
  try {
    const cache = await getCache();
    const now = Date.now();
    const cached = [];

    // Clean up expired entries while we're at it
    let hasExpired = false;

    // Create date objects for comparison (without mutating originals)
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    Object.keys(cache.transactions).forEach(id => {
      const metadata = cache.metadata[id];

      // Remove expired entries
      if (metadata && metadata.expiresAt < now) {
        delete cache.transactions[id];
        delete cache.metadata[id];
        hasExpired = true;
        return;
      }

      const transaction = cache.transactions[id];
      if (!transaction) return;

      // Check if transaction falls within the requested date range
      try {
        const tripDate = new Date(transaction.TripDate);

        if (tripDate >= start && tripDate <= end) {
          cached.push(transaction);
        }
      } catch (error) {
        logger.error('Error checking transaction date:', error);
      }
    });

    // Save cache if we removed expired entries
    if (hasExpired) {
      await saveCache(cache);
    }

    return cached;
  } catch (error) {
    logger.error('Error getting cached transactions:', error);
    return [];
  }
}

/**
 * Check if we need to fetch transactions for a given date range
 * Returns true if we should fetch, false if cache is sufficient
 */
export async function shouldFetchTransactions(startDate, endDate) {
  const cached = await getCachedTransactions(startDate, endDate);

  // If we have no cached transactions, we need to fetch
  if (cached.length === 0) return true;

  // Check if any transactions in the range are recent and might need updating
  const hasRecentTransactions = cached.some(t => isRecentTransaction(t));

  // If there are recent transactions, we should fetch to get updates
  // Otherwise, we can rely on the cache
  return hasRecentTransactions;
}

/**
 * Merge cached transactions with newly fetched transactions
 * Prioritizes fresh data over cached data for the same transaction ID
 */
export function mergeWithCache(freshTransactions, cachedTransactions) {
  try {
    const merged = new Map();

    // Add cached transactions first
    if (Array.isArray(cachedTransactions)) {
      cachedTransactions.forEach(t => {
        if (t && t.CustomerTripId) {
          merged.set(t.CustomerTripId, t);
        }
      });
    }

    // Override with fresh transactions (they're more up-to-date)
    if (Array.isArray(freshTransactions)) {
      freshTransactions.forEach(t => {
        if (t && t.CustomerTripId) {
          merged.set(t.CustomerTripId, t);
        }
      });
    }

    return Array.from(merged.values());
  } catch (error) {
    logger.error('Error merging transactions:', error);
    // Return fresh transactions as fallback
    return Array.isArray(freshTransactions) ? freshTransactions : [];
  }
}

/**
 * Clear all cached transactions (useful for logout or manual refresh)
 */
export async function clearTransactionCache() {
  try {
    await secureLocalStorage.removeItem(CACHE_KEY);
  } catch (error) {
    logger.error('Error clearing transaction cache:', error);
  }
}

/**
 * Get cache statistics (for debugging/UI display)
 */
export async function getCacheStats() {
  const cache = await getCache();
  const now = Date.now();

  const stats = {
    total: Object.keys(cache.transactions).length,
    recent: 0,
    old: 0,
    expired: 0,
  };

  Object.keys(cache.transactions).forEach(id => {
    const metadata = cache.metadata[id];
    const transaction = cache.transactions[id];

    if (metadata && metadata.expiresAt < now) {
      stats.expired++;
    } else if (transaction && isRecentTransaction(transaction)) {
      stats.recent++;
    } else {
      stats.old++;
    }
  });

  return stats;
}
