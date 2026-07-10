import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Setting } from '@/types';

const SettingsPage = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
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
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: string) => {
    try {
      const response = await window.electron.updateSetting(key, value);
      if (response.success) {
        toast.success('Setting updated successfully');
        setSettings({ ...settings, [key]: value });
      }
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  if (loading) {
    return <div className="text-center p-8 text-ink/55">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Settings</h1>
        <p className="text-[14.5px] text-ink/55 mt-1.5">Configure your store and preferences</p>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input
                    defaultValue={settings.business_name}
                    onBlur={(e) => handleSave('business_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    defaultValue={settings.business_email}
                    onBlur={(e) => handleSave('business_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    defaultValue={settings.business_phone}
                    onBlur={(e) => handleSave('business_phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    defaultValue={settings.business_address}
                    onBlur={(e) => handleSave('business_address', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    defaultValue={settings.currency}
                    onBlur={(e) => handleSave('currency', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency Symbol</Label>
                  <Input
                    defaultValue={settings.currency_symbol}
                    onBlur={(e) => handleSave('currency_symbol', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Tax Rate (%)</Label>
                  <Input
                    type="number"
                    defaultValue={settings.tax_rate}
                    onBlur={(e) => handleSave('tax_rate', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Prefix</Label>
                  <Input
                    defaultValue={settings.invoice_prefix}
                    onBlur={(e) => handleSave('invoice_prefix', e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Invoice Footer</Label>
                  <Input
                    defaultValue={settings.invoice_footer}
                    onBlur={(e) => handleSave('invoice_footer', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>Backup Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Automatic Backup</p>
                    <p className="text-sm text-ink/55">
                      Automatically backup database daily
                    </p>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => window.electron.createBackup()}>
                    Create Backup Now
                  </Button>
                  <Button variant="outline">Restore Backup</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
