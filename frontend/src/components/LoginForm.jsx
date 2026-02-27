import { useState } from 'react';
import { Box, Field, Input, Button, Stack, Text, Heading, Flex, Link, Checkbox, Image } from '@chakra-ui/react';
import { TriangleAlertIcon } from 'lucide-react';
import { usePrivacyMode } from '../contexts/PrivacyModeContext';
import { validateLoginForm, checkRateLimit, clearRateLimit } from '../utils/validation';
import { secureSessionStorage } from '../utils/secureStorage';

export default function LoginForm({ onLoginSuccess }) {
  const { isPrivacyMode } = usePrivacyMode();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Rate limiting check
      const rateLimit = checkRateLimit('login', 5, 60000); // 5 attempts per minute
      if (!rateLimit.allowed) {
        throw new Error(`Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`);
      }

      // Input validation
      const validation = validateLoginForm(username, password);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { authenticate } = await import('../utils/api');
      const response = await authenticate(validation.sanitized.username, password, rememberMe);

      // Store user info and access token securely
      const fullName = response.FullName || response.UserName;

      // Use encrypted storage for sensitive data
      await secureSessionStorage.setItem('userId', response.AccountId);
      await secureSessionStorage.setItem('username', response.UserName);
      await secureSessionStorage.setItem('fullName', fullName);
      await secureSessionStorage.setItem('accessToken', response.accessToken);

      // Clear rate limit on successful login
      clearRateLimit('login');

      onLoginSuccess({
        userId: response.AccountId,
        username: response.UserName,
        fullName: fullName,
        accessToken: response.accessToken,
      });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
      <Box maxW="md" w="full" p={8}>
        <Box bg="white" p={8} borderRadius="lg" boxShadow="md">
          <Stack gap={6}>
            <Box textAlign="center">
              <Image
                src="/tollway-logo.png"
                alt="NTTA Logo"
                h="120px"
                mx="auto"
                mb={4}
              />
              <Heading size="lg" mb={2}>
                Toll Expense Tracker
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Sign in to access your toll transactions
              </Text>
            </Box>

            <form onSubmit={handleSubmit}>
              <Stack gap={4}>
                <Field.Root required>
                  <Field.Label>Username</Field.Label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    placeholder="Enter your username"
                    autoComplete={isPrivacyMode ? "off" : "username"}
                    name={isPrivacyMode ? "ntta-username-demo" : "username"}
                  />
                </Field.Root>

                <Field.Root required>
                  <Field.Label>Password</Field.Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    placeholder="Enter your password"
                    autoComplete={isPrivacyMode ? "off" : "current-password"}
                    name={isPrivacyMode ? "ntta-password-demo" : "password"}
                  />
                </Field.Root>

                <Flex justify="space-between" align="center">
                  <Checkbox.Root
                    checked={rememberMe}
                    onCheckedChange={(e) => setRememberMe(e.checked)}
                    disabled={loading}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>
                      <Text fontSize="sm">Remember me</Text>
                    </Checkbox.Label>
                  </Checkbox.Root>
                </Flex>

                {error && (
                  <Box p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
                    <Stack direction="row" align="center" gap={2}>
                      <TriangleAlertIcon size={16} color="red" />
                      <Text fontSize="sm" color="red.700">{error}</Text>
                    </Stack>
                  </Box>
                )}

                <Button
                  type="submit"
                  colorPalette="blue"
                  size="lg"
                  loading={loading}
                  loadingText="Signing in..."
                >
                  Sign In
                </Button>

                <Stack gap={2} textAlign="center" fontSize="sm">
                  <Link
                    href="https://ssptrips.ntta.org/forgot-credentials/forgotuser"
                    target="_blank"
                    rel="noopener noreferrer"
                    color="blue.600"
                  >
                    Forgot Username?
                  </Link>
                  <Link
                    href="https://ssptrips.ntta.org/forgot-credentials/forgotpassword"
                    target="_blank"
                    rel="noopener noreferrer"
                    color="blue.600"
                  >
                    Forgot Password?
                  </Link>
                </Stack>
              </Stack>
            </form>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
