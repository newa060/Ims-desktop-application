import { useEffect, useMemo, useState } from 'react';
import { Bell, Loader2, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { StaffMember } from '../../../types';

export interface StaffNotifyModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, modal is locked to this one staff member (Profile page). */
  lockedStaff?: Pick<StaffMember, 'id' | 'firstName' | 'lastName' | 'staffCode' | 'portalUserId'> | null;
  /** Full directory list for multi-select (Management page). */
  staffList?: StaffMember[];
}

/**
 * Compose + send Web Push notification to all or selected staff.
 */
export default function StaffNotifyModal({
  open,
  onClose,
  lockedStaff = null,
  staffList = [],
}: StaffNotifyModalProps) {
  const isLocked = !!lockedStaff;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recipientMode, setRecipientMode] = useState<'all' | 'selected'>(
    isLocked ? 'selected' : 'all'
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(lockedStaff ? [lockedStaff.id] : [])
  );
  const [search, setSearch] = useState('');
  const [pushCapable, setPushCapable] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [loadingCaps, setLoadingCaps] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
    setSearch('');
    setRecipientMode(isLocked ? 'selected' : 'all');
    setSelectedIds(new Set(lockedStaff ? [lockedStaff.id] : []));

    let cancelled = false;
    setLoadingCaps(true);
    (async () => {
      try {
        const res = await window.electron.getStaffPushCapableIds();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          setPushCapable(new Set(res.data as string[]));
        } else {
          setPushCapable(new Set());
        }
      } catch {
        if (!cancelled) setPushCapable(new Set());
      } finally {
        if (!cancelled) setLoadingCaps(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, isLocked, lockedStaff]);

  const activeStaff = useMemo(
    () => staffList.filter((s) => s.isActive),
    [staffList]
  );

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeStaff;
    return activeStaff.filter((s) => {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        s.staffCode?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    });
  }, [activeStaff, search]);

  function toggleId(id: string) {
    if (isLocked) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredStaff.forEach((s) => next.add(s.id));
      return next;
    });
  }

  function clearSelection() {
    if (isLocked && lockedStaff) {
      setSelectedIds(new Set([lockedStaff.id]));
      return;
    }
    setSelectedIds(new Set());
  }

  async function handleSend() {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      toast.error('Title and message are required');
      return;
    }

    const mode = isLocked ? 'selected' : recipientMode;
    const ids = isLocked
      ? lockedStaff
        ? [lockedStaff.id]
        : []
      : mode === 'selected'
        ? Array.from(selectedIds)
        : undefined;

    if (mode === 'selected' && (!ids || ids.length === 0)) {
      toast.error('Select at least one staff member');
      return;
    }

    setSending(true);
    try {
      const res = await window.electron.sendStaffNotification({
        title: t,
        body: b,
        recipientMode: mode,
        staffIds: ids,
      });
      if (!res.success) {
        toast.error(res.error || 'Failed to send notification');
        return;
      }
      const sent = res.data?.sent ?? 0;
      const skipped = res.data?.skipped ?? 0;
      const failed = res.data?.failed ?? 0;
      toast.success(
        `Sent to ${sent} · skipped ${skipped} (no device) · failed ${failed}`
      );
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-olive/20 flex items-center justify-center">
              <Bell size={16} strokeWidth={2} className="text-olive-deep" />
            </div>
            <div>
              <h3 className="font-display font-bold text-[17px] text-ink">
                Send Notification
              </h3>
              <p className="text-[12px] text-ink/45 mt-0.5">
                {isLocked && lockedStaff
                  ? `To ${lockedStaff.firstName} ${lockedStaff.lastName}`
                  : 'Push to staff PWA devices'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink/40 hover:bg-ink/[0.05] hover:text-ink transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {!isLocked && (
            <div>
              <label className="text-[12px] font-semibold text-ink/55 uppercase tracking-wide">
                Recipients
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientMode('all')}
                  className={`flex-1 h-9 rounded-[9px] text-[13px] font-semibold border transition-colors ${
                    recipientMode === 'all'
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-white text-ink/65 border-ink/[0.12] hover:border-ink/25'
                  }`}
                >
                  All staff
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode('selected')}
                  className={`flex-1 h-9 rounded-[9px] text-[13px] font-semibold border transition-colors ${
                    recipientMode === 'selected'
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-white text-ink/65 border-ink/[0.12] hover:border-ink/25'
                  }`}
                >
                  Selected
                </button>
              </div>
            </div>
          )}

          {!isLocked && recipientMode === 'selected' && (
            <div className="border border-ink/[0.1] rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-ink/[0.07] flex items-center gap-2">
                <Search size={14} className="text-ink/35 flex-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff…"
                  className="flex-1 text-[13px] outline-none bg-transparent placeholder:text-ink/35"
                />
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-[11px] font-semibold text-olive-deep hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-[11px] font-semibold text-ink/40 hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto">
                {loadingCaps && (
                  <div className="py-6 flex justify-center text-ink/35">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                )}
                {!loadingCaps && filteredStaff.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-ink/40">
                    No staff found
                  </p>
                )}
                {filteredStaff.map((s) => {
                  const checked = selectedIds.has(s.id);
                  const canPush = pushCapable.has(s.id);
                  const hasPortal = !!s.portalUserId;
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-ink/[0.025] cursor-pointer border-b border-ink/[0.04] last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleId(s.id)}
                        className="rounded border-ink/25"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="text-[11px] text-ink/40 truncate">
                          {s.staffCode}
                          {!hasPortal && ' · no portal login'}
                          {hasPortal && !canPush && ' · notifications off'}
                        </p>
                      </div>
                      {canPush ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-success-text bg-success-bg px-2 py-0.5 rounded-full">
                          Push ready
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-ink/40 bg-ink/[0.06] px-2 py-0.5 rounded-full">
                          No device
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="px-3 py-2 bg-ink/[0.02] text-[11px] text-ink/45">
                {selectedIds.size} selected
              </div>
            </div>
          )}

          {isLocked && lockedStaff && (
            <div className="rounded-xl border border-ink/[0.08] bg-ink/[0.02] px-3.5 py-3 text-[13px]">
              <span className="font-semibold text-ink">
                {lockedStaff.firstName} {lockedStaff.lastName}
              </span>
              <span className="text-ink/40"> · {lockedStaff.staffCode}</span>
              {!lockedStaff.portalUserId && (
                <p className="text-[12px] text-warning-text mt-1">
                  No portal login — they cannot receive push until an account is created.
                </p>
              )}
              {lockedStaff.portalUserId && !pushCapable.has(lockedStaff.id) && (
                <p className="text-[12px] text-ink/50 mt-1">
                  They haven&apos;t enabled notifications on a device yet (will be skipped).
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-[12px] font-semibold text-ink/55 uppercase tracking-wide">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. Schedule update"
              className="mt-1.5 w-full h-10 px-3 rounded-[9px] border border-ink/[0.12] text-[13px] text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-olive/50"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-ink/55 uppercase tracking-wide">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Write a short message…"
              className="mt-1.5 w-full px-3 py-2.5 rounded-[9px] border border-ink/[0.12] text-[13px] text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-olive/50 resize-none"
            />
            <p className="text-[11px] text-ink/35 mt-1 text-right">
              {body.length}/500
            </p>
          </div>

          <p className="text-[11.5px] text-ink/40 leading-relaxed">
            Android/Desktop Chrome supported. iPhone requires iOS 16.4+ and Add to Home Screen.
            Staff without an active device subscription are skipped.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-ink/[0.07] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-9 px-4 rounded-[9px] border border-ink/[0.12] text-[13px] font-semibold text-ink/65 hover:border-ink/25 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="h-9 px-4 rounded-[9px] bg-olive text-ink text-[13px] font-semibold hover:bg-[#bcc65c] transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {sending && <Loader2 size={14} className="animate-spin" />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
