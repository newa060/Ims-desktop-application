import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Users,
  CalendarCheck,
  CalendarOff,
  ClipboardList,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  Calendar,
  ChevronDown,
  ListTodo,
  Bell,
  Search as SearchIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StaffMember, StaffDirectoryStats, StaffDocVerificationStatus, StaffTask } from '../../types';
import StaffNotifyModal from '../components/staff/StaffNotifyModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = 'Complete' | 'Pending' | 'Missing';

type StatCardModal = 'presentToday' | 'onLeave' | 'pendingTasks' | null;

interface PendingTaskRow extends StaffTask {
  staffFirstName: string;
  staffLastName:  string;
  staffCode:      string;
}

const PAGE_SIZE = 5;

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** Generate avatar initials from first and last name */
const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

/** Generate consistent color from staff ID */
const getAvatarColor = (id: string): string => {
  const colors = [
    '#c9d16b', '#93b4f0', '#f0b393', '#b393f0',
    '#93f0c4', '#f093b3', '#f0d993', '#93dff0',
  ];
  // Simple hash of id string to pick a consistent color
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/** Map verification status to doc status badge */
const mapDocStatus = (verificationStatus?: StaffDocVerificationStatus): DocStatus => {
  if (!verificationStatus) return 'Missing';
  switch (verificationStatus) {
    case 'Verified': return 'Complete';
    case 'Pending': return 'Pending';
    case 'Rejected': return 'Missing';
    default: return 'Missing';
  }
};

// ─── Staff avatar — handles photo with React-state error fallback ─────────────
// Using a component (not inline) so useState can track load failure per-row
// without causing infinite re-render loops from DOM mutations.
const StaffAvatar = ({
  photoUrl,
  initials,
  avatarColor,
  size = 'sm',
}: {
  photoUrl?: string;
  initials: string;
  avatarColor: string;
  size?: 'sm' | 'lg';
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const dim    = size === 'lg' ? 'w-20 h-20 text-[26px]' : 'w-9 h-9 text-[13px]';
  const shared = `${dim} rounded-full flex-none`;

  if (photoUrl && !imgFailed) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className={`${shared} object-cover`}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div
      className={`${shared} flex items-center justify-center font-display font-bold text-ink`}
      style={{ backgroundColor: avatarColor }}
    >
      {initials}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'On Leave';

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'On Leave'];

const BADGE_STYLES: Record<string, string> = {
  Present:    'bg-success-bg text-success-text',
  Absent:     'bg-danger-bg text-danger-text',
  'On Leave': 'bg-warning-bg text-warning-text',
  Late:       'bg-warning-bg text-warning-text',
};

const DOT_STYLES: Record<string, string> = {
  Present:    'bg-success-text',
  Absent:     'bg-danger-text',
  'On Leave': 'bg-warning-text',
  Late:       'bg-warning-text',
};

const AttendanceBadge = ({ status }: { status: string }) => {
  const style = BADGE_STYLES[status] || 'bg-ink/10 text-ink/60';
  const dot   = DOT_STYLES[status]   || 'bg-ink/40';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-none ${dot}`} />
      {status}
    </span>
  );
};

// ─── Attendance Toggle (interactive badge + portal dropdown) ─────────────────

interface AttendanceToggleProps {
  memberId: string;
  memberName: string;
  currentStatus: string;
  onStatusChange: (memberId: string, newStatus: AttendanceStatus) => void;
}

const AttendanceToggle = ({ memberId, currentStatus, onStatusChange }: AttendanceToggleProps) => {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top:  rect.bottom + window.scrollY + 6,
      left: rect.left  + window.scrollX,
    });
    setOpen((v) => !v);
  };

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  const badgeStyle = BADGE_STYLES[currentStatus] || 'bg-ink/10 text-ink/60';
  const dotStyle   = DOT_STYLES[currentStatus]   || 'bg-ink/40';

  const dropdown = (
    <div
      data-attendance-dropdown
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
      className="bg-white border border-ink/[0.12] rounded-xl shadow-xl overflow-hidden w-[168px]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-ink/[0.06]">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink/35">
          Set Attendance
        </p>
      </div>

      {/* Options */}
      <div className="py-1">
        {ATTENDANCE_OPTIONS.map((option) => {
          const isActive = option === currentStatus;
          const bg   = BADGE_STYLES[option] || 'bg-ink/[0.06] text-ink/55';
          const dot  = DOT_STYLES[option]   || 'bg-ink/40';

          return (
            <button
              key={option}
              onMouseDown={(e) => {
                e.stopPropagation();
                setOpen(false);
                if (!isActive) onStatusChange(memberId, option);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] transition-colors ${
                isActive
                  ? 'opacity-40 cursor-default'
                  : 'hover:bg-ink/[0.035] cursor-pointer'
              }`}
            >
              {/* Colored dot */}
              <span className={`w-2 h-2 rounded-full flex-none ${dot}`} />

              {/* Label */}
              <span className="flex-1 text-left font-medium text-ink">{option}</span>

              {/* Active checkmark */}
              {isActive && (
                <CheckCircle2 size={13} strokeWidth={2} className="text-ink/30 flex-none" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Trigger badge */}
      <button
        ref={triggerRef}
        onClick={openDropdown}
        className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer select-none hover:ring-2 hover:ring-offset-1 hover:ring-ink/20 ${badgeStyle}`}
        title="Click to change attendance"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-none ${dotStyle}`} />
        {currentStatus}
        <ChevronDown size={10} strokeWidth={2.5} className="opacity-50" />
      </button>

      {/* Portal dropdown — renders outside overflow containers */}
      {open && createPortal(dropdown, document.body)}
    </>
  );
};

