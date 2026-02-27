import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  Stack,
  Card,
  Flex,
  Checkbox,
} from '@chakra-ui/react';
import { Settings, X } from 'lucide-react';
import { getReceiptSettings, saveReceiptSettings, defaultReceiptSettings } from '../utils/pdfGenerator';
import { toaster } from '../utils/toaster';

export default function ReceiptSettings({ isOpen, onClose }) {
  const [settings, setSettings] = useState(defaultReceiptSettings);

  useEffect(() => {
    if (isOpen) {
      setSettings(getReceiptSettings());
    }
  }, [isOpen]);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    saveReceiptSettings(settings);
    toaster.create({
      title: 'Settings Saved',
      description: 'Receipt template preferences have been updated',
      type: 'success',
      duration: 3000,
    });
    onClose();
  };

  const handleReset = () => {
    setSettings(defaultReceiptSettings);
    toaster.create({
      title: 'Settings Reset',
      description: 'Receipt template preferences have been reset to defaults',
      type: 'info',
      duration: 3000,
    });
  };

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="blackAlpha.600"
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      onClick={onClose}
    >
      <Card.Root
        maxW="500px"
        w="full"
        onClick={(e) => e.stopPropagation()}
      >
        <Card.Header>
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={2}>
              <Settings size={20} />
              <Heading size="md">Receipt Settings</Heading>
            </Flex>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              p={1}
            >
              <X size={20} />
            </Button>
          </Flex>
        </Card.Header>

        <Card.Body>
          <Stack gap={6}>
            <Box>
              <Heading size="sm" mb={3}>
                Personal Information
              </Heading>
              <Text fontSize="sm" color="gray.600" mb={4}>
                Choose which personal information to include on your receipts
              </Text>

              <Stack gap={3}>
                <Checkbox.Root
                  checked={settings.includeName}
                  onCheckedChange={() => handleToggle('includeName')}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <Box>
                      <Text fontWeight="medium">Include Name</Text>
                      <Text fontSize="sm" color="gray.600">
                        Display your full name on receipts
                      </Text>
                    </Box>
                  </Checkbox.Label>
                </Checkbox.Root>

                <Checkbox.Root
                  checked={settings.includeAccountNumber}
                  onCheckedChange={() => handleToggle('includeAccountNumber')}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <Box>
                      <Text fontWeight="medium">Include Account Number</Text>
                      <Text fontSize="sm" color="gray.600">
                        Display your NTTA account number
                      </Text>
                    </Box>
                  </Checkbox.Label>
                </Checkbox.Root>

                <Checkbox.Root
                  checked={settings.includeEmail}
                  onCheckedChange={() => handleToggle('includeEmail')}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <Box>
                      <Text fontWeight="medium">Include Email Address</Text>
                      <Text fontSize="sm" color="gray.600">
                        Display your email address
                      </Text>
                    </Box>
                  </Checkbox.Label>
                </Checkbox.Root>

                <Checkbox.Root
                  checked={settings.includePhone}
                  onCheckedChange={() => handleToggle('includePhone')}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <Box>
                      <Text fontWeight="medium">Include Phone Number</Text>
                      <Text fontSize="sm" color="gray.600">
                        Display your phone number
                      </Text>
                    </Box>
                  </Checkbox.Label>
                </Checkbox.Root>

                <Checkbox.Root
                  checked={settings.includeAddress}
                  onCheckedChange={() => handleToggle('includeAddress')}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <Box>
                      <Text fontWeight="medium">Include Address</Text>
                      <Text fontSize="sm" color="gray.600">
                        Display your mailing address
                      </Text>
                    </Box>
                  </Checkbox.Label>
                </Checkbox.Root>
              </Stack>
            </Box>
          </Stack>
        </Card.Body>

        <Card.Footer>
          <Flex justify="space-between" w="full">
            <Button
              onClick={handleReset}
              variant="outline"
              colorPalette="gray"
            >
              Reset to Defaults
            </Button>
            <Flex gap={2}>
              <Button
                onClick={onClose}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                colorPalette="blue"
              >
                Save Settings
              </Button>
            </Flex>
          </Flex>
        </Card.Footer>
      </Card.Root>
    </Box>
  );
}
