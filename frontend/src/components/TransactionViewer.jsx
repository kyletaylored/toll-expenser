import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Box,
  Heading,
  Text,
  Button,
  Input,
  Field,
  Card,
  Flex,
  Grid,
  Table,
  Stack,
  NativeSelectRoot,
  NativeSelectField,
  Image,
  Checkbox,
  Collapsible,
  IconButton,
} from '@chakra-ui/react';
import AccountInfo from './AccountInfo';
import ReceiptSettings from './ReceiptSettings';
import { datePresets, formatDateForInput, getDefaultDateRange } from '../utils/dateUtils';
import { TriangleAlertIcon, ChevronDown, ChevronUp, ChevronRight, Settings, Eye, EyeOff } from 'lucide-react';
import { toaster } from '../utils/toaster';
import { usePrivacyMode } from '../contexts/PrivacyModeContext';
import {
  getCachedTransactions,
  cacheTransactions,
  mergeWithCache,
  clearTransactionCache,
} from '../utils/transactionCache';

export default function TransactionViewer({ user, accountSummary, onLogout }) {
  const { isPrivacyMode, togglePrivacyMode, maskData } = usePrivacyMode();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('last-month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [businessPurposes, setBusinessPurposes] = useState({});
  const [groupBy, setGroupBy] = useState('day'); // 'day', 'trip', or 'none'
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const defaultRange = getDefaultDateRange();
    setStartDate(formatDateForInput(defaultRange.startDate));
    setEndDate(formatDateForInput(defaultRange.endDate));
  }, []);

  const handlePresetChange = (value) => {
    setDatePreset(value);
    if (value === 'custom') {
      return;
    }

    const preset = datePresets.find((p) => p.value === value);
    if (preset) {
      const { startDate: start, endDate: end } = preset.getDates();
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(end));
    }
  };

  const handleFetchTransactions = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let fromCache = false;
      let cached = [];

      // Try to get cached transactions (non-blocking)
      try {
        cached = getCachedTransactions(startDate, endDate);
        if (cached && cached.length > 0) {
          setTransactions(cached);
          fromCache = true;

          // Show a quick notification that we're using cached data
          toaster.create({
            title: 'Loading from cache',
            description: `Found ${cached.length} cached transaction${cached.length !== 1 ? 's' : ''}, checking for updates...`,
            type: 'info',
            duration: 2000,
          });
        }
      } catch (cacheError) {
        console.error('Cache read error (non-critical):', cacheError);
      }

      // Always fetch fresh data from the API
      const { fetchTransactions } = await import('../utils/api');
      const freshData = await fetchTransactions(
        user.userId,
        user.accessToken,
        new Date(startDate),
        new Date(endDate)
      );

      // Try to cache the fresh data (non-blocking)
      try {
        cacheTransactions(freshData);
      } catch (cacheError) {
        console.error('Cache write error (non-critical):', cacheError);
      }

      // Try to merge with cache if we had cached data
      let finalData = freshData;
      if (fromCache && cached.length > 0) {
        try {
          finalData = mergeWithCache(freshData, cached);
        } catch (mergeError) {
          console.error('Merge error (non-critical):', mergeError);
          finalData = freshData; // Fall back to fresh data
        }
      }

      setTransactions(finalData);

      // Initialize with no transactions selected
      setSelectedTransactions(new Set());

      // Business purposes can be per-transaction or per-group
      // We'll initialize with empty strings and populate based on grouping mode
      setBusinessPurposes({});

      const message = fromCache && freshData.length === cached.length
        ? `${finalData.length} transaction${finalData.length !== 1 ? 's' : ''} (up to date)`
        : `Found ${finalData.length} transaction${finalData.length !== 1 ? 's' : ''}${fromCache ? ' (updated)' : ''}`;

      toaster.create({
        title: 'Success',
        description: message,
        type: 'success',
        duration: 3000,
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch transactions');
      toaster.create({
        title: 'Error',
        description: err.message || 'Failed to fetch transactions',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessPurposeChange = (key, value) => {
    // key can be either a groupKey (for grouped mode) or CustomerTripId (for ungrouped mode)
    setBusinessPurposes((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getBusinessPurpose = (groupKey, transaction) => {
    // In grouped mode, use the group key; otherwise use the transaction ID
    if (groupBy === 'none') {
      return businessPurposes[transaction.CustomerTripId] || '';
    }
    return businessPurposes[groupKey] || '';
  };

  const handleToggleTransaction = (tripId) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map((t) => t.CustomerTripId)));
    }
  };

  const formatLocation = (transaction) => {
    const parts = [
      transaction.LocationName,
      transaction.EntryPlazaName,
      transaction.EntryLaneName,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : 'Unknown Location';
  };

  const formatTime = (dateTimeStr) => {
    if (!dateTimeStr) return 'N/A';
    try {
      return format(parseISO(dateTimeStr), 'h:mm a');
    } catch {
      return 'N/A';
    }
  };

  const formatAmount = (tollAmount) => {
    const amount = parseFloat(tollAmount || 0);
    return Math.abs(amount).toFixed(2);
  };

  const calculateTotal = (transactionList) => {
    return transactionList.reduce((sum, t) => {
      if (selectedTransactions.has(t.CustomerTripId)) {
        return sum + Math.abs(parseFloat(t.TollAmount || 0));
      }
      return sum;
    }, 0);
  };

  const getSelectedTransactions = () => {
    return transactions.filter((t) => selectedTransactions.has(t.CustomerTripId));
  };

  const getGroupedTransactions = () => {
    if (groupBy === 'none') {
      return { 'All Transactions': transactions };
    }

    return transactions.reduce((acc, transaction) => {
      let key;
      if (groupBy === 'day') {
        // Group by day
        const dateStr = transaction.Entry_TripDateTime?.split('T')[0] || 'Unknown Date';
        key = dateStr;
      } else if (groupBy === 'trip') {
        // Group by trip (same day, same vehicle)
        const dateStr = transaction.Entry_TripDateTime?.split('T')[0] || 'Unknown Date';
        const vehicle = transaction.VehicleNumber || 'Unknown Vehicle';
        key = `${dateStr}_${vehicle}`;
      }

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(transaction);
      return acc;
    }, {});
  };

  const formatGroupLabel = (key, groupTransactions) => {
    if (groupBy === 'none') {
      return 'All Transactions';
    } else if (groupBy === 'day') {
      const date = parseISO(key);
      return format(date, 'EEEE, MMMM d, yyyy');
    } else if (groupBy === 'trip') {
      const [dateStr, vehicle] = key.split('_');
      const date = parseISO(dateStr);
      return `${format(date, 'EEEE, MMMM d, yyyy')} - ${vehicle}`;
    }
    return key;
  };

  const calculateGroupTotal = (groupTransactions) => {
    return groupTransactions.reduce((sum, t) => {
      if (selectedTransactions.has(t.CustomerTripId)) {
        return sum + Math.abs(parseFloat(t.TollAmount || 0));
      }
      return sum;
    }, 0);
  };

  // Calculate how many receipts will be generated (one per unique business purpose)
  const calculateReceiptCount = () => {
    const grouped = getGroupedTransactions();
    const uniquePurposes = new Set();

    if (groupBy === 'none') {
      // For ungrouped mode, count unique business purposes from selected transactions
      transactions.forEach((t) => {
        if (selectedTransactions.has(t.CustomerTripId)) {
          const purpose = businessPurposes[t.CustomerTripId];
          if (purpose && purpose.trim()) {
            uniquePurposes.add(purpose);
          }
        }
      });
    } else {
      // Count one receipt per group that has selected transactions and a purpose
      Object.entries(grouped).forEach(([groupKey, groupTransactions]) => {
        const hasSelected = groupTransactions.some((t) =>
          selectedTransactions.has(t.CustomerTripId)
        );
        if (hasSelected) {
          const purpose = businessPurposes[groupKey];
          if (purpose && purpose.trim()) {
            uniquePurposes.add(`${groupKey}|${purpose}`);
          }
        }
      });
    }

    return uniquePurposes.size;
  };

  const toggleGroupSelection = (groupTransactions) => {
    const allSelected = groupTransactions.every((t) =>
      selectedTransactions.has(t.CustomerTripId)
    );

    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      groupTransactions.forEach((t) => {
        if (allSelected) {
          next.delete(t.CustomerTripId);
        } else {
          next.add(t.CustomerTripId);
        }
      });
      return next;
    });
  };

  const toggleGroupExpansion = (groupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allKeys = Object.keys(getGroupedTransactions());
    setExpandedGroups(new Set(allKeys));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const handleGeneratePDF = async () => {
    const selected = getSelectedTransactions();

    if (selected.length === 0) {
      toaster.create({
        title: 'No Transactions Selected',
        description: 'Please select at least one transaction to generate a receipt',
        type: 'warning',
        duration: 3000,
      });
      return;
    }

    // Check business purposes based on grouping mode
    const grouped = getGroupedTransactions();
    const missingGroups = [];

    if (groupBy === 'none') {
      // Check each transaction individually
      selected.forEach((t) => {
        if (!businessPurposes[t.CustomerTripId]?.trim()) {
          missingGroups.push(`Transaction ${t.CustomerTripId}`);
        }
      });
    } else {
      // Check each group that has selected transactions
      Object.entries(grouped).forEach(([groupKey, groupTransactions]) => {
        const hasSelected = groupTransactions.some((t) =>
          selectedTransactions.has(t.CustomerTripId)
        );
        if (hasSelected && !businessPurposes[groupKey]?.trim()) {
          missingGroups.push(formatGroupLabel(groupKey, groupTransactions));
        }
      });
    }

    if (missingGroups.length > 0) {
      toaster.create({
        title: 'Missing Business Purposes',
        description: `Please add business purposes for ${missingGroups.length} ${groupBy === 'none' ? 'transaction(s)' : 'group(s)'}`,
        type: 'warning',
        duration: 4000,
      });
      return;
    }

    // Build grouped structure for PDF generation with business purposes
    const groupedForPDF = {};

    if (groupBy === 'none') {
      // For ungrouped mode, each transaction is its own group
      selected.forEach((t) => {
        const purpose = businessPurposes[t.CustomerTripId];
        if (!groupedForPDF[purpose]) {
          groupedForPDF[purpose] = [];
        }
        groupedForPDF[purpose].push(t);
      });
    } else {
      // For grouped mode, key by groupKey|purpose so same purpose on different days
      // each gets its own receipt rather than being merged together
      Object.entries(grouped).forEach(([groupKey, groupTransactions]) => {
        const selectedInGroup = groupTransactions.filter((t) =>
          selectedTransactions.has(t.CustomerTripId)
        );
        if (selectedInGroup.length > 0) {
          const purpose = businessPurposes[groupKey];
          const pdfKey = `${groupKey}|${purpose}`;
          if (!groupedForPDF[pdfKey]) {
            groupedForPDF[pdfKey] = [];
          }
          groupedForPDF[pdfKey].push(...selectedInGroup);
        }
      });
    }

    const receiptCount = Object.keys(groupedForPDF).length; // One receipt per business purpose

    const { generatePDF } = await import('../utils/pdfGenerator');
    generatePDF(user, accountSummary, groupedForPDF);
    toaster.create({
      title: 'PDF Generated',
      description: `${receiptCount} receipt(s) generated for ${selected.length} transaction(s)`,
      type: 'success',
      duration: 3000,
    });
  };

  return (
    <Box maxW="1200px" mx="auto" py={8} px={4} data-page="transaction-viewer">
      <Stack gap={6} data-container="main-content">
        {/* Header - Mobile Responsive */}
        <Stack gap={4} data-section="page-header">
          <Flex align="center" gap={3} data-group="branding">
            <Image
              src="/tollway-logo.png"
              alt="NTTA Logo"
              h={{ base: "40px", md: "50px" }}
              data-element="logo"
            />
            <Box data-group="title">
              <Heading size={{ base: "md", md: "lg" }}>Toll Expense Tracker</Heading>
              <Text color="gray.600" mt={1} fontSize={{ base: "sm", md: "md" }}>
                Welcome back, {maskData(user.fullName, 'name')}
              </Text>
            </Box>
          </Flex>

          {/* Action Buttons - Stack on mobile */}
          <Flex
            gap={2}
            wrap="wrap"
            justify={{ base: "flex-start", md: "flex-end" }}
            direction={{ base: "column", sm: "row" }}
            data-group="header-actions"
          >
            <Button
              onClick={togglePrivacyMode}
              variant="outline"
              colorPalette={isPrivacyMode ? "green" : "gray"}
              size={{ base: "sm", md: "md" }}
              width={{ base: "full", sm: "auto" }}
              data-action="toggle-privacy"
            >
              <Flex align="center" gap={2}>
                {isPrivacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
                <Text display={{ base: "inline", sm: "none" }}>
                  {isPrivacyMode ? 'Privacy On' : 'Privacy Off'}
                </Text>
                <Text display={{ base: "none", sm: "inline" }}>
                  {isPrivacyMode ? 'Privacy Mode On' : 'Privacy Mode Off'}
                </Text>
              </Flex>
            </Button>
            <Button
              onClick={() => setShowSettings(true)}
              variant="outline"
              colorPalette="gray"
              size={{ base: "sm", md: "md" }}
              width={{ base: "full", sm: "auto" }}
              data-action="open-settings"
            >
              <Flex align="center" gap={2}>
                <Settings size={16} />
                <Text>Receipt Settings</Text>
              </Flex>
            </Button>
            <Button
              onClick={() => {
                clearTransactionCache();
                onLogout();
              }}
              variant="outline"
              colorPalette="gray"
              size={{ base: "sm", md: "md" }}
              width={{ base: "full", sm: "auto" }}
            >
              Logout
            </Button>
          </Flex>
        </Stack>

        <AccountInfo accountSummary={accountSummary} />

        <ReceiptSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />

        <Card.Root>
          <Card.Header>
            <Heading size="md">Transaction Search</Heading>
            <Text fontSize="sm" color="gray.600" mt={1}>
              Select a date range to view your toll transactions
            </Text>
          </Card.Header>
          <Card.Body>
            <Stack gap={4}>
              <Field.Root>
                <Field.Label>Date Range Preset</Field.Label>
                <NativeSelectRoot>
                  <NativeSelectField
                    value={datePreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                  >
                    {datePresets.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                    <option value="custom">Custom Range</option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field.Root>

              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                <Field.Root>
                  <Field.Label>Start Date</Field.Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDatePreset('custom');
                    }}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>End Date</Field.Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDatePreset('custom');
                    }}
                  />
                </Field.Root>
              </Grid>

              <Button
                onClick={handleFetchTransactions}
                loading={loading}
                loadingText="Fetching..."
                colorPalette="blue"
                size={{ base: "md", md: "lg" }}
                width={{ base: "full", sm: "auto" }}
              >
                <Text display={{ base: "none", sm: "inline" }}>Fetch Transactions</Text>
                <Text display={{ base: "inline", sm: "none" }}>Search</Text>
              </Button>

              {error && (
                <Box p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
                  <Stack direction="row" align="center" gap={2}>
                    <TriangleAlertIcon size={16} color="red" />
                    <Text fontSize="sm" color="red.700">{error}</Text>
                  </Stack>
                </Box>
              )}
            </Stack>
          </Card.Body>
        </Card.Root>

        {transactions.length > 0 && (
          <>
            <Card.Root data-section="transaction-summary">
              <Card.Body>
                {/* Desktop: Grid layout */}
                <Grid
                  templateColumns="repeat(3, 1fr)"
                  gap={6}
                  display={{ base: "none", md: "grid" }}
                  data-layout="desktop-stats"
                >
                  <Box data-stat="total-transactions">
                    <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
                      Total Transactions
                    </Text>
                    <Text fontSize="3xl" fontWeight="bold">
                      {transactions.length}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {format(new Date(startDate), 'MMM d')} -{' '}
                      {format(new Date(endDate), 'MMM d, yyyy')}
                    </Text>
                  </Box>
                  <Box data-stat="selected-count">
                    <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
                      Selected for Receipt
                    </Text>
                    <Text fontSize="3xl" fontWeight="bold" color="blue.600">
                      {selectedTransactions.size}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {selectedTransactions.size === transactions.length ? 'All' : 'Partial'} selection
                    </Text>
                  </Box>
                  <Box data-stat="selected-amount">
                    <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
                      Selected Amount
                    </Text>
                    <Text fontSize="3xl" fontWeight="bold" color="green.600">
                      ${maskData(calculateTotal(transactions).toFixed(2), 'money')}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Expense total
                    </Text>
                  </Box>
                </Grid>

                {/* Mobile: Compact stat cards */}
                <Stack gap={3} display={{ base: "flex", md: "none" }} data-layout="mobile-stats">
                  <Flex justify="space-between" align="center" p={3} bg="gray.50" borderRadius="md" data-group="stats-compact">
                    <Box data-stat="total-mobile">
                      <Text fontSize="xs" fontWeight="medium" color="gray.600" mb={1}>
                        Total
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        {transactions.length}
                      </Text>
                    </Box>
                    <Box textAlign="center" data-stat="selected-mobile">
                      <Text fontSize="xs" fontWeight="medium" color="gray.600" mb={1}>
                        Selected
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                        {selectedTransactions.size}
                      </Text>
                    </Box>
                    <Box textAlign="right" data-stat="amount-mobile">
                      <Text fontSize="xs" fontWeight="medium" color="gray.600" mb={1}>
                        Amount
                      </Text>
                      <Text fontSize="xl" fontWeight="bold" color="green.600">
                        ${maskData(calculateTotal(transactions).toFixed(2), 'money')}
                      </Text>
                    </Box>
                  </Flex>
                </Stack>
              </Card.Body>
            </Card.Root>

            <Card.Root>
              <Card.Header data-section="transactions-header">
                <Stack gap={3} data-container="header-content">
                  <Heading size={{ base: "sm", md: "md" }}>Transactions</Heading>

                  {/* Controls - Stack on mobile, horizontal on desktop */}
                  <Flex
                    gap={2}
                    direction={{ base: "column", md: "row" }}
                    align={{ base: "stretch", md: "center" }}
                    justify={{ base: "flex-start", md: "space-between" }}
                    data-container="transaction-controls"
                  >
                    {/* Group By Selector */}
                    <Field.Root
                      width={{ base: "full", md: "200px" }}
                      flexShrink={0}
                      data-field="group-by-selector"
                    >
                      <NativeSelectRoot size="sm">
                        <NativeSelectField
                          value={groupBy}
                          onChange={(e) => setGroupBy(e.target.value)}
                          data-input="group-by"
                        >
                          <option value="day">Group by Day</option>
                          <option value="trip">Group by Trip</option>
                          <option value="none">No Grouping</option>
                        </NativeSelectField>
                      </NativeSelectRoot>
                    </Field.Root>

                    {/* Buttons - Mobile: full width stack, Desktop: horizontal row aligned right */}
                    <Flex
                      gap={2}
                      direction={{ base: "column", md: "row" }}
                      width={{ base: "full", md: "auto" }}
                      data-group="action-buttons"
                    >
                      {groupBy !== 'none' && (
                        <>
                          <Button
                            onClick={expandAll}
                            variant="ghost"
                            size="sm"
                            colorPalette="gray"
                            width={{ base: "full", md: "auto" }}
                            data-action="expand-all"
                          >
                            Expand All
                          </Button>
                          <Button
                            onClick={collapseAll}
                            variant="ghost"
                            size="sm"
                            colorPalette="gray"
                            width={{ base: "full", md: "auto" }}
                            data-action="collapse-all"
                          >
                            Collapse All
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={handleToggleAll}
                        variant="outline"
                        size="sm"
                        colorPalette="blue"
                        width={{ base: "full", md: "auto" }}
                        data-action="toggle-all-selection"
                      >
                        {selectedTransactions.size === transactions.length
                          ? 'Deselect All'
                          : 'Select All'}
                      </Button>
                    </Flex>
                  </Flex>
                </Stack>
              </Card.Header>
              <Card.Body>
                <Stack gap={6}>
                  {Object.entries(getGroupedTransactions())
                    .sort(([a], [b]) => {
                      if (groupBy === 'none') return 0;
                      const dateA = a.split('_')[0];
                      const dateB = b.split('_')[0];
                      return new Date(dateA) - new Date(dateB);
                    })
                    .map(([groupKey, groupTransactions]) => {
                      const groupTotal = calculateGroupTotal(groupTransactions);
                      const groupSelected = groupTransactions.filter((t) =>
                        selectedTransactions.has(t.CustomerTripId)
                      ).length;

                      const isExpanded = expandedGroups.has(groupKey);

                      return (
                        <Card.Root
                          key={groupKey}
                          variant={groupBy === 'none' ? 'elevated' : 'outline'}
                          borderWidth={groupBy !== 'none' ? '2px' : undefined}
                        >
                          {groupBy !== 'none' && (
                            <Card.Header bg="gray.50" pb={3}>
                              {/* Mobile: Stack vertically, Desktop: Horizontal single-row layout */}
                              <Flex
                                direction={{ base: "column", md: "row" }}
                                align={{ base: "stretch", md: "center" }}
                                gap={{ base: 3, md: 2 }}
                              >
                                {/* Expand/Collapse Button */}
                                <IconButton
                                  onClick={() => toggleGroupExpansion(groupKey)}
                                  variant="ghost"
                                  size="sm"
                                  aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                                  display={{ base: "none", md: "flex" }}
                                >
                                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </IconButton>

                                {/* Mobile-only: Date/Transaction Overview with expand button */}
                                <Flex align="center" gap={2} display={{ base: "flex", md: "none" }}>
                                  <IconButton
                                    onClick={() => toggleGroupExpansion(groupKey)}
                                    variant="ghost"
                                    size="sm"
                                    aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                                  >
                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                  </IconButton>
                                  <Box flex="1">
                                    <Heading size="xs">
                                      {formatGroupLabel(groupKey, groupTransactions)}
                                    </Heading>
                                    <Text fontSize="xs" color="gray.600" mt={1}>
                                      {groupTransactions.length} transaction(s) • ${maskData(groupTotal.toFixed(2), 'money')} selected
                                    </Text>
                                  </Box>
                                </Flex>

                                {/* Desktop-only: Date/Transaction Overview */}
                                <Box flex="1" display={{ base: "none", md: "block" }}>
                                  <Heading size="sm">
                                    {formatGroupLabel(groupKey, groupTransactions)}
                                  </Heading>
                                  <Text fontSize="sm" color="gray.600" mt={1}>
                                    {groupTransactions.length} transaction(s) • ${maskData(groupTotal.toFixed(2), 'money')} selected
                                  </Text>
                                </Box>

                                {/* Business Purpose Input */}
                                <Field.Root flex={{ base: "1", md: "0 0 300px" }}>
                                  <Input
                                    value={businessPurposes[groupKey] || ''}
                                    onChange={(e) =>
                                      handleBusinessPurposeChange(groupKey, e.target.value)
                                    }
                                    placeholder="Business purpose (e.g., Client meeting)"
                                    disabled={groupSelected === 0}
                                    size="sm"
                                    bgColor="#fff"
                                  />
                                </Field.Root>

                                {/* Select/Deselect Button */}
                                <Button
                                  onClick={() => toggleGroupSelection(groupTransactions)}
                                  variant="outline"
                                  size="sm"
                                  colorPalette="blue"
                                  width={{ base: "full", md: "auto" }}
                                  flexShrink={0}
                                >
                                  {groupSelected === groupTransactions.length
                                  ? 'Deselect Group'
                                  : `Select (${groupSelected}/${groupTransactions.length})`}
                                </Button>
                              </Flex>
                            </Card.Header>
                          )}

                          <Collapsible.Root open={groupBy === 'none' || isExpanded}>
                            <Collapsible.Content>
                              <Card.Body pt={groupBy !== 'none' ? 3 : undefined}>
                                <Box overflowX="auto">
                                  <Table.Root variant="line" size="sm">
                                    <Table.Header>
                                      <Table.Row>
                                        <Table.ColumnHeader width="50px">Select</Table.ColumnHeader>
                                        <Table.ColumnHeader>Date/Time</Table.ColumnHeader>
                                        <Table.ColumnHeader>Location</Table.ColumnHeader>
                                        <Table.ColumnHeader>Tag ID</Table.ColumnHeader>
                                        <Table.ColumnHeader>Vehicle</Table.ColumnHeader>
                                        <Table.ColumnHeader textAlign="end">Amount</Table.ColumnHeader>
                                        {groupBy === 'none' && (
                                          <Table.ColumnHeader width="300px">Business Purpose</Table.ColumnHeader>
                                        )}
                                      </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                      {groupTransactions.map((transaction) => (
                                        <Table.Row
                                          key={transaction.CustomerTripId}
                                          bg={
                                            selectedTransactions.has(transaction.CustomerTripId)
                                              ? 'blue.50'
                                              : undefined
                                          }
                                        >
                                          <Table.Cell>
                                            <Checkbox.Root
                                              checked={selectedTransactions.has(transaction.CustomerTripId)}
                                              onCheckedChange={() =>
                                                handleToggleTransaction(transaction.CustomerTripId)
                                              }
                                            >
                                              <Checkbox.HiddenInput />
                                              <Checkbox.Control />
                                            </Checkbox.Root>
                                          </Table.Cell>
                                          <Table.Cell>
                                            <Box>
                                              <Text fontWeight="medium">
                                                {format(
                                                  parseISO(transaction.Entry_TripDateTime),
                                                  'MMM d, yyyy'
                                                )}
                                              </Text>
                                              <Text fontSize="sm" color="gray.600">
                                                {formatTime(transaction.Entry_TripDateTime)}
                                              </Text>
                                            </Box>
                                          </Table.Cell>
                                          <Table.Cell>
                                            <Text fontSize="sm">{formatLocation(transaction)}</Text>
                                          </Table.Cell>
                                          <Table.Cell>
                                            <Text fontSize="sm" fontFamily="mono">
                                              {maskData(transaction.TagId || 'N/A', 'tag')}
                                            </Text>
                                          </Table.Cell>
                                          <Table.Cell>
                                            <Text fontSize="sm" fontFamily="mono">
                                              {maskData(transaction.VehicleNumber || 'N/A', 'vehicle')}
                                            </Text>
                                          </Table.Cell>
                                          <Table.Cell textAlign="end">
                                            <Text fontWeight="medium" color="green.700">
                                              ${maskData(formatAmount(transaction.TollAmount), 'money')}
                                            </Text>
                                          </Table.Cell>
                                          {groupBy === 'none' && (
                                            <Table.Cell>
                                              <Input
                                                size="sm"
                                                value={businessPurposes[transaction.CustomerTripId] || ''}
                                                onChange={(e) =>
                                                  handleBusinessPurposeChange(
                                                    transaction.CustomerTripId,
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="e.g., Client meeting"
                                                disabled={!selectedTransactions.has(transaction.CustomerTripId)}
                                              />
                                            </Table.Cell>
                                          )}
                                        </Table.Row>
                                      ))}
                                    </Table.Body>
                                  </Table.Root>
                                </Box>
                              </Card.Body>
                            </Collapsible.Content>
                          </Collapsible.Root>
                        </Card.Root>
                      );
                    })}
                </Stack>
              </Card.Body>
            </Card.Root>

            <Flex justify="center" mt={6} px={{ base: 4, md: 0 }}>
              <Button
                onClick={handleGeneratePDF}
                colorPalette="green"
                size={{ base: "md", md: "lg" }}
                width={{ base: "full", sm: "auto" }}
                px={{ base: 6, md: 12 }}
                disabled={selectedTransactions.size === 0}
              >
                Generate Receipts ({calculateReceiptCount()})
              </Button>
            </Flex>
          </>
        )}
      </Stack>
    </Box>
  );
}
