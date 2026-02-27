import axios from 'axios';
import { format } from 'date-fns';
import logger from './logger';

const API_BASE_URL = '/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Enable cookies for session-based auth
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'api-origin': 'CustomerPortal',
    'channelid': '2',
    'icn': '160408',
    // Note: Origin and Referer headers cannot be set from browser JavaScript
    // They are automatically set by the browser
  },
});

// Format date for NTTA API (e.g., "9/20/2025, 12:00:00 AM")
export const formatNTTADate = (date, time = '12:00:00 AM') => {
  const formatted = format(date, 'M/d/yyyy');
  return `${formatted} ${time}`;
};

// Format current date for AppCurrDate header (URL-encoded)
export const formatAppCurrDate = () => {
  const now = new Date();
  const dateStr = format(now, 'M/d/yyyy');
  const timeStr = format(now, 'h:mm:ss a');
  return encodeURIComponent(`${dateStr} ${timeStr}`);
};

// Format current date for request body (NOT URL-encoded)
export const formatAppCurrDateBody = () => {
  const now = new Date();
  const dateStr = format(now, 'M/d/yyyy');
  const timeStr = format(now, 'h:mm:ss a');
  return `${dateStr}, ${timeStr}`;
};

// Authenticate user
export const authenticate = async (username, password, rememberMe = false) => {
  try {
    const appCurrDate = formatAppCurrDate();
    const response = await apiClient.post('/authenticate', {
      UserName: username,
      Password: password,
      Grant_Type: 'password',
      RememberMe: rememberMe,
    }, {
      headers: {
        'appcurrdate': appCurrDate,
        'allowanonymous': 'true',
      },
    });

    // Log the response to understand the structure
    logger.debug('Auth response:', response);
    logger.debug('Auth response data:', response.data);
    logger.debug('Auth response headers:', response.headers);

    // Extract the Bearer token from the response
    const authData = response.data;

    // Check multiple possible locations for the token
    const accessToken = authData.access_token ||
                       authData.accessToken ||
                       authData.AccessToken ||
                       authData.token ||
                       response.headers.authorization ||
                       response.headers.Authorization;

    // Extract the customer ID from various possible fields
    const customerId = authData.CustomerId ||
                      authData.AccountId ||
                      authData.CustomerAccountId ||
                      authData.UserId;

    logger.debug('Extracted accessToken:', accessToken ? 'Found' : 'Not found');
    logger.debug('Extracted customerId:', customerId);

    // Construct FullName from FirstName and LastName if not present
    const fullName = authData.FullName ||
                    (authData.FirstName && authData.LastName
                      ? `${authData.FirstName} ${authData.LastName}`
                      : authData.UserName);

    if (accessToken) {
      return {
        ...authData,
        accessToken: accessToken.replace('Bearer ', ''), // Remove 'Bearer ' prefix if present
        AccountId: customerId, // Ensure AccountId is set
        FullName: fullName, // Ensure FullName is set
      };
    }

    logger.warn('No access token found in response');
    return {
      ...authData,
      FullName: fullName,
    };
  } catch (error) {
    logger.error('Authentication error:', error);
    throw new Error(error.response?.data?.message || 'Authentication failed');
  }
};

// Fetch account summary
export const fetchAccountSummary = async (userId, accessToken) => {
  try {
    logger.debug('Fetching account summary for userId:', userId);
    logger.debug('Using accessToken:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');

    const appCurrDate = formatAppCurrDate();
    const response = await apiClient.get(
      `/customers/${userId}/accountsummary`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'appcurrdate': appCurrDate,
          'allowanonymous': 'false',
        },
      }
    );
    logger.debug('Account summary response:', response.data);
    return response.data;
  } catch (error) {
    logger.error('Account summary error:', error.response?.data || error.message);
    logger.error('Error status:', error.response?.status);
    throw new Error(error.response?.data?.message || 'Failed to fetch account summary');
  }
};

// Verify connection is still valid
export const verifyConnection = async (userId, accessToken) => {
  try {
    await fetchAccountSummary(userId, accessToken);
    return true;
  } catch (error) {
    return false;
  }
};

// Fetch transactions with pagination
export const fetchTransactions = async (userId, accessToken, startDate, endDate) => {
  const allTransactions = [];
  let pageNumber = 1;
  let hasMorePages = true;

  const appCurrDate = formatAppCurrDate();

  while (hasMorePages) {
    try {
      logger.debug('Fetching transactions page:', pageNumber);
      logger.debug('Request body:', {
        StartDate: formatNTTADate(startDate, '12:00:00 AM'),
        EndDate: formatNTTADate(endDate, '11:59:59 PM'),
        TransactionDateType: 'true',
        AppCurrDate: formatAppCurrDateBody(),
      });

      const response = await apiClient.post(
        `/customers/${userId}/transhistory`,
        {
          Paging: {
            PageNumber: pageNumber,
            PageSize: 50,
            SortDir: 1,
            SortColumn: 'POSTEDDATE',
          },
          StartDate: formatNTTADate(startDate, '12:00:00 AM'),
          EndDate: formatNTTADate(endDate, '11:59:59 PM'),
          TrnsTypes: '',
          Transponder: '',
          Plates: '',
          customerId: userId,
          TransactionDateType: 'true',
          ExportAs: '',
          IsViolator: false,
          AppCurrDate: formatAppCurrDateBody(),
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'appcurrdate': appCurrDate,
            'allowanonymous': 'false',
          },
        }
      );

      logger.debug('Transaction response structure:', response.data);
      logger.debug('Is array:', Array.isArray(response.data));

      // The response is a plain array, not wrapped in TransactionHistory
      const transactions = Array.isArray(response.data) ? response.data : (response.data?.TransactionHistory || []);

      logger.debug('Transaction response received, count:', transactions.length);

      // Filter out violator transactions
      // Note: TollAmount is negative (represents charges), and we use absolute value
      const validTransactions = transactions.filter(
        (t) => !t.IsViolator && Math.abs(parseFloat(t.TollAmount || 0)) > 0
      );

      allTransactions.push(...validTransactions);

      // Check if there are more pages
      if (transactions.length < 50 || transactions.length === 0) {
        hasMorePages = false;
      } else {
        pageNumber++;
      }
    } catch (error) {
      logger.error('Transaction fetch error:', error.response?.data || error.message);
      logger.error('Error status:', error.response?.status);
      throw new Error(error.response?.data?.message || error.response?.data?.Detail || 'Failed to fetch transactions');
    }
  }

  return allTransactions;
};
