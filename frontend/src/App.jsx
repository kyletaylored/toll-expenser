import { useState, useEffect, useRef, useCallback } from 'react';
import { Box } from '@chakra-ui/react';
import LoginForm from './components/LoginForm';
import TransactionViewer from './components/TransactionViewer';
import { verifyConnection, fetchAccountSummary } from './utils/api';
import { toaster } from './utils/toaster';
import { secureSessionStorage } from './utils/secureStorage';

// Idle timeout configuration
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

function App() {
  const [user, setUser] = useState(null);
  const [accountSummary, setAccountSummary] = useState(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    const initializeApp = async () => {
      // Use encrypted storage to retrieve credentials
      const userId = await secureSessionStorage.getItem('userId');
      const username = await secureSessionStorage.getItem('username');
      let fullName = await secureSessionStorage.getItem('fullName');
      const accessToken = await secureSessionStorage.getItem('accessToken');

      // Fix stored "undefined" or "null" strings
      if (!fullName || fullName === 'undefined' || fullName === 'null') {
        fullName = null;
      }

      if (userId && username && accessToken) {
        const isValid = await verifyConnection(userId, accessToken);

        if (isValid) {
          try {
            const summary = await fetchAccountSummary(userId, accessToken);
            setAccountSummary(summary);

            // Construct full name from summary if needed
            const finalFullName = fullName || summary.FullName ||
                                 (summary.FirstName && summary.LastName
                                   ? `${summary.FirstName} ${summary.LastName}`
                                   : username);

            setUser({
              userId,
              username,
              fullName: finalFullName,
              accessToken,
            });
          } catch (error) {
            toaster.create({
              title: 'Session expired',
              description: 'Please log in again',
              type: 'warning',
              duration: 3000,
            });
            sessionStorage.clear();
          }
        } else {
          toaster.create({
            title: 'Session expired',
            description: 'Please log in again',
            type: 'warning',
            duration: 3000,
          });
          sessionStorage.clear();
        }
      }
      setIsVerifying(false);
    };

    initializeApp();
  }, []);

  // Idle timeout handler
  const handleIdleTimeout = useCallback(() => {
    if (user) {
      toaster.create({
        title: 'Session expired',
        description: 'Logged out due to inactivity',
        type: 'warning',
        duration: 5000,
      });
      handleLogout();
    }
  }, [user]);

  // Reset idle timer on user activity
  const resetIdleTimer = useCallback(() => {
    if (!user) return;

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(handleIdleTimeout, IDLE_TIMEOUT_MS);
  }, [user, handleIdleTimeout]);

  // Set up idle timeout detection
  useEffect(() => {
    if (!user) return;

    // Start idle timer
    resetIdleTimer();

    // Listen for user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetIdleTimer);
    });

    // Cleanup
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [user, resetIdleTimer]);

  // Session verification (every 5 minutes)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const isValid = await verifyConnection(user.userId, user.accessToken);
      if (!isValid) {
        toaster.create({
          title: 'Connection lost',
          description: 'Your session has expired. Please log in again.',
          type: 'error',
          duration: 5000,
        });
        handleLogout();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const handleLoginSuccess = async (userData) => {
    try {
      const summary = await fetchAccountSummary(userData.userId, userData.accessToken);
      setAccountSummary(summary);

      // Construct full name from summary if needed
      const finalFullName = summary.FullName ||
                           (summary.FirstName && summary.LastName
                             ? `${summary.FirstName} ${summary.LastName}`
                             : userData.username);

      setUser({
        ...userData,
        fullName: finalFullName,
      });
    } catch (error) {
      toaster.create({
        title: 'Failed to fetch account info',
        description: error.message,
        type: 'error',
        duration: 3000,
      });
      setUser(userData);
    }
  };

  const handleLogout = async () => {
    // Clear both regular and encrypted session storage
    sessionStorage.clear();
    await secureSessionStorage.clear();

    // Clear encrypted transaction cache
    const { clearTransactionCache } = await import('./utils/transactionCache');
    await clearTransactionCache();

    setUser(null);
    setAccountSummary(null);
  };

  if (isVerifying) {
    return <Box minH="100vh" bg="gray.50" />;
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {!user ? (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      ) : (
        <TransactionViewer
          user={user}
          accountSummary={accountSummary}
          onLogout={handleLogout}
        />
      )}
    </Box>
  );
}

export default App;
