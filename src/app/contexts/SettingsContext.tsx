import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Setting } from '@/types';

interface SettingsContextType {
  settings: Record<string, string>;
  loading: boolean;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  formatCurrency: (amount: number | string) => string;
  refreshSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const response = await window.electron.getSettings();
      if (response.success) {
        const settingsMap: Record<string, string> = {};
        response.data.forEach((setting: Setting) => {
          settingsMap[setting.key] = setting.value;
        });
        setSettings(settingsMap);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = async (key: string, value: string) => {
    try {
      const response = await window.electron.updateSetting(key, value);
      if (response.success) {
        setSettings((prev) => ({ ...prev, [key]: value }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update setting:', error);
      return false;
    }
  };

  const formatCurrency = useCallback((amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);

    const symbol = settings.currency_symbol || '$';
    const trimmedSymbol = symbol.trim();
    // If the symbol has length > 1 (e.g. "Rs." or "NPR"), add a space. If it is a symbol like "$", don't add space.
    const needsSpace = trimmedSymbol.length > 1;
    return needsSpace ? `${trimmedSymbol} ${formatted}` : `${trimmedSymbol}${formatted}`;
  }, [settings.currency_symbol]);

  const currency = settings.currency || 'USD';
  const currencySymbol = settings.currency_symbol || '$';
  const taxRate = parseFloat(settings.tax_rate || '0');

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        currency,
        currencySymbol,
        taxRate,
        formatCurrency,
        refreshSettings: loadSettings,
        updateSetting,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
