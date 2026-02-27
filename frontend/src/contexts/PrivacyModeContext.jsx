import { createContext, useContext, useState, useEffect } from 'react';

const PrivacyModeContext = createContext();

export const usePrivacyMode = () => {
  const context = useContext(PrivacyModeContext);
  if (!context) {
    throw new Error('usePrivacyMode must be used within PrivacyModeProvider');
  }
  return context;
};

export const PrivacyModeProvider = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    const stored = localStorage.getItem('privacyMode');
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('privacyMode', isPrivacyMode.toString());
  }, [isPrivacyMode]);

  const togglePrivacyMode = () => {
    setIsPrivacyMode((prev) => !prev);
  };

  // Helper function to mask sensitive data
  const maskData = (value, type = 'text') => {
    if (!isPrivacyMode || !value) return value;

    switch (type) {
      case 'name':
        return value.replace(/./g, '█');
      case 'email':
        const [localPart, domain] = value.split('@');
        return localPart ? `${localPart.slice(0, 2)}${'█'.repeat(localPart.length - 2)}@${domain}` : value;
      case 'phone':
        return value.replace(/\d/g, '█');
      case 'account':
        return value.toString().replace(/./g, '█');
      case 'address':
        return value.replace(/[a-zA-Z0-9]/g, '█');
      case 'vehicle':
        return value.replace(/[a-zA-Z0-9]/g, '█');
      case 'tag':
        return value.replace(/./g, '█');
      case 'money':
        // Keep the dollar sign and decimal, mask digits
        return value.replace(/\d/g, '█');
      default:
        return value.replace(/./g, '█');
    }
  };

  const value = {
    isPrivacyMode,
    togglePrivacyMode,
    maskData,
  };

  return (
    <PrivacyModeContext.Provider value={value}>
      {children}
    </PrivacyModeContext.Provider>
  );
};