const DocIndicator = ({ status }: { status: DocStatus }) => {
  const config: Record<DocStatus, { icon: React.ReactNode; label: string; className: string }> = {
    Complete: {
      icon: <CheckCircle2 size={13} strokeWidth={2} />,
      label: 'Complete',
      className: 'text-success-text bg-success-bg',
    },
    Pending: {
      icon: <Clock size={13} strokeWidth={2} />,
      label: 'Pending',
      className: 'text-warning-text bg-warning-bg',
    },
    Missing: {
      icon: <AlertCircle size={13} strokeWidth={2} />,
      label: 'Missing',
      className: 'text-danger-text bg-danger-bg',
    },
  };
  const { icon, label, className } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${className}`}
      title={`ID Verification: ${label}`}
    >
      {icon}
      {label}
    </span>
  );
};

// ─── Stat Card Modal ──────────────────────────────────────────────────────────

interface StatModalProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  onClose: () => void;
  loading: boolean;
  children: React.ReactNode;
}

const StatModal = ({ title, subtitle, icon, iconBg, onClose, loading, children }: StatModalProps) => (
  <div
    className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-lg mx-4 shadow-2xl max-h-[82vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-ink/[0.08] flex items-center gap-4 flex-none">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-[17px] text-ink">{title}</h3>
          <p className="text-[12.5px] text-ink/45 mt-0.5">{subtitle}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-ink/[0.06] transition-colors flex-none"
        >
          <X size={16} strokeWidth={2} className="text-ink/50" />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 px-6 py-4">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-ink/20 border-t-olive rounded-full animate-spin" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  </div>
);

// ─── Attendance List Item ─────────────────────────────────────────────────────

interface AttendanceListItemProps {
  member: StaffMember;
  onNavigate: (id: string) => void;
}

const AttendanceListItem = ({ member, onNavigate }: AttendanceListItemProps) => {
  const initials = getInitials(member.firstName, member.lastName);
  const color    = getAvatarColor(member.id);

  return (
    <div className="flex items-center gap-3 py-3 border-b border-ink/[0.06] last:border-b-0">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-[13px] text-ink flex-none"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-ink truncate">
          {member.firstName} {member.lastName}
        </p>
        <p className="text-[11.5px] text-ink/45 mt-0.5">
          {member.jobTitle}
          {member.branch ? ` · ${member.branch}` : ''}
        </p>
      </div>
      <button
        onClick={() => onNavigate(member.id)}
        className="flex items-center gap-1 text-[12px] font-semibold text-olive hover:text-[#8a9b3f] transition-colors flex-none"
      >
        View Profile
        <ArrowRight size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
};

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  high:   { label: 'High',   className: 'bg-danger-bg text-danger-text',   dot: 'bg-danger-text'   },
  medium: { label: 'Medium', className: 'bg-warning-bg text-warning-text', dot: 'bg-warning-text'  },
  low:    { label: 'Low',    className: 'bg-ink/[0.07] text-ink/55',       dot: 'bg-ink/40'        },
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const cfg = PRIORITY_CONFIG[priority?.toLowerCase()] ?? PRIORITY_CONFIG.low;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-none ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const StaffManagementPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  
  // State for data
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState<StaffDirectoryStats | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stat card modal state
  const [activeModal, setActiveModal] = useState<StatCardModal>(null);

  // Filter state for Staff Directory
  const [filterEmploymentType, setFilterEmploymentType] = useState<string>('');
  const [filterAttendance, setFilterAttendance]         = useState<string>('');
  const [showFilterPanel, setShowFilterPanel]           = useState(false);  const [modalLoading, setModalLoading] = useState(false);
  const [presentList, setPresentList]     = useState<StaffMember[]>([]);
  const [onLeaveList, setOnLeaveList]     = useState<StaffMember[]>([]);
  const [pendingTasks, setPendingTasks]   = useState<PendingTaskRow[]>([]);

  // Quick attendance toggle state
  const [pendingAttendance, setPendingAttendance] = useState<{
    memberId: string;
    memberName: string;
    newStatus: AttendanceStatus;
    currentStatus: string;
  } | null>(null);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Quick assign task state
  const [showAssignTask, setShowAssignTask]   = useState(false);
  const [showNotify, setShowNotify]           = useState(false);
  const [allStaffList, setAllStaffList]       = useState<StaffMember[]>([]);
  const [allStaffLoading, setAllStaffLoading] = useState(false);
  const [staffSearch, setStaffSearch]         = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [taskForm, setTaskForm] = useState({
    title:       '',
    description: '',
    priority:    'Medium' as 'High' | 'Medium' | 'Low',
    dueDate:     '',
    dueTime:     '',
  });
  const [taskFormErrors, setTaskFormErrors] = useState<Record<string, string>>({});
  const [savingTask, setSavingTask]         = useState(false);

  // Fetch staff list
  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await window.electron.getStaff({
        page,
        limit: PAGE_SIZE,
        search: search.trim(),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (response.success && response.data) {
        let list: StaffMember[] = response.data.data || [];
        // Client-side filter by employment type and attendance
        if (filterEmploymentType) list = list.filter(m => m.employmentType === filterEmploymentType);
        if (filterAttendance)     list = list.filter(m => m.currentAttendanceStatus === filterAttendance);
        setStaff(list);
        setTotalCount(filterEmploymentType || filterAttendance ? list.length : response.data.total || 0);
      } else {
        throw new Error(response.error || 'Failed to fetch staff');
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
      setError(err instanceof Error ? err.message : 'Failed to load staff');
      setStaff([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await window.electron.getStaffStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Initial load and refresh on navigation back
  useEffect(() => {
    fetchStaff();
    fetchStats();

    // ── One-time schema diagnostic (dev only) ──────────────────────────────
    if (process.env.NODE_ENV !== 'production') {
      window.electron.inspectStaffSchema().then((result: any) => {
        console.log('=== SCHEMA INSPECTION RESULT ===');
        console.log(JSON.stringify(result?.data, null, 2));
      }).catch((err: any) => {
        console.error('Schema inspection failed:', err);
      });
    }
    
    // Listen for custom refresh event (can be triggered by other components)
    const handleRefresh = () => {
      fetchStaff();
      fetchStats();
    };
    
    window.addEventListener('staff:refresh', handleRefresh);
    return () => window.removeEventListener('staff:refresh', handleRefresh);
  }, [page, search, filterEmploymentType, filterAttendance]);

  // Handle search with debounce
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // Open a stat card modal and fetch its data
  const openModal = async (modal: StatCardModal) => {
    setActiveModal(modal);
    setModalLoading(true);
    try {
      if (modal === 'presentToday') {
        const res = await window.electron.getStaffPresentToday();
        if (res.success) setPresentList(res.data || []);
      } else if (modal === 'onLeave') {
        const res = await window.electron.getStaffOnLeave();
        if (res.success) setOnLeaveList(res.data || []);
      } else if (modal === 'pendingTasks') {
        const res = await window.electron.getStaffAllPendingTasks();
        if (res.success) setPendingTasks(res.data || []);
      }
    } catch (err) {
      console.error('Error loading modal data:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => setActiveModal(null);

  // Export staff list as CSV
  const handleExport = () => {
    if (staff.length === 0) { return; }
    const headers = ['Staff Code', 'First Name', 'Last Name', 'Job Title', 'Email', 'Phone', 'Branch', 'Employment Type', 'Attendance Status', 'Joining Date'];
    const rows = staff.map((m) => [
      m.staffCode,
      m.firstName,
      m.lastName,
      m.jobTitle,
      m.email ?? '',
      m.phone  ?? '',
      m.branch ?? '',
      m.employmentType,
      m.currentAttendanceStatus,
      m.joiningDate ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `staff-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick attendance toggle handlers
  const handleAttendanceChangeRequest = (memberId: string, newStatus: AttendanceStatus) => {
    const member = staff.find((m) => m.id === memberId);
    if (!member) return;
    setPendingAttendance({
      memberId,
      memberName: `${member.firstName} ${member.lastName}`,
      newStatus,
      currentStatus: member.currentAttendanceStatus,
    });
  };

  const confirmAttendanceChange = async () => {
    if (!pendingAttendance) return;
    try {
      setSavingAttendance(true);
      const today = new Date().toISOString().split('T')[0];

      // Map display status to attendance record status (Late stays as 'Late')
      const statusMap: Record<AttendanceStatus, string> = {
        Present:    'Present',
        Absent:     'Absent',
        Late:       'Late',
        'On Leave': 'On Leave',
      };

      const response = await window.electron.recordStaffAttendance({
        staffId:        pendingAttendance.memberId,
        attendanceDate: today,
        status:         statusMap[pendingAttendance.newStatus],
      });

      if (response.success) {
        // Update the local staff list immediately
        setStaff((prev) =>
          prev.map((m) =>
            m.id === pendingAttendance.memberId
              ? { ...m, currentAttendanceStatus: pendingAttendance.newStatus }
              : m
          )
        );

        toast.success(`${pendingAttendance.memberName} marked as ${pendingAttendance.newStatus}`);

        // Refresh stats so Present Today / On Leave cards update
        fetchStats();

        // Broadcast so the individual profile's attendance tab also stays in sync
        window.dispatchEvent(new Event('staff:refresh'));
      } else {
        toast.error(response.error || 'Failed to update attendance');
      }
    } catch (err) {
      console.error('Error updating attendance:', err);
      toast.error('Failed to update attendance');
    } finally {
      setSavingAttendance(false);
      setPendingAttendance(null);
    }
  };

  const cancelAttendanceChange = () => setPendingAttendance(null);

  const openNotify = async () => {
    setShowNotify(true);
    setAllStaffLoading(true);
    try {
      const res = await window.electron.getStaff({
        page: 1,
        limit: 200,
        search: '',
        sortBy: 'firstName',
        sortOrder: 'asc',
      });
      if (res.success && res.data) {
        setAllStaffList(res.data.data || []);
      }
    } catch (err) {
      console.error('Error loading staff list for notify:', err);
      toast.error('Failed to load staff list');
    } finally {
      setAllStaffLoading(false);
    }
  };

  // ── Quick Assign Task handlers ─────────────────────────────────────────────

  const openAssignTask = async () => {
    setShowAssignTask(true);
    setAllStaffLoading(true);
    setStaffSearch('');
    setSelectedStaffIds(new Set());
    setTaskForm({ title: '', description: '', priority: 'Medium', dueDate: '', dueTime: '' });
    setTaskFormErrors({});
    try {
      // Fetch all active staff (high limit, no pagination needed for selector)
      const res = await window.electron.getStaff({
        page: 1, limit: 200, search: '', sortBy: 'firstName', sortOrder: 'asc',
      });
      if (res.success && res.data) {
        setAllStaffList(res.data.data || []);
      }
    } catch (err) {
      console.error('Error loading staff list:', err);
      toast.error('Failed to load staff list');
    } finally {
      setAllStaffLoading(false);
    }
  };

  const closeAssignTask = () => {
    if (savingTask) return;
    setShowAssignTask(false);
    setSelectedStaffIds(new Set());
    setTaskFormErrors({});
  };

  const toggleStaffSelection = (id: string) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssignTask = async () => {
    // Validate
    const errors: Record<string, string> = {};
    if (!taskForm.title.trim())        errors.title = 'Task title is required';
    if (selectedStaffIds.size === 0)   errors.staff = 'Select at least one staff member';
    if (Object.keys(errors).length > 0) {
      setTaskFormErrors(errors);
      return;
    }

    try {
      setSavingTask(true);
      const targets = Array.from(selectedStaffIds);

      // Combine date + time into a single ISO string when both are provided
      let combinedDueDate: string | undefined;
      if (taskForm.dueDate) {
        combinedDueDate = taskForm.dueTime
          ? new Date(`${taskForm.dueDate}T${taskForm.dueTime}`).toISOString()
          : taskForm.dueDate;
      }

      // Create one task per selected staff member (sequential — keeps errors isolated)
      const results = await Promise.allSettled(
        targets.map((staffId) =>
          window.electron.createStaffTask({
            staffId,
            title:       taskForm.title.trim(),
            description: taskForm.description.trim() || undefined,
            priority:    taskForm.priority,
            status:      'pending',
            dueDate:     combinedDueDate,
          })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled' && (r.value as any).success).length;
      const failed    = targets.length - succeeded;

      if (succeeded > 0) {
        toast.success(
          succeeded === 1
            ? 'Task assigned successfully'
            : `Task assigned to ${succeeded} staff member${succeeded > 1 ? 's' : ''}`
        );
        if (failed > 0) toast.error(`Failed to assign to ${failed} member${failed > 1 ? 's' : ''}`);

        // Refresh stats and pending tasks list
        fetchStats();
        window.dispatchEvent(new Event('staff:refresh'));
        closeAssignTask();
      } else {
        toast.error('Failed to assign task. Please try again.');
      }
    } catch (err) {
      console.error('Error assigning task:', err);
      toast.error('Failed to assign task');
    } finally {
      setSavingTask(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <>
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[36px] leading-[1.15] tracking-tight text-ink">
            Staff Management
          </h1>
          <p className="text-[14.5px] text-ink/55 mt-2">
            Manage your team, tasks, and payroll.
          </p>
        </div>

        {/* Right side: search + icons + profile + CTA */}
        <div className="flex items-center gap-3 flex-none mt-1">
          {/* Search bar */}
          <div className="relative">
            <Search
              size={15}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search staff records..."
              className="h-9 pl-9 pr-4 rounded-[9px] border border-ink/[0.12] bg-white text-[13px] text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-olive/50 w-56 transition"
            />
          </div>

          {/* Secondary CTA — Notify */}
          <button
            onClick={openNotify}
            className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-ink/[0.14] bg-white text-[13px] font-semibold text-ink/70 hover:text-ink hover:border-ink/30 transition-colors flex-none"
          >
            <Bell size={15} strokeWidth={2} />
            Notify
          </button>

          {/* Secondary CTA — Assign Task */}
          <button
            onClick={openAssignTask}
            className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-ink/[0.14] bg-white text-[13px] font-semibold text-ink/70 hover:text-ink hover:border-ink/30 transition-colors flex-none"
          >
            <ListTodo size={15} strokeWidth={2} />
            Assign Task
          </button>

          {/* Primary CTA */}
          <button
            onClick={() => navigate('/staff/new')}
            className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] bg-ink text-paper text-[13px] font-semibold hover:bg-ink/85 transition-colors flex-none"
          >
            <Plus size={15} strokeWidth={2.5} />
            Add Staff
          </button>
        </div>
      </div>

      {/* ── Summary Stat Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Staff */}
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Total Staff</span>
            <Users size={16} strokeWidth={1.6} className="text-ink/35" />
          </div>
          <div className="font-display font-bold text-[28px] text-ink">
            {stats?.totalStaff ?? 0}
          </div>
          {stats && stats.newThisMonth > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1 bg-success-bg text-success-text text-[11.5px] font-semibold px-2 py-0.5 rounded-full">
              +{stats.newThisMonth} this month
            </div>
          )}
        </div>

        {/* Present Today */}
        <button
          onClick={() => openModal('presentToday')}
          className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] text-left hover:border-ink/20 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Present Today</span>
            <CalendarCheck size={16} strokeWidth={1.6} className="text-success-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-success-text">
            {stats?.presentToday ?? 0}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 bg-success-bg text-success-text text-[11.5px] font-semibold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-success-text animate-pulse flex-none" />
              Live
            </div>
            <span className="text-[11.5px] text-ink/35 group-hover:text-olive transition-colors font-medium">
              View list →
            </span>
          </div>
        </button>

        {/* On Leave */}
        <button
          onClick={() => openModal('onLeave')}
          className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] text-left hover:border-ink/20 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">On Leave</span>
            <CalendarOff size={16} strokeWidth={1.6} className="text-warning-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-warning-text">
            {stats?.onLeave ?? 0}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="h-[22px]" />
            <span className="text-[11.5px] text-ink/35 group-hover:text-olive transition-colors font-medium">
              View list →
            </span>
          </div>
        </button>

        {/* Pending Tasks */}
        <button
          onClick={() => openModal('pendingTasks')}
          className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] text-left hover:border-ink/20 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Pending Tasks</span>
            <ClipboardList size={16} strokeWidth={1.6} className="text-danger-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-danger-text">
            {stats?.pendingTasksCount ?? 0}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            {stats && stats.pendingTasksCount > 0 ? (
              <div className="inline-flex items-center gap-1 bg-danger-bg text-danger-text text-[11.5px] font-semibold px-2 py-0.5 rounded-full">
                Needs Attention
              </div>
            ) : (
              <div className="h-[22px]" />
            )}
            <span className="text-[11.5px] text-ink/35 group-hover:text-olive transition-colors font-medium">
              View list →
            </span>
          </div>
        </button>
      </div>

      {/* ── Staff Directory Table ─────────────────────────────────────────────── */}
      <div className="bg-white border border-ink/[0.08] rounded-2xl">
        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/[0.07]">
          <div>
            <h2 className="font-display font-bold text-[18px] text-ink">Staff Directory</h2>
            <p className="text-[13px] text-ink/45 mt-0.5">
              {totalCount} staff member{totalCount !== 1 ? 's' : ''} found
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilterPanel((v) => !v)}
              className={`flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] border text-[12.5px] font-medium transition-colors bg-white ${
                showFilterPanel || filterEmploymentType || filterAttendance
                  ? 'border-olive text-olive'
                  : 'border-ink/[0.12] text-ink/65 hover:text-ink hover:border-ink/25'
              }`}
            >
              <Filter size={13} strokeWidth={2} />
              Filter
              {(filterEmploymentType || filterAttendance) && (
                <span className="w-1.5 h-1.5 rounded-full bg-olive flex-none" />
              )}
            </button>
            <button
              onClick={handleExport}
              disabled={staff.length === 0}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] border border-ink/[0.12] text-[12.5px] font-medium text-ink/65 hover:text-ink hover:border-ink/25 transition-colors bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={13} strokeWidth={2} />
              Export
            </button>
          </div>
        </div>

        {/* ── Filter panel ─────────────────────────────────────────────────── */}
        {showFilterPanel && (
          <div className="px-6 py-4 border-b border-ink/[0.06] bg-ink/[0.015] flex items-center gap-4 flex-wrap">
            {/* Employment Type */}
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-semibold text-ink/50">Type</label>
              <select
                value={filterEmploymentType}
                onChange={(e) => { setFilterEmploymentType(e.target.value); setPage(1); }}
                className="h-8 px-2.5 rounded-[8px] border border-ink/[0.12] bg-white text-[12.5px] text-ink focus:outline-none focus:border-olive cursor-pointer"
              >
                <option value="">All</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </select>
            </div>

            {/* Attendance */}
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-semibold text-ink/50">Attendance</label>
              <select
                value={filterAttendance}
                onChange={(e) => { setFilterAttendance(e.target.value); setPage(1); }}
                className="h-8 px-2.5 rounded-[8px] border border-ink/[0.12] bg-white text-[12.5px] text-ink focus:outline-none focus:border-olive cursor-pointer"
              >
                <option value="">All</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="On Leave">On Leave</option>
                <option value="Late">Late</option>
              </select>
            </div>

            {/* Clear */}
            {(filterEmploymentType || filterAttendance) && (
              <button
                onClick={() => { setFilterEmploymentType(''); setFilterAttendance(''); setPage(1); }}
                className="text-[12px] font-semibold text-danger-text hover:underline transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink/[0.06]">
                <th className="text-left py-3 px-6 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">
                  Staff Member
                </th>
                <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">
                  Role
                </th>
                <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">
                  Contact Info
                </th>
                <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">
                  Attendance
                </th>
                <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">
                  ID Docs
                </th>
                <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={24} className="text-ink/30 animate-spin" />
                      <p className="text-sm text-ink/40">Loading staff members...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle size={24} className="text-danger-text" />
                      <p className="text-sm text-danger-text font-medium">{error}</p>
                      <button
                        onClick={() => fetchStaff()}
                        className="text-xs text-ink/60 hover:text-ink underline"
                      >
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Users size={32} className="text-ink/20" />
                      <div>
                        <p className="text-sm font-medium text-ink/60 mb-1">
                          {search ? 'No staff members match your search.' : 'No staff members found.'}
                        </p>
                        {!search && (
                          <p className="text-xs text-ink/40">
                            Click "+ Add Staff" to get started.
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                staff.map((member) => {
                  const initials = getInitials(member.firstName, member.lastName);
                  const avatarColor = getAvatarColor(member.id);

                  // Supabase one-to-many join can return an array even for unique relations —
                  // normalise to a single object regardless of what shape comes back.
                  const identityDoc = Array.isArray(member.identityDocument)
                    ? (member.identityDocument[0] ?? null)
                    : (member.identityDocument ?? null);

                  const docStatus = identityDoc
                    ? mapDocStatus(identityDoc.verificationStatus)
                    : 'Missing';

                  return (
                    <tr
                      key={member.id}
                      className="border-b border-ink/[0.05] last:border-b-0 hover:bg-ink/[0.018] cursor-pointer transition-colors"
                    >
                      {/* Staff Member */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <StaffAvatar
                            photoUrl={member.photoUrl}
                            initials={initials}
                            avatarColor={avatarColor}
                            size="sm"
                          />
                          <div>
                            <p className="text-[13.5px] font-semibold text-ink">
                              {member.firstName} {member.lastName}
                            </p>
                            <p className="text-[11.5px] text-ink/45 font-mono">{member.staffCode}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className="text-[13px] text-ink/75 font-medium">{member.jobTitle}</span>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4">
                        <p className="text-[13px] text-ink/75">{member.email || '—'}</p>
                        <p className="text-[11.5px] text-ink/45 mt-0.5">{member.phone || '—'}</p>
                      </td>

                      {/* Attendance Status */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <AttendanceToggle
                          memberId={member.id}
                          memberName={`${member.firstName} ${member.lastName}`}
                          currentStatus={member.currentAttendanceStatus}
                          onStatusChange={handleAttendanceChangeRequest}
                        />
                      </td>

                      {/* ID Document Indicator */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <FileText size={13} strokeWidth={1.8} className="text-ink/35 flex-none" />
                          <DocIndicator status={docStatus} />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => navigate(`/staff/${member.id}`)}
                          className="text-[12px] font-medium text-ink/50 hover:text-ink border border-ink/[0.12] hover:border-ink/25 px-3 py-1.5 rounded-[7px] transition-colors"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ink/[0.07]">
          <p className="text-[13px] text-ink/50">
            Showing{' '}
            <span className="font-semibold text-ink">
              {totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, totalCount)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-ink">{totalCount}</span> staff members
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1 || loading}
              className="w-8 h-8 flex items-center justify-center rounded-[7px] border border-ink/[0.12] text-ink/55 hover:text-ink hover:border-ink/25 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} strokeWidth={2} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                disabled={loading}
                className={`w-8 h-8 flex items-center justify-center rounded-[7px] text-[13px] font-medium transition-colors ${
                  p === safePage
                    ? 'bg-ink text-paper'
                    : 'border border-ink/[0.12] text-ink/55 hover:text-ink hover:border-ink/25'
                } disabled:opacity-50`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages || loading}
              className="w-8 h-8 flex items-center justify-center rounded-[7px] border border-ink/[0.12] text-ink/55 hover:text-ink hover:border-ink/25 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* ── Present Today Modal ──────────────────────────────────────────────── */}
      {activeModal === 'presentToday' && (
        <StatModal
          title="Present Today"
          subtitle={`${presentList.length} staff member${presentList.length !== 1 ? 's' : ''} currently checked in`}
          icon={<CalendarCheck size={18} strokeWidth={1.8} className="text-success-text" />}
          iconBg="bg-success-bg"
          onClose={closeModal}
          loading={modalLoading}
        >
          {presentList.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-ink/[0.04] flex items-center justify-center">
                <CalendarCheck size={20} strokeWidth={1.4} className="text-ink/25" />
              </div>
              <p className="font-display font-bold text-[15px] text-ink/35">No Staff Present</p>
              <p className="text-[13px] text-ink/30 text-center">No staff members have been marked present today.</p>
            </div>
          ) : (
            <div>
              {presentList.map((member) => (
                <AttendanceListItem
                  key={member.id}
                  member={member}
                  onNavigate={(id) => { closeModal(); navigate(`/staff/${id}`); }}
                />
              ))}
            </div>
          )}
        </StatModal>
      )}

      {/* ── On Leave Modal ───────────────────────────────────────────────────── */}
      {activeModal === 'onLeave' && (
        <StatModal
          title="On Leave"
          subtitle={`${onLeaveList.length} staff member${onLeaveList.length !== 1 ? 's' : ''} currently on leave`}
          icon={<CalendarOff size={18} strokeWidth={1.8} className="text-warning-text" />}
          iconBg="bg-warning-bg"
          onClose={closeModal}
          loading={modalLoading}
        >
          {onLeaveList.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-ink/[0.04] flex items-center justify-center">
                <CalendarOff size={20} strokeWidth={1.4} className="text-ink/25" />
              </div>
              <p className="font-display font-bold text-[15px] text-ink/35">Nobody On Leave</p>
              <p className="text-[13px] text-ink/30 text-center">No staff members are currently marked as On Leave.</p>
            </div>
          ) : (
            <div>
              {onLeaveList.map((member) => (
                <AttendanceListItem
                  key={member.id}
                  member={member}
                  onNavigate={(id) => { closeModal(); navigate(`/staff/${id}`); }}
                />
              ))}
            </div>
          )}
        </StatModal>
      )}

      {/* ── Pending Tasks Modal ──────────────────────────────────────────────── */}
      {activeModal === 'pendingTasks' && (
        <StatModal
          title="Pending Tasks"
          subtitle={`${pendingTasks.length} task${pendingTasks.length !== 1 ? 's' : ''} pending across all staff`}
          icon={<ClipboardList size={18} strokeWidth={1.8} className="text-danger-text" />}
          iconBg="bg-danger-bg"
          onClose={closeModal}
          loading={modalLoading}
        >
          {pendingTasks.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-ink/[0.04] flex items-center justify-center">
                <ClipboardList size={20} strokeWidth={1.4} className="text-ink/25" />
              </div>
              <p className="font-display font-bold text-[15px] text-ink/35">All Clear</p>
              <p className="text-[13px] text-ink/30 text-center">No pending tasks across any staff members.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => {
                const staffName = `${task.staffFirstName} ${task.staffLastName}`.trim();
                const avatarColor = getAvatarColor(task.staffId);
                const initials = task.staffFirstName && task.staffLastName
                  ? `${task.staffFirstName[0]}${task.staffLastName[0]}`.toUpperCase()
                  : task.staffCode.slice(0, 2).toUpperCase();

                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                const formattedDue = task.dueDate
                  ? (() => {
                      const d = new Date(task.dueDate);
                      const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
                      return hasTime
                        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                          ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    })()
                  : null;

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-ink/[0.08] rounded-xl p-4 hover:border-ink/20 transition-colors"
                  >
                    {/* Task title + priority */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-[13.5px] font-semibold text-ink leading-tight flex-1">
                        {task.title}
                      </p>
                      <PriorityBadge priority={task.priority} />
                    </div>

                    {/* Meta row: staff + due date */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-display font-bold text-[10px] text-ink flex-none"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {initials}
                        </div>
                        <span className="text-[12px] text-ink/60 font-medium">{staffName || task.staffCode}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {formattedDue && (
                          <div className={`flex items-center gap-1 text-[11.5px] font-medium ${isOverdue ? 'text-danger-text' : 'text-ink/45'}`}>
                            <Calendar size={11} strokeWidth={2} />
                            {isOverdue ? 'Overdue · ' : ''}{formattedDue}
                          </div>
                        )}
                        <button
                          onClick={() => { closeModal(); navigate(`/staff/${task.staffId}`); }}
                          className="flex items-center gap-1 text-[12px] font-semibold text-olive hover:text-[#8a9b3f] transition-colors"
                        >
                          View Profile
                          <ArrowRight size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </StatModal>
      )}

      {/* ── Quick Assign Task Modal ──────────────────────────────────────────── */}
      {showAssignTask && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeAssignTask(); }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="px-6 py-5 border-b border-ink/[0.08] flex items-center justify-between flex-none">
              <div>
                <h3 className="font-display font-bold text-[18px] text-ink">Assign Task</h3>
                <p className="text-[13px] text-ink/45 mt-0.5">
                  Create a task and assign it to one or more staff members.
                </p>
              </div>
              <button
                onClick={closeAssignTask}
                disabled={savingTask}
                className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-ink/[0.06] transition-colors"
              >
                <X size={16} strokeWidth={2} className="text-ink/50" />
              </button>
            </div>

            {/* Body — two columns */}
            <div className="flex flex-1 min-h-0">

              {/* Left: Staff Selector */}
              <div className="w-[240px] flex-none border-r border-ink/[0.07] flex flex-col">
                <div className="px-4 pt-4 pb-3 flex-none">
                  <p className="text-[12px] font-bold text-ink/50 uppercase tracking-wide mb-2">
                    Assign To
                    {selectedStaffIds.size > 0 && (
                      <span className="ml-2 text-olive normal-case font-semibold">
                        {selectedStaffIds.size} selected
                      </span>
                    )}
                  </p>
                  {taskFormErrors.staff && (
                    <p className="text-[11.5px] text-danger-text mb-2">{taskFormErrors.staff}</p>
                  )}
                  {/* Search within staff list */}
                  <div className="relative">
                    <SearchIcon
                      size={13}
                      strokeWidth={2}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="Search staff..."
                      className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-ink/[0.12] text-[12.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-olive"
                    />
                  </div>
                </div>

                {/* Staff list */}
                <div className="flex-1 overflow-y-auto px-2 pb-3">
                  {allStaffLoading ? (
                    <div className="py-8 flex justify-center">
                      <div className="w-5 h-5 border-2 border-ink/20 border-t-olive rounded-full animate-spin" />
                    </div>
                  ) : allStaffList.length === 0 ? (
                    <p className="text-[12.5px] text-ink/35 text-center py-6">No staff members found</p>
                  ) : (
                    allStaffList
                      .filter((m) => {
                        const q = staffSearch.toLowerCase();
                        return (
                          !q ||
                          m.firstName.toLowerCase().includes(q) ||
                          m.lastName.toLowerCase().includes(q)  ||
                          m.jobTitle.toLowerCase().includes(q)  ||
                          m.staffCode.toLowerCase().includes(q)
                        );
                      })
                      .map((member) => {
                        const checked  = selectedStaffIds.has(member.id);
                        const initials = getInitials(member.firstName, member.lastName);
                        const color    = getAvatarColor(member.id);
                        return (
                          <button
                            key={member.id}
                            onClick={() => {
                              toggleStaffSelection(member.id);
                              if (taskFormErrors.staff) setTaskFormErrors((p) => ({ ...p, staff: '' }));
                            }}
                            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-[9px] transition-colors text-left mb-0.5 ${
                              checked ? 'bg-olive/10' : 'hover:bg-ink/[0.04]'
                            }`}
                          >
                            {/* Checkbox */}
                            <div className={`w-4 h-4 rounded-[4px] flex-none border-2 flex items-center justify-center transition-colors ${
                              checked ? 'bg-olive border-olive' : 'border-ink/25'
                            }`}>
                              {checked && (
                                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                  <path d="M1 3.5L3.5 6L8 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink" />
                                </svg>
                              )}
                            </div>
                            {/* Avatar */}
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-[10px] text-ink flex-none"
                              style={{ backgroundColor: color }}
                            >
                              {initials}
                            </div>
                            {/* Name + role */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-semibold text-ink truncate">
                                {member.firstName} {member.lastName}
                              </p>
                              <p className="text-[11px] text-ink/45 truncate">{member.jobTitle}</p>
                            </div>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Right: Task Form */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                  {/* Title */}
                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink/65 mb-1.5">
                      Task Title <span className="text-danger-text">*</span>
                    </label>
                    <input
                      type="text"
                      value={taskForm.title}
                      onChange={(e) => {
                        setTaskForm((p) => ({ ...p, title: e.target.value }));
                        if (taskFormErrors.title) setTaskFormErrors((p) => ({ ...p, title: '' }));
                      }}
                      placeholder="e.g., Restock Warehouse Aisle 4"
                      className={`w-full h-10 px-3.5 rounded-[9px] border text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-olive transition ${
                        taskFormErrors.title ? 'border-danger-text/60' : 'border-ink/[0.12]'
                      }`}
                    />
                    {taskFormErrors.title && (
                      <p className="text-[11.5px] text-danger-text mt-1">{taskFormErrors.title}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[12.5px] font-semibold text-ink/65 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Add details about this task..."
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-[9px] border border-ink/[0.12] text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-olive transition resize-none"
                    />
                  </div>

                  {/* Priority + Due Date side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Priority */}
                    <div>
                      <label className="block text-[12.5px] font-semibold text-ink/65 mb-1.5">
                        Priority
                      </label>
                      <div className="flex gap-2">
                        {(['High', 'Medium', 'Low'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTaskForm((prev) => ({ ...prev, priority: p }))}
                            className={`flex-1 h-9 rounded-[8px] text-[12px] font-semibold border transition-colors ${
                              taskForm.priority === p
                                ? p === 'High'   ? 'bg-danger-bg border-danger-text/40 text-danger-text'
                                : p === 'Medium' ? 'bg-warning-bg border-warning-text/40 text-warning-text'
                                :                  'bg-ink/[0.06] border-ink/20 text-ink/70'
                                : 'border-ink/[0.12] text-ink/40 hover:border-ink/25 hover:text-ink/60'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Due Date */}
                    <div>
                      <label className="block text-[12.5px] font-semibold text-ink/65 mb-1.5">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                        className="w-full h-10 px-3.5 rounded-[9px] border border-ink/[0.12] text-[13.5px] text-ink focus:outline-none focus:border-olive transition"
                      />
                    </div>
                  </div>

                  {/* Due Time — full width row, only shown when date is set */}
                  {taskForm.dueDate && (
                    <div>
                      <label className="block text-[12.5px] font-semibold text-ink/65 mb-1.5">
                        Due Time{' '}
                        <span className="text-ink/35 normal-case font-normal">(optional)</span>
                      </label>
                      <input
                        type="time"
                        value={taskForm.dueTime}
                        onChange={(e) => setTaskForm((p) => ({ ...p, dueTime: e.target.value }))}
                        className="w-full h-10 px-3.5 rounded-[9px] border border-ink/[0.12] text-[13.5px] text-ink focus:outline-none focus:border-olive transition"
                      />
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-ink/[0.08] flex items-center justify-between flex-none">
                  <p className="text-[12.5px] text-ink/40">
                    {selectedStaffIds.size === 0
                      ? 'No staff selected'
                      : selectedStaffIds.size === 1
                      ? '1 staff member selected'
                      : `${selectedStaffIds.size} staff members selected`}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={closeAssignTask}
                      disabled={savingTask}
                      className="h-10 px-5 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignTask}
                      disabled={savingTask}
                      className="flex items-center gap-2 h-10 px-6 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors disabled:opacity-50"
                    >
                      {savingTask ? (
                        <>
                          <div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <ListTodo size={14} strokeWidth={2} />
                          Assign Task
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Attendance Confirmation Dialog ───────────────────────────────────── */}
      {pendingAttendance && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !savingAttendance) cancelAttendanceChange(); }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-md mx-4 shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-none ${BADGE_STYLES[pendingAttendance.newStatus] || 'bg-ink/[0.06]'}`}>
                <CalendarCheck size={20} strokeWidth={1.8} className={
                  pendingAttendance.newStatus === 'Present' ? 'text-success-text' :
                  pendingAttendance.newStatus === 'Absent'  ? 'text-danger-text'  :
                  'text-warning-text'
                } />
              </div>
              <div>
                <h3 className="font-display font-bold text-[16px] text-ink mb-1">
                  Mark as {pendingAttendance.newStatus}?
                </h3>
                <p className="text-[13px] text-ink/60 leading-relaxed">
                  Are you sure you want to mark{' '}
                  <span className="font-semibold text-ink">{pendingAttendance.memberName}</span>{' '}
                  as <span className="font-semibold">{pendingAttendance.newStatus}</span> for today?
                  This will update their attendance record and the dashboard stats.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={cancelAttendanceChange}
                disabled={savingAttendance}
                className="h-10 px-5 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAttendanceChange}
                disabled={savingAttendance}
                className="flex items-center gap-2 h-10 px-5 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors disabled:opacity-50"
              >
                {savingAttendance ? (
                  <>
                    <div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <StaffNotifyModal
        open={showNotify}
        onClose={() => setShowNotify(false)}
        staffList={allStaffList}
      />
    </>
  );
};

export default StaffManagementPage;
