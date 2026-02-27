import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  startOfYear,
  format
} from 'date-fns';

export const datePresets = [
  {
    label: 'Last Month',
    value: 'last-month',
    getDates: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth)
      };
    }
  },
  {
    label: 'This Month',
    value: 'this-month',
    getDates: () => {
      const now = new Date();
      return {
        startDate: startOfMonth(now),
        endDate: new Date()
      };
    }
  },
  {
    label: 'Last 7 Days',
    value: 'last-7-days',
    getDates: () => ({
      startDate: subDays(new Date(), 7),
      endDate: new Date()
    })
  },
  {
    label: 'Last 30 Days',
    value: 'last-30-days',
    getDates: () => ({
      startDate: subDays(new Date(), 30),
      endDate: new Date()
    })
  },
  {
    label: 'Last 90 Days',
    value: 'last-90-days',
    getDates: () => ({
      startDate: subDays(new Date(), 90),
      endDate: new Date()
    })
  },
  {
    label: 'Year to Date',
    value: 'year-to-date',
    getDates: () => ({
      startDate: startOfYear(new Date()),
      endDate: new Date()
    })
  }
];

export const getDatePreset = (presetValue) => {
  const preset = datePresets.find(p => p.value === presetValue);
  return preset ? preset.getDates() : null;
};

export const formatDateForInput = (date) => {
  return format(date, 'yyyy-MM-dd');
};

export const getDefaultDateRange = () => {
  const lastMonth = subMonths(new Date(), 1);
  return {
    startDate: startOfMonth(lastMonth),
    endDate: endOfMonth(lastMonth)
  };
};
