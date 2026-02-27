import {
  Box,
  Card,
  Heading,
  Text,
  Grid,
  Badge,
  Flex,
  Spinner,
  Stack,
} from '@chakra-ui/react';
import { TriangleAlertIcon } from 'lucide-react';
import { usePrivacyMode } from '../contexts/PrivacyModeContext';

export default function AccountInfo({ accountSummary, loading, error }) {
  const { maskData } = usePrivacyMode();
  if (loading) {
    return (
      <Card.Root>
        <Card.Body>
          <Flex justify="center" align="center" py={4}>
            <Spinner size="lg" color="blue.500" />
            <Text ml={4}>Loading account information...</Text>
          </Flex>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error) {
    return (
      <Box p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
        <Stack direction="row" align="center" gap={2}>
          <TriangleAlertIcon size={16} color="red" />
          <Text fontSize="sm" color="red.700">{error}</Text>
        </Stack>
      </Box>
    );
  }

  if (!accountSummary) {
    return null;
  }

  const getStatusColor = (status) => {
    return status === 'Active' ? 'green' : status === 'Suspended' ? 'red' : 'yellow';
  };

  return (
    <Card.Root>
      <Card.Body>
        <Flex justify="space-between" align="start" mb={4}>
          <Box>
            <Heading size="md" mb={2}>
              {maskData(accountSummary.FullName, 'name')}
            </Heading>
            <Text fontSize="sm" color="gray.600">
              Account #{maskData(accountSummary.AccountId?.toString(), 'account')}
            </Text>
          </Box>
          <Badge colorPalette={getStatusColor(accountSummary.AccountStatus)} fontSize="md" px={3} py={1}>
            {accountSummary.AccountStatus}
          </Badge>
        </Flex>

        <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4} mb={4}>
          <Box>
            <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
              Current Toll Balance
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={accountSummary.TollBal > 0 ? 'green.500' : 'red.500'}>
              ${maskData(Math.abs(accountSummary.TollBal).toFixed(2), 'money')}
            </Text>
            <Text fontSize="sm" color="gray.600">
              {accountSummary.TollBal > 0 ? 'Credit' : 'Amount Due'}
            </Text>
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
              Active Vehicles
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {accountSummary.ActiveVehicleCount}
            </Text>
            <Text fontSize="sm" color="gray.600">
              {accountSummary.InActiveVehicleCount} inactive
            </Text>
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
              Transponders
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {accountSummary.TranspondersCount}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Active tags
            </Text>
          </Box>
        </Grid>

        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
          <Box p={3} bg="gray.50" borderRadius="md">
            <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
              Contact Information
            </Text>
            <Text fontSize="sm">{maskData(accountSummary.EmailAddress, 'email')}</Text>
            <Text fontSize="sm">{maskData(accountSummary.PhoneNumber, 'phone')}</Text>
          </Box>

          <Box p={3} bg="gray.50" borderRadius="md">
            <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
              Address
            </Text>
            <Text fontSize="sm">
              {maskData(accountSummary.Line1, 'address')}
              {accountSummary.Line2 && <>, {maskData(accountSummary.Line2, 'address')}</>}
            </Text>
            <Text fontSize="sm">
              {maskData(accountSummary.City, 'address')}, {accountSummary.State} {maskData(accountSummary.Zip1, 'address')}
            </Text>
          </Box>
        </Grid>

        {accountSummary.ReplenishmentAmnt > 0 && (
          <Box mt={4} p={3} bg="blue.50" borderRadius="md">
            <Text fontSize="sm">
              ✓ Auto-replenishment enabled: ${maskData(accountSummary.ReplenishmentAmnt.toFixed(2), 'money')} when
              balance falls below ${maskData(accountSummary.ThresholdAmount.toFixed(2), 'money')}
            </Text>
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
}
