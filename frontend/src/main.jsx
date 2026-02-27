import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import './index.css'
import App from './App.jsx'
import { Toaster } from './components/ui/toaster'
import { PrivacyModeProvider } from './contexts/PrivacyModeContext'

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
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <PrivacyModeProvider>
        <App />
        <Toaster />
      </PrivacyModeProvider>
    </ChakraProvider>
  </StrictMode>,
)
