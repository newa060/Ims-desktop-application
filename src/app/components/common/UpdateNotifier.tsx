/**
 * UpdateNotifier — listens for electron-updater events forwarded through the
 * preload bridge and shows a sticky banner at the bottom of the screen.
 *
 * States:
 *   idle         → nothing shown
 *   available    → "v1.2.3 is available — Download" banner
 *   downloading  → progress bar
 *   ready        → "Downloaded — Restart to install" banner
 *   error        → brief error toast (auto-dismisses)
 */

import { useEffect, useState } from 'react';
import { Download, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

const UpdateNotifier = () => {
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only available in packaged app (preload injects these)
    if (!window.electron?.onUpdateAvailable) return;

    window.electron.onUpdateAvailable(({ version: v }) => {
      setVersion(v);
      setState('available');
      setDismissed(false);
    });

    window.electron.onUpdateDownloadProgress(({ percent: p }) => {
      setPercent(p);
      setState('downloading');
    });

    window.electron.onUpdateDownloaded(({ version: v }) => {
      setVersion(v);
      setState('ready');
    });

    window.electron.onUpdateError(({ message }) => {
      setErrorMsg(message);
      setState('error');
      // Auto-dismiss error after 8 seconds
      setTimeout(() => setState('idle'), 8000);
    });
  }, []);

  const handleDownload = async () => {
    setState('downloading');
    setPercent(0);
    await window.electron.updaterDownload();
  };

  const handleInstall = () => {
    window.electron.updaterInstall();
  };

  if (dismissed || state === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[380px] shadow-xl rounded-xl border border-ink/10 bg-white overflow-hidden">
      {/* Available */}
      {state === 'available' && (
        <div className="flex items-center gap-3 px-4 py-3">
          <Download size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-ink">Update available — v{version}</p>
            <p className="text-[11px] text-ink/50">Download in the background</p>
          </div>
          <Button size="sm" className="shrink-0 text-xs h-7 px-3" onClick={handleDownload}>
            Download
          </Button>
          <button onClick={() => setDismissed(true)} className="text-ink/30 hover:text-ink/60 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Downloading */}
      {state === 'downloading' && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={14} className="text-primary animate-spin shrink-0" />
            <p className="text-[13px] font-semibold text-ink">Downloading update… {percent}%</p>
          </div>
          <div className="w-full h-1.5 bg-ink/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Ready to install */}
      {state === 'ready' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-success-text/5 border-t-2 border-success-text/20">
          <CheckCircle size={16} className="text-success-text shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-ink">v{version} ready to install</p>
            <p className="text-[11px] text-ink/50">The app will restart automatically</p>
          </div>
          <Button size="sm" className="shrink-0 text-xs h-7 px-3 bg-success-text hover:bg-success-text/90" onClick={handleInstall}>
            Restart
          </Button>
          <button onClick={() => setDismissed(true)} className="text-ink/30 hover:text-ink/60 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-danger-text/5">
          <AlertCircle size={16} className="text-danger-text shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-ink">Update failed</p>
            <p className="text-[11px] text-ink/50 truncate">{errorMsg}</p>
          </div>
          <button onClick={() => setState('idle')} className="text-ink/30 hover:text-ink/60 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default UpdateNotifier;
