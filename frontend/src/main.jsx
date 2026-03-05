import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import './index.css'
import App from './App.jsx'
import { Toaster } from './components/ui/toaster'
import { PrivacyModeProvider } from './contexts/PrivacyModeContext'
import { datadogRum } from '@datadog/browser-rum';
import { reactPlugin, ErrorBoundary } from '@datadog/browser-rum-react';

datadogRum.init({
    applicationId: import.meta.env.VITE_DD_RUM_APPLICATION_ID || '',
    clientToken: import.meta.env.VITE_DD_RUM_CLIENT_TOKEN || '',
    site: import.meta.env.VITE_DD_SITE || '',
    service: import.meta.env.VITE_DD_SERVICE || '',
    env: import.meta.env.VITE_DD_ENV || '',
    version: import.meta.env.VITE_DD_VERSION || '',
    sessionSampleRate: import.meta.env.VITE_DD_SESSION_SAMPLE_RATE ? parseInt(import.meta.env.VITE_DD_SESSION_SAMPLE_RATE) : 100,
    sessionReplaySampleRate: import.meta.env.VITE_DD_SESSION_REPLAY_SAMPLE_RATE ? parseInt(import.meta.env.VITE_DD_SESSION_REPLAY_SAMPLE_RATE) : 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    plugins: [reactPlugin({ router: false })],
    allowedTracingUrls: [(url) => url.startsWith(window.location.origin)],
});

// Register Service Worker for offline support and API proxying
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary fallback={ErrorFallback}>
    <StrictMode>
      <ChakraProvider value={defaultSystem}>
        <PrivacyModeProvider>
          <App />
          <Toaster />
        </PrivacyModeProvider>
      </ChakraProvider>
    </StrictMode>
  </ErrorBoundary>
)

function ErrorFallback({ resetError, error }) {
  return (
    <p>
      Oops, something went wrong! <strong>{String(error)}</strong> <button onClick={resetError}>Retry</button>
    </p>
  )
}