import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

// Default settings for receipt template
export const defaultReceiptSettings = {
  includeName: true,
  includeAccountNumber: false,
  includeEmail: false,
  includePhone: false,
  includeAddress: false,
};

// Get settings from localStorage or use defaults
export const getReceiptSettings = () => {
  const stored = localStorage.getItem('receiptSettings');
  return stored ? { ...defaultReceiptSettings, ...JSON.parse(stored) } : defaultReceiptSettings;
};

// Save settings to localStorage
export const saveReceiptSettings = (settings) => {
  localStorage.setItem('receiptSettings', JSON.stringify(settings));
};

// Generate receipts grouped by business purpose
export const generatePDF = (user, accountSummary, groupedTransactions) => {
  const settings = getReceiptSettings();
  const doc = new jsPDF();
  let isFirstPage = true;

  // Generate one receipt per entry; key format may be "groupKey|purpose" — extract just the purpose
  Object.entries(groupedTransactions).forEach(([pdfKey, transactions]) => {
    const pipeIndex = pdfKey.indexOf('|');
    const businessPurpose = pipeIndex !== -1 ? pdfKey.slice(pipeIndex + 1) : pdfKey;
    // Sort transactions by date within this business purpose
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = a.Entry_TripDateTime ? new Date(a.Entry_TripDateTime) : 0;
      const dateB = b.Entry_TripDateTime ? new Date(b.Entry_TripDateTime) : 0;
      return dateA - dateB;
    });

    // Calculate total for this receipt
    const receiptTotal = sortedTransactions.reduce((sum, t) => {
      return sum + Math.abs(parseFloat(t.TollAmount || 0));
    }, 0);
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    let yPosition = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('NTTA Toll Expense Receipt', 105, yPosition, { align: 'center' });
    yPosition += 12;

    // Account Information (if enabled in settings)
    let accountInfoIncluded = false;
    if (settings.includeName || settings.includeAccountNumber || settings.includeEmail ||
        settings.includePhone || settings.includeAddress) {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Account Information', 20, yPosition);
      yPosition += 7;
      accountInfoIncluded = true;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);

      if (settings.includeName && user.fullName) {
        doc.text(`Name: ${user.fullName}`, 20, yPosition);
        yPosition += 5;
      }

      if (accountSummary) {
        if (settings.includeAccountNumber) {
          doc.text(`Account #: ${accountSummary.AccountId}`, 20, yPosition);
          yPosition += 5;
        }
        if (settings.includeEmail && accountSummary.EmailAddress) {
          doc.text(`Email: ${accountSummary.EmailAddress}`, 20, yPosition);
          yPosition += 5;
        }
        if (settings.includePhone && accountSummary.PhoneNumber) {
          doc.text(`Phone: ${accountSummary.PhoneNumber}`, 20, yPosition);
          yPosition += 5;
        }
        if (settings.includeAddress) {
          const address = [
            accountSummary.Line1,
            accountSummary.Line2,
            `${accountSummary.City}, ${accountSummary.State} ${accountSummary.Zip1}`
          ].filter(Boolean).join(', ');
          if (address) {
            doc.text(`Address: ${address}`, 20, yPosition);
            yPosition += 5;
          }
        }
      }

      yPosition += 5;
    }

    // Business Purpose
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Business Purpose', 20, yPosition);
    yPosition += 7;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(businessPurpose || 'Not specified', 20, yPosition);
    yPosition += 8;

    // Date Range
    const dates = sortedTransactions.map(t =>
      t.Entry_TripDateTime ? new Date(t.Entry_TripDateTime) : null
    ).filter(Boolean);

    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);

      if (dates.length === 1 || minDate.toDateString() === maxDate.toDateString()) {
        doc.text(`Date: ${format(minDate, 'MMMM d, yyyy')}`, 20, yPosition);
      } else {
        doc.text(`Date Range: ${format(minDate, 'MMM d, yyyy')} - ${format(maxDate, 'MMM d, yyyy')}`, 20, yPosition);
      }

      doc.setTextColor(0, 0, 0); // Reset to black
      yPosition += 8;
    }

    // Transaction Details
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Transaction Details', 20, yPosition);
    yPosition += 7;

    // Create table data for all transactions in this receipt
    const tableData = sortedTransactions.map(t => {
      const location = [
        t.LocationName,
        t.EntryPlazaName,
        t.EntryLaneName,
      ].filter(Boolean).join(' - ') || 'Unknown';

      const dateTime = t.Entry_TripDateTime
        ? format(parseISO(t.Entry_TripDateTime), 'MMM d, yyyy h:mm a')
        : 'N/A';

      const amount = Math.abs(parseFloat(t.TollAmount || 0));

      return [
        dateTime,
        location,
        t.VehicleNumber || 'N/A',
        t.TagId || 'N/A',
        `$${amount.toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Date & Time', 'Location', 'Vehicle', 'Tag ID', 'Amount']],
      body: tableData,
      theme: 'striped',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        fontStyle: 'bold',
      },
      columnStyles: {
        4: { halign: 'right' },
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    // Receipt Total
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Total Amount', 20, yPosition);

    doc.setFontSize(14);
    doc.text(`$${receiptTotal.toFixed(2)}`, 170, yPosition, { align: 'right' });
    yPosition += 15;

    // Footer with timestamp
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${format(new Date(), 'MMM d, yyyy \'at\' h:mm a')}`,
      105,
      280,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0); // Reset to black
  });

  // Save the PDF with timestamp
  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
  const filename = `NTTA_Receipts_${timestamp}.pdf`;
  doc.save(filename);
};
