import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { RefreshCw, Trash2, RotateCcw, Database } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

const SettingsPage = () => {
  const { settings, updateSetting, refreshSettings } = useSettings();
  const [appVersion, setAppVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadBackups = useCallback(async () => {
    if (!window.electron?.getBackups) return;
    setLoadingBackups(true);
    try {
      const res = await window.electron.getBackups();
      if (res.success) {
        setBackups(res.data);
      }
    } catch (e) {
      console.error('Failed to load backups list:', e);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
    loadBackups();
    // Get current app version
    if (window.electron?.updaterGetVersion) {
      window.electron.updaterGetVersion().then((v: string) => setAppVersion(v));
    }
  }, [refreshSettings, loadBackups]);

  const handleCheckForUpdates = async () => {
    if (!window.electron?.updaterCheck) {
      toast.info('Auto-update is only available in the packaged app.');
      return;
    }
    setCheckingUpdate(true);
    try {
      const res = await window.electron.updaterCheck();
      if (!res.success) {
        // dev mode returns a friendly info message, not a real error
        if (res.error?.includes('dev mode')) {
          toast.info('Update checks only work in the installed app, not during development.');
        } else {
          toast.error('Update check failed: ' + res.error);
        }
      } else {
        toast.success('Update check complete — watch for a notification if a new version is available.');
      }
    } catch {
      toast.error('Update check failed.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleSave = async (key: string, value: string) => {
    try {
      const success = await updateSetting(key, value);
      if (success) {
        toast.success('Setting updated successfully');
      } else {
        toast.error('Failed to update setting');
      }
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    toast.info('Creating system backup...');
    try {
      const res = await window.electron.createBackup();
      if (res.success) {
        toast.success(`Backup created successfully: ${res.data.fileName}`);
        loadBackups();
      } else {
        toast.error(res.error || 'Failed to create backup');
      }
    } catch {
      toast.error('An error occurred during backup creation');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSelectAndRestore = async () => {
    if (!confirm('WARNING: Restoring a backup will overwrite your current Supabase database tables! Are you sure you want to proceed?')) {
      return;
    }
    setIsRestoring(true);
    toast.info('Restoring database tables...');
    try {
      const res = await window.electron.selectAndRestoreBackup();
      if (res.success) {
        toast.success('Database backup restored successfully!');
        refreshSettings();
      } else {
        toast.error(res.error || 'Restore failed');
      }
    } catch {
      toast.error('An error occurred during database restoration');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreFromList = async (filePath: string) => {
    if (!confirm('WARNING: Restoring a backup will overwrite your current Supabase database tables! Are you sure you want to proceed?')) {
      return;
    }
    setIsRestoring(true);
    toast.info('Restoring database tables...');
    try {
      const res = await window.electron.restoreBackup(filePath);
      if (res.success) {
        toast.success('Database backup restored successfully!');
        refreshSettings();
      } else {
        toast.error(res.error || 'Restore failed');
      }
    } catch {
      toast.error('An error occurred during database restoration');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete the backup file "${fileName}"?`)) {
      return;
    }
    try {
      const res = await window.electron.deleteBackup(fileName);
      if (res.success) {
        toast.success('Backup file deleted successfully');
        loadBackups();
      } else {
        toast.error(res.error || 'Failed to delete backup file');
      }
    } catch {
      toast.error('An error occurred');
    }
  };


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
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Backup & Recovery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="space-y-1">
                    <p className="font-medium flex items-center gap-2"><Database size={16} className="text-olive" /> Create Local Backup</p>
                    <p className="text-sm text-ink/55">
                      Exports all core catalog, sales, inventory, and setting tables to a timestamped JSON file.
                    </p>
                  </div>
                  <Button onClick={handleCreateBackup} disabled={isBackingUp || isRestoring}>
                    {isBackingUp ? 'Backing Up...' : 'Create Backup Now'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium flex items-center gap-2"><RotateCcw size={16} className="text-primary" /> Import / Restore Backup File</p>
                    <p className="text-sm text-ink/55">
                      Select a backup JSON file from your system to upload and restore the database to a previous state.
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleSelectAndRestore} disabled={isBackingUp || isRestoring}>
                    {isRestoring ? 'Restoring...' : 'Select File & Restore'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Backups</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBackups ? (
                <div className="flex justify-center py-6">
                  <RefreshCw className="animate-spin text-ink/40" />
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-8 text-ink/45 text-sm bg-paper/20 rounded-lg border border-dashed">
                  No local backup files found. Backup files will be stored in your application's folder.
                </div>
              ) : (
                <div className="border rounded-[10px] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#faf9f5] border-b text-ink/60 text-xs">
                        <th className="py-2.5 px-4 text-left font-semibold">Backup File</th>
                        <th className="py-2.5 px-4 text-left font-semibold">Date Created</th>
                        <th className="py-2.5 px-4 text-right font-semibold">File Size</th>
                        <th className="py-2.5 px-4 text-center font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((b) => (
                        <tr key={b.fileName} className="border-b last:border-0 hover:bg-paper/40">
                          <td className="py-3 px-4 font-mono text-xs text-ink/75">{b.fileName}</td>
                          <td className="py-3 px-4 text-ink/60">{new Date(b.createdAt).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-ink/60">
                            {b.size > 1024 * 1024 
                              ? `${(b.size / (1024 * 1024)).toFixed(1)} MB` 
                              : `${(b.size / 1024).toFixed(1)} KB`}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                                onClick={() => handleRestoreFromList(b.path)}
                                disabled={isBackingUp || isRestoring}
                              >
                                <RotateCcw size={14} />
                                Restore
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-danger-text hover:bg-danger/10"
                                onClick={() => handleDeleteBackup(b.fileName)}
                                disabled={isBackingUp || isRestoring}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates">
          <Card>
            <CardHeader>
              <CardTitle>Application Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between py-3 border-b border-ink/[0.08]">
                <div>
                  <p className="text-sm font-medium text-ink">Current Version</p>
                  <p className="text-xs text-ink/50 mt-0.5">{appVersion || '—'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">Check for Updates</p>
                  <p className="text-xs text-ink/50 mt-0.5">
                    Updates download in the background and install on next restart
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCheckForUpdates}
                  disabled={checkingUpdate}
                  className="shrink-0"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
                  {checkingUpdate ? 'Checking…' : 'Check Now'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
