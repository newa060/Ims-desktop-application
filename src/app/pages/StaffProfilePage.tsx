import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Bell,
  CalendarCheck,
  CalendarX,
  CheckSquare,
  ShoppingBag,
  Wallet,
  LogIn,
  PackageSearch,
  StickyNote,
  TrendingUp,
  Quote,
  Clock,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Calendar,
  CheckCircle2,
  Circle,
  Loader2,
  Download,
  Tag,
  Shirt,
  Coffee,
  Watch,
  CalendarClock,
  BarChart3,
  FileText,
  History,
  AlertCircle,
  User,
  Plus,
  X,
  Trash2,
} from 'lucide-react';
import type { StaffMember, StaffAttendanceRecord, StaffTask, StaffPurchase, StaffSalaryRecord, StaffPayslip, StaffPurchasePaymentMethod } from '../../types';
import StaffNotifyModal from '../components/staff/StaffNotifyModal';

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
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/** Format date for display */
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Format currency */
const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// ─── Attendance badge ─────────────────────────────────────────────────────────

const AttendanceBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Present:   'bg-success-bg text-success-text',
    Absent:    'bg-danger-bg text-danger-text',
    'On Leave':'bg-warning-bg text-warning-text',
  };
  const dotColor: Record<string, string> = {
    Present:   'bg-success-text',
    Absent:    'bg-danger-text',
    'On Leave':'bg-warning-text',
  };
  const style = styles[status] || 'bg-ink/10 text-ink/60';
  const dot = dotColor[status] || 'bg-ink/40';
  
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-none ${dot}`} />
      {status}
    </span>
  );
};

// ─── Tab types & config ───────────────────────────────────────────────────────

type TabId = 'overview' | 'attendance' | 'tasks' | 'purchases' | 'salary';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',   label: 'Overview'   },
  { id: 'attendance', label: 'Attendance' },
  { id: 'tasks',      label: 'Tasks'      },
  { id: 'purchases',  label: 'Purchases'  },
  { id: 'salary',     label: 'Salary'     },
];

// ─── Overview stat card ───────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  noteColor?: string;
}

const StatCard = ({ icon, label, value, note, noteColor = 'text-ink/45' }: StatCardProps) => (
  <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
    <div className="flex items-center justify-between mb-3">
      <span className="text-[13px] text-ink/55 font-medium">{label}</span>
      <span className="text-ink/35">{icon}</span>
    </div>
    <div className="font-display font-bold text-[28px] text-ink leading-none mb-2">{value}</div>
    <p className={`text-[12px] font-medium ${noteColor}`}>{note}</p>
  </div>
);

// ─── Timeline activity item ───────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  time: string;
  description: string;
}

const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: 'a1',
    icon: <LogIn size={14} strokeWidth={2} />,
    iconBg: 'bg-success-bg text-success-text',
    title: 'Shift Check-in',
    time: 'Today, 08:02 AM',
    description: 'Clocked in on time',
  },
  {
    id: 'a2',
    icon: <PackageSearch size={14} strokeWidth={2} />,
    iconBg: 'bg-ink/[0.06] text-ink/55',
    title: 'Stock Count Update',
    time: 'Today, 10:15 AM',
    description: 'Inventory reconciliation task completed',
  },
  {
    id: 'a3',
    icon: <StickyNote size={14} strokeWidth={2} />,
    iconBg: 'bg-warning-bg text-warning-text',
    title: 'Manager Note Added',
    time: 'Yesterday, 03:40 PM',
    description: 'Performance note logged',
  },
  {
    id: 'a4',
    icon: <TrendingUp size={14} strokeWidth={2} />,
    iconBg: 'bg-[rgba(95,122,61,0.14)] text-success-text',
    title: 'Sales Target Reached',
    time: 'Mon, Jul 14 — 05:00 PM',
    description: 'Exceeded weekly sales target',
  },
];

// ─── Task priority list ───────────────────────────────────────────────────────

interface TaskCategory {
  label: string;
  percent: number;
  color: string;
}

const TASK_CATEGORIES: TaskCategory[] = [
  { label: 'Inventory Management', percent: 84, color: 'bg-olive' },
  { label: 'Staff Coordination',   percent: 67, color: 'bg-[#93b4f0]' },
  { label: 'Sales Reporting',      percent: 91, color: 'bg-success-text' },
];

// ─── Attendance tab ───────────────────────────────────────────────────────────

type DayStatus = 'Present' | 'Absent' | 'Late' | 'On Leave' | 'Holiday' | null;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_HEADERS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

const STATUS_DOT: Record<NonNullable<DayStatus>, string> = {
  'Present': 'bg-success-text',
  'Absent':  'bg-danger-text',
  'Late':    'bg-warning-text',
  'On Leave': 'bg-warning-text',
  'Holiday': 'bg-ink/30',
};

const STATUS_OPTIONS: NonNullable<DayStatus>[] = ['Present', 'Absent', 'Late', 'On Leave', 'Holiday'];

interface AttendanceTabProps {
  staffId: string;
}

const AttendanceTab = ({ staffId }: AttendanceTabProps) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [attendanceData, setAttendanceData] = useState<Record<string, DayStatus>>({});
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ day: number; currentStatus: DayStatus } | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch attendance data for the selected month
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await window.electron.getStaffAttendance(staffId, year, month + 1);
      
      if (response.success && response.data) {
        const records: StaffAttendanceRecord[] = response.data;
        const dataMap: Record<string, DayStatus> = {};
        
        records.forEach((record) => {
          // Parse date from "YYYY-MM-DD" format
          const date = new Date(record.attendanceDate);
          const day = date.getDate();
          const key = `${year}-${month + 1}-${day}`;
          dataMap[key] = record.status as DayStatus;
        });
        
        setAttendanceData(dataMap);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [staffId, year, month]);

  const prevMonth = () => {
    if (month === 0) { 
      setMonth(11); 
      setYear((y) => y - 1); 
    } else { 
      setMonth((m) => m - 1); 
    }
  };

  const nextMonth = () => {
    if (month === 11) { 
      setMonth(0); 
      setYear((y) => y + 1); 
    } else { 
      setMonth((m) => m + 1); 
    }
  };

  // Build calendar grid
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  // Count stats from attendance data for the visible month
  let presentCount = 0, absentCount = 0, lateCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${month + 1}-${d}`;
    const status = attendanceData[key];
    if (status === 'Present') presentCount++;
    else if (status === 'Absent') absentCount++;
    else if (status === 'Late') lateCount++;
  }

  // Cells: leading grey days + current month days + trailing grey days
  type Cell = { day: number; inMonth: boolean; status: DayStatus };
  const cells: Cell[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: daysInPrev - firstDayOfWeek + 1 + i, inMonth: false, status: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${month + 1}-${d}`;
    cells.push({ day: d, inMonth: true, status: attendanceData[key] ?? null });
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    cells.push({ day: i, inMonth: false, status: null });
  }

  // Handle day click
  const handleDayClick = (day: number, currentStatus: DayStatus) => {
    setSelectedDay({ day, currentStatus });
  };

  // Handle attendance update
  const handleUpdateAttendance = async (newStatus: DayStatus) => {
    if (!selectedDay || !newStatus) return;

    try {
      setSaving(true);
      
      // Format date as YYYY-MM-DD
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay.day).padStart(2, '0')}`;
      
      const response = await window.electron.recordStaffAttendance({
        staffId,
        attendanceDate: dateStr,
        status: newStatus,
        notes: '',
      });

      if (response.success) {
        toast.success(`Attendance marked as ${newStatus}`);
        
        // Update local state
        const key = `${year}-${month + 1}-${selectedDay.day}`;
        setAttendanceData(prev => ({ ...prev, [key]: newStatus }));
        
        // Trigger refresh on Staff Management page
        window.dispatchEvent(new Event('staff:refresh'));
        
        setSelectedDay(null);
      } else {
        toast.error(response.error || 'Failed to update attendance');
      }
    } catch (err) {
      console.error('Error updating attendance:', err);
      toast.error('Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };

  const todayDate = new Date();
  const isCurrentMonth = year === todayDate.getFullYear() && month === todayDate.getMonth();

  return (
    <div className="space-y-5">

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Present Days</span>
            <CalendarCheck size={16} strokeWidth={1.6} className="text-success-text" />
          </div>
          <div className="font-display font-bold text-[34px] text-success-text leading-none">
            {loading ? '—' : presentCount}
          </div>
          <p className="text-[12px] text-ink/40 mt-2 font-medium">Days present this month</p>
        </div>

        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Absent Days</span>
            <CalendarX size={16} strokeWidth={1.6} className="text-danger-text" />
          </div>
          <div className="font-display font-bold text-[34px] text-danger-text leading-none">
            {loading ? '—' : absentCount}
          </div>
          <p className="text-[12px] text-ink/40 mt-2 font-medium">Unexcused absences</p>
        </div>

        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Late Arrivals</span>
            <Clock size={16} strokeWidth={1.6} className="text-warning-text" />
          </div>
          <div className="font-display font-bold text-[34px] text-warning-text leading-none">
            {loading ? '—' : lateCount}
          </div>
          <p className="text-[12px] text-ink/40 mt-2 font-medium">Clocked in after start time</p>
        </div>
      </div>

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-ink/[0.08] rounded-2xl p-6">

        {/* Calendar header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-ink/[0.12] text-ink/50 hover:text-ink hover:border-ink/25 transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={15} strokeWidth={2} />
            </button>
            <h3 className="font-display font-bold text-[17px] text-ink w-44 text-center">
              {MONTH_NAMES[month]} {year}
            </h3>
            <button
              onClick={nextMonth}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-ink/[0.12] text-ink/50 hover:text-ink hover:border-ink/25 transition-colors disabled:opacity-40"
            >
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5">
            {[
              { label: 'Present', dot: 'bg-success-text' },
              { label: 'Absent',  dot: 'bg-danger-text'  },
              { label: 'Late',    dot: 'bg-warning-text' },
            ].map(({ label, dot }) => (
              <span key={label} className="flex items-center gap-1.5 text-[12.5px] text-ink/55 font-medium">
                <span className={`w-2 h-2 rounded-full flex-none ${dot}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-bold uppercase tracking-wider text-ink/35 pb-2"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-ink/30 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((cell, idx) => {
              const isTodayCell =
                cell.inMonth &&
                cell.day === todayDate.getDate() &&
                isCurrentMonth;

              return (
                <div
                  key={idx}
                  onClick={() => cell.inMonth && handleDayClick(cell.day, cell.status)}
                  className={`flex flex-col items-center py-2.5 rounded-[8px] transition-colors ${
                    cell.inMonth ? 'hover:bg-ink/[0.06] cursor-pointer' : ''
                  }`}
                >
                  {/* Day number */}
                  <span
                    className={`text-[13.5px] font-semibold leading-none ${
                      !cell.inMonth
                        ? 'text-ink/20'
                        : isTodayCell
                        ? 'w-7 h-7 flex items-center justify-center rounded-full bg-ink text-paper'
                        : 'text-ink/75'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {/* Status dot */}
                  {cell.inMonth && cell.status && STATUS_DOT[cell.status] && (
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-none ${STATUS_DOT[cell.status]}`}
                    />
                  )}
                  {/* Empty spacer so cells without dots stay the same height */}
                  {cell.inMonth && !cell.status && (
                    <span className="mt-1.5 w-1.5 h-1.5 flex-none opacity-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Mark Attendance Modal ──────────────────────────────────────────── */}
      {selectedDay && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50" onClick={() => !saving && setSelectedDay(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-[18px] text-ink mb-2">
              Mark Attendance
            </h3>
            <p className="text-[13px] text-ink/55 mb-5">
              {MONTH_NAMES[month]} {selectedDay.day}, {year}
              {selectedDay.currentStatus && (
                <span className="ml-2 text-ink/40">
                  · Current: <span className="font-semibold">{selectedDay.currentStatus}</span>
                </span>
              )}
            </p>

            <div className="space-y-2 mb-6">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => handleUpdateAttendance(status)}
                  disabled={saving}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-[10px] border-2 transition-colors ${
                    selectedDay.currentStatus === status
                      ? 'border-olive bg-olive/10'
                      : 'border-ink/[0.12] hover:border-ink/25 bg-white'
                  } disabled:opacity-50`}
                >
                  <span className="text-[13.5px] font-semibold text-ink">{status}</span>
                  {STATUS_DOT[status] && (
                    <span className={`w-3 h-3 rounded-full ${STATUS_DOT[status]}`} />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDay(null)}
                disabled={saving}
                className="flex-1 h-10 px-4 rounded-[9px] border border-ink/[0.12] text-[13px] font-semibold text-ink/65 hover:text-ink hover:border-ink/25 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              {selectedDay.currentStatus && (
                <button
                  onClick={() => handleUpdateAttendance(null)}
                  disabled={saving}
                  className="flex-1 h-10 px-4 rounded-[9px] border border-danger-text/30 bg-danger-bg text-[13px] font-semibold text-danger-text hover:bg-danger-text/10 transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>

            {saving && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Loader2 size={16} className="text-ink/40 animate-spin" />
                <span className="text-[12px] text-ink/40">Saving...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tasks tab ────────────────────────────────────────────────────────────────

type TaskStatus = 'pending' | 'in-progress' | 'completed';
type TaskPriority = 'High' | 'Medium' | 'Low';

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  High:   'bg-danger-bg   text-danger-text',
  Medium: 'bg-warning-bg  text-warning-text',
  Low:    'bg-ink/[0.06]  text-ink/50',
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; cardBorder: string; iconColor: string }> = {
  'pending':     { label: 'Pending',     cardBorder: 'border-ink/[0.08]',         iconColor: 'text-ink/35'        },
  'in-progress': { label: 'In Progress', cardBorder: 'border-[#93b4f0]/60',       iconColor: 'text-[#5b8dee]'     },
  'completed':   { label: 'Completed',   cardBorder: 'border-success-text/25',    iconColor: 'text-success-text'  },
};

const SUMMARY_CARDS: { status: TaskStatus; label: string; icon: React.ReactNode; countColor: string }[] = [
  { status: 'pending',     label: 'Pending',     icon: <Circle      size={15} strokeWidth={2}   />, countColor: 'text-ink/70'       },
  { status: 'in-progress', label: 'In Progress', icon: <Loader2     size={15} strokeWidth={2}   />, countColor: 'text-[#5b8dee]'    },
  { status: 'completed',   label: 'Completed',   icon: <CheckCircle2 size={15} strokeWidth={2}  />, countColor: 'text-success-text' },
];

interface TaskCardProps {
  task: StaffTask;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

const TaskCard = ({ task, onStatusChange }: TaskCardProps) => {
  const cfg = STATUS_CONFIG[task.status];
  const isDone = task.status === 'completed';
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    // If time component is not midnight, show it
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    if (hasTime) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ', ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get allowed next statuses based on current status (forward-only progression)
  const getAllowedStatuses = (): TaskStatus[] => {
    switch (task.status) {
      case 'pending':
        return ['in-progress'];
      case 'in-progress':
        return ['completed'];
      case 'completed':
        return []; // No further changes allowed
      default:
        return [];
    }
  };

  const allowedStatuses = getAllowedStatuses();

  const handleStatusClick = (newStatus: TaskStatus) => {
    setShowStatusMenu(false);
    setPendingStatus(newStatus);
    setShowConfirmDialog(true);
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      onStatusChange(task.id, pendingStatus);
    }
    setShowConfirmDialog(false);
    setPendingStatus(null);
  };

  const cancelStatusChange = () => {
    setShowConfirmDialog(false);
    setPendingStatus(null);
  };

  const getConfirmationMessage = (status: TaskStatus): string => {
    switch (status) {
      case 'in-progress':
        return 'Are you sure you want to mark this task as In Progress?';
      case 'completed':
        return 'Are you sure you want to mark this task as Completed?';
      default:
        return 'Are you sure you want to change this task status?';
    }
  };

  return (
    <>
      <div className={`bg-white border ${cfg.cardBorder} rounded-xl p-4 flex flex-col gap-3 relative`}>
        {/* Header row: title + priority */}
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[13.5px] font-semibold text-ink leading-snug flex-1 ${isDone ? 'line-through text-ink/35' : ''}`}>
            {task.title}
          </p>
          <span className={`flex-none text-[11px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </span>
        </div>

        {/* Description */}
        {task.description && (
          <p className={`text-[12.5px] leading-relaxed line-clamp-2 ${isDone ? 'text-ink/30' : 'text-ink/50'}`}>
            {task.description}
          </p>
        )}

        {/* Footer: date + status change button */}
        <div className="flex items-center justify-between mt-auto">
          <div className={`flex items-center gap-1.5 text-[12px] font-medium ${isDone ? 'text-success-text' : 'text-ink/45'}`}>
            {isDone
              ? <CheckCircle2 size={13} strokeWidth={2} className="flex-none" />
              : <Calendar     size={13} strokeWidth={1.8} className="flex-none" />
            }
            {isDone
              ? task.completedAt ? `Done: ${formatDate(new Date(task.completedAt).toISOString())}` : 'Completed'
              : task.dueDate ? `Due: ${formatDate(task.dueDate)}` : 'No due date'
            }
          </div>
          
          {/* Status change dropdown - only show if there are allowed next statuses */}
          {allowedStatuses.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="text-[11px] font-medium text-ink/50 hover:text-ink border border-ink/[0.12] hover:border-ink/25 px-2 py-1 rounded-[6px] transition-colors"
              >
                Change Status
              </button>
              
              {showStatusMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                  <div className="absolute right-0 bottom-full mb-1 z-20 bg-white border border-ink/[0.12] rounded-[8px] shadow-lg overflow-hidden min-w-[140px]">
                    {allowedStatuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusClick(status)}
                        className="w-full text-left px-3 py-2 text-[12px] font-medium text-ink/70 hover:bg-ink/[0.04] hover:text-ink transition-colors"
                      >
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Show "Final" badge for completed tasks */}
          {isDone && (
            <span className="text-[11px] font-medium text-success-text/60 bg-success-bg px-2 py-1 rounded-[6px]">
              Final
            </span>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && pendingStatus && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50" onClick={cancelStatusChange}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning-bg flex items-center justify-center flex-none">
                <AlertCircle size={20} strokeWidth={2} className="text-warning-text" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-[16px] text-ink mb-1">
                  Confirm Status Change
                </h3>
                <p className="text-[13px] text-ink/60 leading-relaxed">
                  {getConfirmationMessage(pendingStatus)}
                </p>
              </div>
            </div>

            {pendingStatus === 'completed' && (
              <div className="mb-4 p-3 rounded-[8px] bg-ink/[0.03] border border-ink/[0.06]">
                <p className="text-[12px] text-ink/55 leading-relaxed">
                  <strong className="text-ink/70">Note:</strong> Once marked as Completed, this task status cannot be changed.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={cancelStatusChange}
                className="flex-1 h-10 px-4 rounded-[9px] border border-ink/[0.12] text-[13px] font-semibold text-ink/65 hover:text-ink hover:border-ink/25 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                className="flex-1 h-10 px-4 rounded-[9px] bg-ink text-paper text-[13px] font-semibold hover:bg-ink/85 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface TasksTabProps {
  staffId: string;
  staffName: string;
}

const TasksTab = ({ staffId, staffName }: TasksTabProps) => {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium' as TaskPriority,
    dueDate: '',
    dueTime: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await window.electron.getStaffTasks(staffId);
      
      if (response.success && response.data) {
        setTasks(response.data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [staffId]);

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const response = await window.electron.updateStaffTaskStatus(taskId, newStatus);
      
      if (response.success) {
        toast.success(`Task moved to ${STATUS_CONFIG[newStatus].label}`);
        
        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: newStatus, completedAt: newStatus === 'completed' ? new Date() : t.completedAt } : t
        ));
        
        // Trigger refresh for stats
        window.dispatchEvent(new Event('staff:refresh'));
      } else {
        toast.error(response.error || 'Failed to update task status');
      }
    } catch (err) {
      console.error('Error updating task status:', err);
      toast.error('Failed to update task status');
    }
  };

  // Handle assign new task
  const handleAssignTask = async () => {
    // Validate
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);

      // Combine date + time into a single ISO string when both are provided
      let combinedDueDate: string | undefined;
      if (formData.dueDate) {
        if (formData.dueTime) {
          combinedDueDate = new Date(`${formData.dueDate}T${formData.dueTime}`).toISOString();
        } else {
          combinedDueDate = formData.dueDate;
        }
      }

      const response = await window.electron.createStaffTask({
        staffId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        status: 'pending',
        dueDate: combinedDueDate,
      });

      if (response.success && response.data) {
        toast.success('Task assigned successfully');
        setTasks(prev => [response.data, ...prev]);
        setShowAssignForm(false);
        setFormData({ title: '', description: '', priority: 'Medium', dueDate: '', dueTime: '' });
        setFormErrors({});
        
        // Trigger refresh for stats
        window.dispatchEvent(new Event('staff:refresh'));
      } else {
        toast.error(response.error || 'Failed to assign task');
      }
    } catch (err) {
      console.error('Error assigning task:', err);
      toast.error('Failed to assign task');
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  const groups: TaskStatus[] = ['pending', 'in-progress', 'completed'];

  return (
    <div className="space-y-5">

      {/* ── Section header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-[18px] text-ink">Assigned Tasks</h3>
          <p className="text-[13px] text-ink/45 mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} total across all statuses
          </p>
        </div>
        <button 
          onClick={() => setShowAssignForm(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] bg-ink text-paper text-[13px] font-semibold hover:bg-ink/85 transition-colors"
        >
          <ListTodo size={14} strokeWidth={2.5} />
          Assign New Task
        </button>
      </div>

      {/* ── Status summary row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {SUMMARY_CARDS.map(({ status, label, icon, countColor }) => (
          <div key={status} className="bg-white border border-ink/[0.08] rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`${countColor}`}>{icon}</span>
              <span className="text-[13.5px] font-semibold text-ink/65">{label}</span>
            </div>
            <span className={`font-display font-bold text-[22px] leading-none ${countColor}`}>
              {loading ? '—' : counts[status]}
            </span>
          </div>
        ))}
      </div>

      {/* ── Task groups ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="text-ink/30 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border border-ink/[0.08] rounded-2xl flex flex-col items-center justify-center py-24 gap-3">
          <ListTodo size={32} className="text-ink/20" />
          <div className="text-center">
            <p className="font-display font-bold text-[15px] text-ink/40 mb-1">No tasks assigned yet</p>
            <p className="text-[13px] text-ink/30">Click "Assign New Task" to get started</p>
          </div>
        </div>
      ) : (
        groups.map((status) => {
          const statusTasks = tasks.filter((t) => t.status === status);
          if (statusTasks.length === 0) return null;
          const { label } = STATUS_CONFIG[status];

          return (
            <div key={status}>
              {/* Group label */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] font-bold uppercase tracking-wider text-ink/40">
                  {label}
                </span>
                <span className="text-[11px] font-semibold text-ink/30 bg-ink/[0.05] px-1.5 py-0.5 rounded-full">
                  {statusTasks.length}
                </span>
                <div className="flex-1 h-px bg-ink/[0.06]" />
              </div>

              {/* 3-column card grid */}
              <div className="grid grid-cols-3 gap-3">
                {statusTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* ── Assign Task Modal ──────────────────────────────────────────────── */}
      {showAssignForm && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50" onClick={() => !saving && setShowAssignForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-[18px] text-ink mb-2">
              Assign New Task
            </h3>
            <p className="text-[13px] text-ink/55 mb-5">
              Assign a task to {staffName}
            </p>

            <div className="space-y-4 mb-6">
              {/* Title */}
              <div>
                <label className="block text-[12.5px] font-semibold text-ink/60 mb-1.5 uppercase tracking-wide">
                  Task Title <span className="text-danger-text">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (formErrors.title) setFormErrors({ ...formErrors, title: '' });
                  }}
                  placeholder="e.g., Restock Warehouse Aisle 4"
                  className={`w-full h-10 px-3.5 rounded-[9px] border ${
                    formErrors.title ? 'border-danger-text/60 bg-danger-bg/30' : 'border-ink/[0.12] bg-white'
                  } text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-olive/50 focus:border-transparent transition`}
                />
                {formErrors.title && <p className="mt-1 text-[11.5px] text-danger-text">{formErrors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12.5px] font-semibold text-ink/60 mb-1.5 uppercase tracking-wide">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add details about this task..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-[9px] border border-ink/[0.12] bg-white text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-olive/50 focus:border-transparent transition resize-none"
                />
              </div>

              {/* Priority + Due Date + Due Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12.5px] font-semibold text-ink/60 mb-1.5 uppercase tracking-wide">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    className="w-full h-10 px-3.5 rounded-[9px] border border-ink/[0.12] bg-white text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-olive/50 focus:border-transparent transition appearance-none cursor-pointer"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-ink/60 mb-1.5 uppercase tracking-wide">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full h-10 px-3.5 rounded-[9px] border border-ink/[0.12] bg-white text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-olive/50 focus:border-transparent transition"
                  />
                </div>

                {/* Due Time — spans right column, only shown when date is set */}
                {formData.dueDate && (
                  <div className="col-start-2">
                    <label className="block text-[12.5px] font-semibold text-ink/60 mb-1.5 uppercase tracking-wide">
                      Due Time <span className="text-ink/35 normal-case font-normal">(optional)</span>
                    </label>
                    <input
                      type="time"
                      value={formData.dueTime}
                      onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-[9px] border border-ink/[0.12] bg-white text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-olive/50 focus:border-transparent transition"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowAssignForm(false);
                  setFormData({ title: '', description: '', priority: 'Medium', dueDate: '', dueTime: '' });
                  setFormErrors({});
                }}
                disabled={saving}
                className="flex-1 h-10 px-4 rounded-[9px] border border-ink/[0.12] text-[13px] font-semibold text-ink/65 hover:text-ink hover:border-ink/25 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTask}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-[9px] bg-ink text-paper text-[13px] font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} strokeWidth={2.5} />
                    Assign Task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Purchases tab ────────────────────────────────────────────────────────────

type DeductionStatus = 'Pending' | 'Deducted' | 'Waived';

const DEDUCTION_BADGE: Record<DeductionStatus, string> = {
  Pending:  'bg-warning-bg text-warning-text',
  Deducted: 'bg-success-bg text-success-text',
  Waived:   'bg-ink/[0.08] text-ink/50',
};

interface PurchasesTabProps {
  staffId: string;
  staffName: string;
}

const PurchasesTab = ({ staffId, staffName }: PurchasesTabProps) => {
  const [purchases, setPurchases] = useState<StaffPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ purchaseId: string; currentStatus: DeductionStatus } | null>(null);
  // Payment method selection inside the Mark Deducted dialog
  const [deductOtherMode, setDeductOtherMode]         = useState(false);
  const [deductSubChoice, setDeductSubChoice]         = useState<'Cash' | 'eSewa' | ''>('');
  const [deductCustomText, setDeductCustomText]       = useState('');

  // ── History modal state ────────────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  // Filter mode: 'month' or 'day'
  const [filterMode, setFilterMode]   = useState<'month' | 'day'>('month');
  const today = new Date();
  const [filterYear,  setFilterYear]  = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1); // 1-based
  const [filterDay,   setFilterDay]   = useState(''); // ISO date string for day filter

  const [formData, setFormData] = useState({
    itemName:     '',
    category:     '',
    amount:       '',
    purchaseDate: today.toISOString().split('T')[0],
    paymentNote:  '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentMonth = today.getMonth() + 1;
  const currentYear  = today.getFullYear();

  const formatCurrency = (amount: number): string =>
    `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Fetch all purchases (no filter — we slice client-side for the two views)
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await window.electron.getStaffPurchases(staffId, {});
      if (response.success && response.data) {
        setPurchases(response.data);
      }
    } catch (err) {
      console.error('Error fetching purchases:', err);
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPurchases(); }, [staffId]);

  // ── Derived lists ──────────────────────────────────────────────────────────

  // Main table: current month, PENDING only, Salary Deduction method only
  const currentMonthPurchases = purchases.filter((p) => {
    const d = new Date(p.purchaseDate);
    const inCurrentMonth = d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    return inCurrentMonth && p.deductionStatus === 'Pending' && p.paymentMethod === 'Salary Deduction';
  });

  // Also show current-month Paid purchases (Cash/eSewa/Other) in a secondary view on the main tab
  const currentMonthPaid = purchases.filter((p) => {
    const d = new Date(p.purchaseDate);
    const inCurrentMonth = d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    return inCurrentMonth && p.deductionStatus === 'Paid';
  });

  // History: all settled purchases (Deducted OR Paid), filtered by selected period
  const historyPurchases = purchases.filter((p) => {
    if (p.deductionStatus !== 'Deducted' && p.deductionStatus !== 'Paid') return false;
    const d = new Date(p.purchaseDate);
    if (filterMode === 'month') {
      return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
    }
    if (!filterDay) return true;
    return p.purchaseDate.slice(0, 10) === filterDay;
  });

  // Summary totals from full list
  const monthlyTotal = currentMonthPurchases.reduce((s, p) => s + p.amount, 0);
  const yearlyTotal  = purchases.filter((p) => new Date(p.purchaseDate).getFullYear() === currentYear).reduce((s, p) => s + p.amount, 0);
  const nextDeduction = purchases.filter((p) => p.deductionStatus === 'Pending').reduce((s, p) => s + p.amount, 0);

  // History period label
  const historyPeriodLabel = filterMode === 'month'
    ? `${MONTHS[filterMonth - 1]} ${filterYear}`
    : filterDay ? formatDate(filterDay) : 'All time';

  const historyTotal = historyPurchases.reduce((s, p) => s + p.amount, 0);

  // Handle add purchase
  const handleAddPurchase = async () => {
    // Validate
    const errors: Record<string, string> = {};
    if (!formData.itemName.trim()) errors.itemName = 'Item name is required';
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      errors.amount = 'Valid amount is required';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);

      const response = await window.electron.recordStaffPurchase({
        staffId,
        itemName:      formData.itemName.trim(),
        category:      formData.category.trim() || undefined,
        purchaseDate:  formData.purchaseDate,
        amount:        Number(formData.amount),
        paymentMethod: 'Salary Deduction',  // always starts as Salary Deduction; changed when deducting
        paymentNote:   formData.paymentNote.trim() || undefined,
      });

      if (response.success && response.data) {
        toast.success('Purchase recorded successfully');
        setPurchases(prev => [response.data, ...prev]);
        setShowAddForm(false);
        setFormData({
          itemName:      '',
          category:      '',
          amount:        '',
          purchaseDate:  new Date().toISOString().split('T')[0],
          paymentNote:  '',
        });
        setFormErrors({});
        
        // Trigger refresh for stats
        window.dispatchEvent(new Event('staff:refresh'));
      } else {
        toast.error(response.error || 'Failed to record purchase');
      }
    } catch (err) {
      console.error('Error recording purchase:', err);
      toast.error('Failed to record purchase');
    } finally {
      setSaving(false);
    }
  };

  // Handle status change request
  const handleStatusChangeRequest = (purchaseId: string, currentStatus: DeductionStatus) => {
    // Only allow Pending → Deducted
    if (currentStatus === 'Pending') {
      setPendingStatusChange({ purchaseId, currentStatus });
      setShowConfirmDialog(true);
    }
  };

  // Confirm status change — now saves the chosen payment method too
  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;

    // Resolve payment method from dialog state
    const resolvedMethod: StaffPurchasePaymentMethod = deductOtherMode
      ? ((deductSubChoice || deductCustomText.trim() || 'Other') as StaffPurchasePaymentMethod)
      : 'Salary Deduction';

    const newStatus = deductOtherMode ? 'Paid' : 'Deducted';

    try {
      const response = await window.electron.updateStaffPurchaseStatus(
        pendingStatusChange.purchaseId,
        newStatus,
        resolvedMethod
      );

      if (response.success) {
        setPurchases(prev => prev.map(p =>
          p.id === pendingStatusChange.purchaseId
            ? { ...p, deductionStatus: newStatus, paymentMethod: resolvedMethod }
            : p
        ));
        toast.success(
          deductOtherMode
            ? `Purchase marked as Paid — ${resolvedMethod}`
            : 'Purchase marked as Deducted from salary'
        );
        window.dispatchEvent(new Event('staff:refresh'));
      } else {
        toast.error(response.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status');
    } finally {
      setShowConfirmDialog(false);
      setPendingStatusChange(null);
      setDeductOtherMode(false);
      setDeductSubChoice('');
      setDeductCustomText('');
    }
  };

  const cancelStatusChange = () => {
    setShowConfirmDialog(false);
    setPendingStatusChange(null);
    setDeductOtherMode(false);
    setDeductSubChoice('');
    setDeductCustomText('');
  };

  const getPaymentBadge = (method: string, status: string) => {
    if (status === 'Paid') {
      const color =
        method === 'Cash'  ? 'bg-[#e8f5e9] text-[#2e7d32]' :
        method === 'eSewa' ? 'bg-[#f3e5f5] text-[#7b1fa2]' :
                             'bg-ink/[0.06] text-ink/55';
      return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
          Paid — {method}
        </span>
      );
    }
    if (status === 'Deducted') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success-text">
          Deducted — {method}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning-bg text-warning-text">
        Pending — {method}
      </span>
    );
  };

  const getItemIcon = (category?: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('apparel') || cat.includes('clothing')) return <Shirt size={15} strokeWidth={1.6} />;
    if (cat.includes('accessories')) return <Watch size={15} strokeWidth={1.6} />;
    if (cat.includes('food') || cat.includes('canteen')) return <Coffee size={15} strokeWidth={1.6} />;
    if (cat.includes('footwear') || cat.includes('shoes')) return <Tag size={15} strokeWidth={1.6} />;
    return <ShoppingBag size={15} strokeWidth={1.6} />;
  };

  return (
    <div className="space-y-5">

      {/* ── Section header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-[18px] text-ink">Staff Purchases</h3>
          <p className="text-[13px] text-ink/45 mt-0.5">
            Current month — {MONTHS[currentMonth - 1]} {currentYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] bg-olive text-ink text-[13px] font-semibold hover:bg-[#bcc65c] transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            Add Purchase
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-ink/[0.12] text-[13px] font-semibold text-ink/65 hover:text-ink hover:border-ink/25 transition-colors bg-white"
          >
            <History size={14} strokeWidth={2} />
            History
          </button>
          <button className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-ink/[0.12] text-[13px] font-semibold text-ink/65 hover:text-ink hover:border-ink/25 transition-colors bg-white">
            <Download size={14} strokeWidth={2} />
            Export
          </button>
        </div>
      </div>

      {/* ── Purchases table — current month only ─────────────────────────────── */}
      <div className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-2 border-ink/20 border-t-olive rounded-full animate-spin" />
          </div>
        ) : currentMonthPurchases.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-ink/[0.04] flex items-center justify-center">
              <ShoppingBag size={20} strokeWidth={1.4} className="text-ink/25" />
            </div>
            <p className="font-display font-bold text-[15px] text-ink/35">No Pending Purchases</p>
            <p className="text-[13px] text-ink/30">
              {purchases.length > 0
                ? 'All current purchases have been deducted.'
                : 'Staff member has not made any purchases yet.'}
            </p>
            {purchases.filter(p => p.deductionStatus === 'Deducted').length > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                className="text-[12.5px] font-semibold text-olive hover:text-[#8a9b3f] transition-colors mt-1"
              >
                View deducted purchase history →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink/[0.06] bg-ink/[0.015]">
                <th className="text-left py-3 px-6 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Item</th>
                <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Date</th>
                <th className="text-right py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Amount</th>
                <th className="text-left py-3 px-6 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Deduction Status</th>
              </tr>
            </thead>
            <tbody>
              {currentMonthPurchases.map((row) => (
                <tr key={row.id} className="border-b border-ink/[0.05] last:border-b-0 hover:bg-ink/[0.018] transition-colors">
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[8px] bg-ink/[0.05] flex items-center justify-center text-ink/45 flex-none">
                        {getItemIcon(row.category)}
                      </div>
                      <div>
                        <p className="text-[13.5px] font-semibold text-ink leading-tight">{row.itemName}</p>
                        {row.category && <p className="text-[11.5px] text-ink/40 mt-0.5">{row.category}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[13px] text-ink/60">{formatDate(row.purchaseDate)}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="text-[13.5px] font-semibold text-ink">{formatCurrency(row.amount)}</span>
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="flex flex-col gap-1">
                      {getPaymentBadge(row.paymentMethod || 'Salary Deduction', row.deductionStatus)}
                      {row.deductionStatus === 'Pending' && row.paymentMethod === 'Salary Deduction' && (
                        <button
                          onClick={() => handleStatusChangeRequest(row.id, row.deductionStatus as DeductionStatus)}
                          className="text-[11px] font-semibold text-olive hover:text-[#8a9b3f] transition-colors text-left"
                        >
                          Mark Deducted
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink/[0.03] border-t border-ink/[0.08]">
                <td className="py-3.5 px-6" colSpan={2}>
                  <span className="text-[13px] font-bold text-ink/65 uppercase tracking-wide">Pending This Month</span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="font-display font-bold text-[15px] text-ink">{formatCurrency(monthlyTotal)}</span>
                </td>
                <td className="py-3.5 px-6" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Current-month Paid purchases (Cash / eSewa / Other) ───────────────── */}
      {!loading && currentMonthPaid.length > 0 && (
        <div className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-3.5 border-b border-ink/[0.06] bg-ink/[0.015] flex items-center justify-between">
            <span className="text-[12px] font-bold text-ink/50 uppercase tracking-wide">
              Paid Directly This Month
            </span>
            <span className="text-[11.5px] text-ink/35 font-medium">
              {currentMonthPaid.length} item{currentMonthPaid.length !== 1 ? 's' : ''}
            </span>
          </div>
          <table className="w-full">
            <tbody>
              {currentMonthPaid.map((row) => (
                <tr key={row.id} className="border-b border-ink/[0.05] last:border-b-0 hover:bg-ink/[0.018] transition-colors">
                  <td className="py-3 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-[7px] bg-ink/[0.05] flex items-center justify-center text-ink/40 flex-none">
                        {getItemIcon(row.category)}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-ink">{row.itemName}</p>
                        {row.category && <p className="text-[11px] text-ink/40">{row.category}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[12.5px] text-ink/55">{formatDate(row.purchaseDate)}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-[13px] font-semibold text-ink">{formatCurrency(row.amount)}</span>
                  </td>
                  <td className="py-3 px-6">
                    {getPaymentBadge(row.paymentMethod || 'Other', row.deductionStatus)}
                    {row.paymentNote && (
                      <p className="text-[11px] text-ink/40 mt-0.5">{row.paymentNote}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bottom summary cards ─────────────────────────────────────────────── */}
      {!loading && purchases.length > 0 && (nextDeduction > 0 || yearlyTotal > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {/* Next Deduction */}
          {nextDeduction > 0 && (
            <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-warning-bg flex items-center justify-center flex-none">
                <CalendarClock size={20} strokeWidth={1.6} className="text-warning-text" />
              </div>
              <div>
                <p className="text-[12.5px] text-ink/50 font-medium mb-0.5">Next Deduction</p>
                <p className="font-display font-bold text-[22px] text-ink leading-none">
                  {formatCurrency(nextDeduction)}
                </p>
                <p className="text-[12px] text-ink/40 mt-1">Pending deductions</p>
              </div>
            </div>
          )}

          {/* Yearly Total */}
          {yearlyTotal > 0 && (
            <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-success-bg flex items-center justify-center flex-none">
                <BarChart3 size={20} strokeWidth={1.6} className="text-success-text" />
              </div>
              <div>
                <p className="text-[12.5px] text-ink/50 font-medium mb-0.5">Yearly Total</p>
                <p className="font-display font-bold text-[22px] text-ink leading-none">
                  {formatCurrency(yearlyTotal)}
                </p>
                <p className="text-[12px] text-ink/40 mt-1">Total purchases in {currentYear}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Purchase History Modal ───────────────────────────────────────────── */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHistory(false); }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-2xl mx-4 shadow-2xl max-h-[88vh] flex flex-col">

            {/* Modal header */}
            <div className="px-6 py-5 border-b border-ink/[0.08] flex items-center justify-between flex-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success-bg flex items-center justify-center flex-none">
                  <History size={18} strokeWidth={1.8} className="text-success-text" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-[17px] text-ink">Purchase History</h3>
                  <p className="text-[12.5px] text-ink/45 mt-0.5">Deducted purchases for {staffName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-ink/[0.06] transition-colors"
              >
                <X size={16} strokeWidth={2} className="text-ink/50" />
              </button>
            </div>

            {/* Filter bar */}
            <div className="px-6 py-4 border-b border-ink/[0.06] flex-none bg-ink/[0.015]">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Mode toggle */}
                <div className="flex rounded-[8px] border border-ink/[0.12] overflow-hidden bg-white">
                  <button
                    onClick={() => setFilterMode('month')}
                    className={`h-8 px-3.5 text-[12.5px] font-semibold transition-colors ${
                      filterMode === 'month' ? 'bg-ink text-paper' : 'text-ink/55 hover:text-ink'
                    }`}
                  >
                    By Month
                  </button>
                  <button
                    onClick={() => setFilterMode('day')}
                    className={`h-8 px-3.5 text-[12.5px] font-semibold transition-colors border-l border-ink/[0.12] ${
                      filterMode === 'day' ? 'bg-ink text-paper' : 'text-ink/55 hover:text-ink'
                    }`}
                  >
                    By Day
                  </button>
                </div>

                {filterMode === 'month' ? (
                  <>
                    {/* Month selector */}
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(Number(e.target.value))}
                      className="h-8 px-2.5 rounded-[8px] border border-ink/[0.12] bg-white text-[12.5px] text-ink focus:outline-none focus:border-olive cursor-pointer"
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    {/* Year selector */}
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(Number(e.target.value))}
                      className="h-8 px-2.5 rounded-[8px] border border-ink/[0.12] bg-white text-[12.5px] text-ink focus:outline-none focus:border-olive cursor-pointer"
                    >
                      {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  /* Day picker */
                  <input
                    type="date"
                    value={filterDay}
                    onChange={(e) => setFilterDay(e.target.value)}
                    className="h-8 px-2.5 rounded-[8px] border border-ink/[0.12] bg-white text-[12.5px] text-ink focus:outline-none focus:border-olive"
                  />
                )}

                {/* Result count */}
                <span className="text-[12px] text-ink/40 ml-auto">
                  {historyPurchases.length} record{historyPurchases.length !== 1 ? 's' : ''}
                  {' · '}
                  {historyPeriodLabel}
                </span>
              </div>
            </div>

            {/* Modal body — scrollable table */}
            <div className="flex-1 overflow-y-auto">
              {historyPurchases.length === 0 ? (
                <div className="py-14 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-ink/[0.04] flex items-center justify-center">
                    <History size={20} strokeWidth={1.4} className="text-ink/25" />
                  </div>
                  <p className="font-display font-bold text-[15px] text-ink/35">No Records Found</p>
                  <p className="text-[13px] text-ink/30">No deducted purchases for {historyPeriodLabel}.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-white border-b border-ink/[0.06]">
                    <tr className="bg-ink/[0.015]">
                      <th className="text-left py-3 px-6 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Item</th>
                      <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Date</th>
                      <th className="text-right py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Amount</th>
                      <th className="text-left py-3 px-6 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Settlement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyPurchases.map((row) => (
                      <tr key={row.id} className="border-b border-ink/[0.05] last:border-b-0 hover:bg-ink/[0.018] transition-colors">
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-[7px] bg-ink/[0.05] flex items-center justify-center text-ink/40 flex-none">
                              {getItemIcon(row.category)}
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-ink">{row.itemName}</p>
                              {row.category && <p className="text-[11px] text-ink/40">{row.category}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[12.5px] text-ink/60">{formatDate(row.purchaseDate)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[13px] font-semibold text-ink">{formatCurrency(row.amount)}</span>
                        </td>
                        <td className="py-3 px-6">
                          <div className="flex flex-col gap-1">
                            {getPaymentBadge(row.paymentMethod || 'Salary Deduction', row.deductionStatus)}
                            {row.paymentNote && (
                              <p className="text-[11px] text-ink/40">{row.paymentNote}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink/[0.03] border-t border-ink/[0.08]">
                      <td className="py-3 px-6" colSpan={2}>
                        <span className="text-[12.5px] font-bold text-ink/65 uppercase tracking-wide">
                          Total — {historyPeriodLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-display font-bold text-[14px] text-ink">{formatCurrency(historyTotal)}</span>
                      </td>
                      <td className="py-3 px-6" />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-ink/[0.08] flex items-center justify-end flex-none">
              <button
                onClick={() => setShowHistory(false)}
                className="h-10 px-6 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Add Purchase Modal ───────────────────────────────────────────────── */}
      {showAddForm && (
        <div 
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setShowAddForm(false);
              setFormErrors({});
            }
          }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-md mx-4 shadow-2xl">
            
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-ink/[0.08]">
              <h3 className="font-display font-bold text-[18px] text-ink">Add Purchase</h3>
              <p className="text-[13px] text-ink/45 mt-1">
                Record a new purchase for {staffName}
              </p>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              
              {/* Item Name */}
              <div>
                <label className="block text-[13px] font-semibold text-ink/70 mb-2">
                  Item Name <span className="text-danger-text">*</span>
                </label>
                <input
                  type="text"
                  value={formData.itemName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, itemName: e.target.value }));
                    if (formErrors.itemName) setFormErrors(prev => ({ ...prev, itemName: '' }));
                  }}
                  placeholder="e.g., Polo Shirt - Navy Blue"
                  className={`w-full h-11 px-4 rounded-[9px] border ${
                    formErrors.itemName ? 'border-danger-text' : 'border-ink/[0.12]'
                  } text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-olive`}
                />
                {formErrors.itemName && (
                  <p className="text-[11.5px] text-danger-text mt-1.5">{formErrors.itemName}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-[13px] font-semibold text-ink/70 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Apparel, Accessories, Canteen"
                  className="w-full h-11 px-4 rounded-[9px] border border-ink/[0.12] text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-olive"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[13px] font-semibold text-ink/70 mb-2">
                  Amount <span className="text-danger-text">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, amount: e.target.value }));
                    if (formErrors.amount) setFormErrors(prev => ({ ...prev, amount: '' }));
                  }}
                  placeholder="0.00"
                  className={`w-full h-11 px-4 rounded-[9px] border ${
                    formErrors.amount ? 'border-danger-text' : 'border-ink/[0.12]'
                  } text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-olive`}
                />
                {formErrors.amount && (
                  <p className="text-[11.5px] text-danger-text mt-1.5">{formErrors.amount}</p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-[13px] font-semibold text-ink/70 mb-2">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                  className="w-full h-11 px-4 rounded-[9px] border border-ink/[0.12] text-[13.5px] text-ink focus:outline-none focus:border-olive"
                />
              </div>

              {/* Payment Note — optional */}
              <div>
                <label className="block text-[13px] font-semibold text-ink/70 mb-2">
                  Note <span className="text-ink/35 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.paymentNote}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentNote: e.target.value }))}
                  placeholder="Any additional notes..."
                  className="w-full h-11 px-4 rounded-[9px] border border-ink/[0.12] text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-olive"
                />
              </div>

            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-ink/[0.08] flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  if (!saving) {
                    setShowAddForm(false);
                    setFormErrors({});
                  }
                }}
                disabled={saving}
                className="h-10 px-5 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPurchase}
                disabled={saving}
                className="flex items-center gap-2 h-10 px-5 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Add Purchase'
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Settle Purchase Dialog ───────────────────────────────────────────── */}
      {showConfirmDialog && pendingStatusChange && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) cancelStatusChange(); }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-md mx-4 shadow-2xl">

            {/* Header */}
            <div className="px-6 py-5 border-b border-ink/[0.08]">
              <h3 className="font-display font-bold text-[17px] text-ink">How was this settled?</h3>
              <p className="text-[13px] text-ink/45 mt-0.5">
                Choose how this purchase was or will be paid.
              </p>
            </div>

            {/* Payment method choice */}
            <div className="px-6 py-5 space-y-4">

              {/* Two top-level choices */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeductOtherMode(false);
                    setDeductSubChoice('');
                    setDeductCustomText('');
                  }}
                  className={`h-11 rounded-[10px] text-[13px] font-semibold border transition-colors ${
                    !deductOtherMode
                      ? 'bg-olive/15 border-olive text-ink'
                      : 'border-ink/[0.12] text-ink/55 hover:border-ink/25 hover:text-ink'
                  }`}
                >
                  Salary Deduction
                </button>
                <button
                  type="button"
                  onClick={() => setDeductOtherMode(true)}
                  className={`h-11 rounded-[10px] text-[13px] font-semibold border transition-colors ${
                    deductOtherMode
                      ? 'bg-olive/15 border-olive text-ink'
                      : 'border-ink/[0.12] text-ink/55 hover:border-ink/25 hover:text-ink'
                  }`}
                >
                  Other
                </button>
              </div>

              {/* Other sub-panel */}
              {deductOtherMode && (
                <div className="rounded-[10px] border border-ink/[0.10] bg-ink/[0.02] p-3.5 space-y-3">
                  {/* Quick-select */}
                  <div>
                    <p className="text-[11.5px] font-semibold text-ink/45 mb-2">Quick select</p>
                    <div className="flex gap-2">
                      {(['Cash', 'eSewa'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setDeductSubChoice(opt);
                            setDeductCustomText('');
                          }}
                          className={`h-8 px-4 rounded-[8px] text-[12.5px] font-semibold border transition-colors ${
                            deductSubChoice === opt
                              ? 'bg-ink text-paper border-ink'
                              : 'border-ink/[0.14] text-ink/55 hover:text-ink hover:border-ink/30'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-ink/[0.08]" />
                    <span className="text-[11px] text-ink/30 font-medium">or enter manually</span>
                    <div className="flex-1 h-px bg-ink/[0.08]" />
                  </div>

                  {/* Custom free-text */}
                  <input
                    type="text"
                    value={deductCustomText}
                    onChange={(e) => {
                      setDeductCustomText(e.target.value);
                      if (e.target.value) setDeductSubChoice('');
                    }}
                    placeholder="e.g., Bank Transfer, Mobile Banking..."
                    className="w-full h-10 px-3.5 rounded-[9px] border border-ink/[0.12] bg-white text-[13px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-olive"
                  />
                </div>
              )}

              {/* Helper text */}
              <p className={`text-[12px] ${deductOtherMode ? 'text-success-text' : 'text-ink/40'}`}>
                {deductOtherMode
                  ? 'Will be marked as Paid — not deducted from salary.'
                  : 'Will be marked as Deducted from monthly salary.'}
              </p>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-ink/[0.08] flex items-center justify-end gap-3">
              <button
                onClick={cancelStatusChange}
                className="h-10 px-5 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={deductOtherMode && !deductSubChoice && !deductCustomText.trim()}
                className="h-10 px-5 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

// ─── Salary tab ───────────────────────────────────────────────────────────────

interface SalaryTabProps {
  staffId: string;
  staffName: string;
  baseSalary: number; // From staff member record
}

const SalaryTab = ({ staffId, staffName, baseSalary }: SalaryTabProps) => {
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState<StaffSalaryRecord | null>(null);
  const [allSalaryRecords, setAllSalaryRecords] = useState<StaffSalaryRecord[]>([]);
  const [payslips, setPayslips] = useState<StaffPayslip[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showPayslipsModal, setShowPayslipsModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<StaffPayslip | null>(null);

  // ── Live deductions (Part B) ───────────────────────────────────────────────
  const [liveDeductions, setLiveDeductions] = useState<number | null>(null);

  // ── Bonus editing state (Part A) ──────────────────────────────────────────
  const [showBonusInput, setShowBonusInput]         = useState(false);
  const [bonusInputValue, setBonusInputValue]       = useState('');
  const [showBonusConfirm, setShowBonusConfirm]     = useState(false);
  const [pendingBonus, setPendingBonus]             = useState<number>(0);
  const [savingBonus, setSavingBonus]               = useState(false);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateStr: string | Date): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getMonthName = (month: number): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || '';
  };

  // Fetch all salary records and current period data
  const fetchSalaryData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      // Fetch current period salary record
      const response = await window.electron.getStaffSalaryForPeriod(staffId, currentYear, currentMonth);
      if (response.success && response.data) {
        setSalaryData(response.data);
      } else {
        setSalaryData(null);
      }

      // Fetch all salary history to match with payslips
      const historyResponse = await window.electron.getStaffSalaryHistory(staffId);
      if (historyResponse.success && historyResponse.data) {
        setAllSalaryRecords(historyResponse.data);
      }

      // Part B: Fetch live "Deducted" purchases for current month
      const purchasesResponse = await window.electron.getStaffPurchases(staffId, {
        year: currentYear,
        month: currentMonth,
      });
      if (purchasesResponse.success && purchasesResponse.data) {
        const liveSum = (purchasesResponse.data as StaffPurchase[])
          .filter((p) => p.deductionStatus === 'Deducted' && p.paymentMethod === 'Salary Deduction')
          .reduce((sum, p) => sum + p.amount, 0);
        setLiveDeductions(liveSum);
      }
    } catch (err) {
      console.error('Error fetching salary data:', err);
      toast.error('Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  // Part A: Bonus save handler
  const handleBonusSaveRequest = () => {
    const parsed = parseFloat(bonusInputValue);
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Please enter a valid bonus amount');
      return;
    }
    setPendingBonus(parsed);
    setShowBonusInput(false);
    setShowBonusConfirm(true);
  };

  const confirmBonusSave = async () => {
    try {
      setSavingBonus(true);
      const response = await window.electron.processStaffSalary(
        staffId,
        currentYear,
        currentMonth,
        pendingBonus,
        salaryData?.otherDeductions ?? 0,
        salaryData?.notes,
      );

      if (response.success && response.data) {
        setSalaryData(response.data);
        // Keep allSalaryRecords in sync
        setAllSalaryRecords((prev) => {
          const exists = prev.find((r) => r.id === response.data.id);
          return exists
            ? prev.map((r) => (r.id === response.data.id ? response.data : r))
            : [response.data, ...prev];
        });
        toast.success(`Bonus set to ${formatCurrency(pendingBonus)} for ${currentPeriodLabel}`);
      } else {
        toast.error(response.error || 'Failed to save bonus');
      }
    } catch (err) {
      console.error('Error saving bonus:', err);
      toast.error('Failed to save bonus');
    } finally {
      setSavingBonus(false);
      setShowBonusConfirm(false);
    }
  };

  // Fetch payslips history
  const fetchPayslips = async () => {
    try {
      const response = await window.electron.getStaffPayslips(staffId);
      
      if (response.success && response.data) {
        setPayslips(response.data);
      }
    } catch (err) {
      console.error('Error fetching payslips:', err);
    }
  };

  useEffect(() => {
    fetchSalaryData();
    fetchPayslips();
  }, [staffId]);

  // Current period constants — defined here so handlers above can use them
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentPeriodLabel = `${getMonthName(currentMonth)} ${currentYear}`;

  // Calculate display values
  // Part B: Use live deductions sum for display; fall back to stored snapshot only
  //         when live data hasn't loaded yet
  const currentBaseSalary = salaryData?.baseSalary ?? baseSalary;
  const bonus             = salaryData?.bonusAmount ?? 0;
  const deductions        = liveDeductions ?? salaryData?.purchaseDeductions ?? 0;
  // Net payable computed live from current values (reflects bonus edits and live deductions)
  const netPayable        = currentBaseSalary + bonus - deductions;

  // Check if payslip exists for current period
  const currentPeriodPayslip = payslips.find(
    p => salaryData && p.salaryRecordId === salaryData.id
  );

  // Handle generate payslip
  const handleGeneratePayslip = async () => {
    // Check if salary record exists
    if (!salaryData) {
      // Need to create salary record first
      try {
        setGenerating(true);
        const processResponse = await window.electron.processStaffSalary(
          staffId,
          currentYear,
          currentMonth,
          bonus,  // carry current bonus into the new record
          0,
          `Salary for ${currentPeriodLabel}`
        );

        if (!processResponse.success || !processResponse.data) {
          toast.error('Failed to process salary record');
          return;
        }

        const newSalaryRecord = processResponse.data;
        setSalaryData(newSalaryRecord);
        setAllSalaryRecords(prev => [newSalaryRecord, ...prev]);

        // Now generate payslip
        const payslipResponse = await window.electron.generateStaffPayslip(
          staffId,
          newSalaryRecord.id
        );

        if (payslipResponse.success && payslipResponse.data) {
          toast.success('Payslip generated successfully');
          setPayslips(prev => [payslipResponse.data, ...prev]);
          
          // Trigger refresh
          window.dispatchEvent(new Event('staff:refresh'));
        } else {
          toast.error(payslipResponse.error || 'Failed to generate payslip');
        }
      } catch (err) {
        console.error('Error generating payslip:', err);
        toast.error('Failed to generate payslip');
      } finally {
        setGenerating(false);
      }
      return;
    }

    // Check if payslip already exists for this period
    if (currentPeriodPayslip) {
      toast.info(`Payslip for ${currentPeriodLabel} already exists`);
      return;
    }

    // Generate payslip
    try {
      setGenerating(true);
      const response = await window.electron.generateStaffPayslip(
        staffId,
        salaryData.id
      );

      if (response.success && response.data) {
        toast.success('Payslip generated successfully');
        setPayslips(prev => [response.data, ...prev]);
        
        // Trigger refresh
        window.dispatchEvent(new Event('staff:refresh'));
      } else {
        toast.error(response.error || 'Failed to generate payslip');
      }
    } catch (err) {
      console.error('Error generating payslip:', err);
      toast.error('Failed to generate payslip');
    } finally {
      setGenerating(false);
    }
  };

  const fmt = formatCurrency;

  return (
    <div className="flex flex-col items-center gap-5">

      {/* ── Salary Summary card ──────────────────────────────────────────────── */}
      <div className="bg-white border border-ink/[0.08] rounded-2xl p-8 w-full max-w-lg">

        {/* Card title */}
        <div className="text-center mb-6">
          <h3 className="font-display font-bold text-[18px] text-ink">
            Salary Summary
          </h3>
          <p className="text-[12px] text-ink/45 mt-1">
            Period: {currentPeriodLabel}
          </p>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-ink/20 border-t-olive rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-0">

            {/* Base Salary */}
            <div className="flex items-center justify-between py-3.5 border-b border-ink/[0.06]">
              <span className="text-[13.5px] text-ink/60 font-medium">Base Salary</span>
              <span className="text-[13.5px] font-semibold text-ink">{fmt(currentBaseSalary)}</span>
            </div>

            {/* Bonus */}
            <div className="flex items-center justify-between py-3.5 border-b border-ink/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] text-ink/60 font-medium">Bonus</span>
                {/* Edit trigger */}
                {!showBonusInput && (
                  <button
                    onClick={() => {
                      setBonusInputValue(bonus > 0 ? bonus.toFixed(2) : '');
                      setShowBonusInput(true);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-[6px] text-ink/30 hover:text-olive hover:bg-olive/10 transition-colors"
                    title="Edit bonus"
                  >
                    <Pencil size={12} strokeWidth={2} />
                  </button>
                )}
              </div>

              {showBonusInput ? (
                /* Inline bonus input with Save / Cancel */
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink/40">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bonusInputValue}
                      onChange={(e) => setBonusInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleBonusSaveRequest();
                        if (e.key === 'Escape') setShowBonusInput(false);
                      }}
                      autoFocus
                      placeholder="0.00"
                      className="w-28 h-8 pl-6 pr-2.5 rounded-[7px] border border-olive/60 bg-white text-[13px] text-ink focus:outline-none focus:border-olive text-right"
                    />
                  </div>
                  <button
                    onClick={handleBonusSaveRequest}
                    className="h-8 px-3 rounded-[7px] bg-olive text-ink text-[12px] font-semibold hover:bg-[#bcc65c] transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowBonusInput(false)}
                    className="h-8 px-2.5 rounded-[7px] border border-ink/[0.14] text-[12px] font-semibold text-ink/55 hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <span className="text-[13.5px] font-semibold text-success-text">
                  {bonus > 0 ? `+${fmt(bonus)}` : fmt(0)}
                </span>
              )}
            </div>

            {/* Deductions — always a live sum of Deducted purchases */}
            <div className="flex items-center justify-between py-3.5 border-b border-ink/[0.06]">
              <span className="text-[13.5px] text-ink/60 font-medium">
                Deductions
                <span className="ml-1.5 text-[11px] font-semibold text-ink/35 normal-case">
                  (Staff Purchases)
                </span>
              </span>
              <span className="text-[13.5px] font-semibold text-danger-text">
                {deductions > 0 ? `−${fmt(deductions)}` : fmt(0)}
              </span>
            </div>

            {/* Divider */}
            <div className="pt-4 pb-1">
              <div className="h-px bg-ink/[0.10]" />
            </div>

            {/* Net Payable */}
            <div className="flex items-center justify-between pt-3">
              <span className="font-display font-bold text-[15px] text-ink">Net Payable</span>
              <span className="font-display font-bold text-[22px] text-ink">{fmt(netPayable)}</span>
            </div>

          </div>
        )}
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button 
          onClick={handleGeneratePayslip}
          disabled={generating || loading}
          className="flex items-center gap-2 h-10 px-6 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText size={15} strokeWidth={2} />
              Generate Payslip
            </>
          )}
        </button>
        <button 
          onClick={() => setShowPayslipsModal(true)}
          disabled={loading}
          className="flex items-center gap-2 h-10 px-6 rounded-[9px] border border-ink/[0.14] bg-white text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
        >
          <History size={15} strokeWidth={2} />
          View Past Payslips
        </button>
      </div>

      {/* ── Bonus Confirmation Dialog ────────────────────────────────────────── */}
      {showBonusConfirm && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !savingBonus) setShowBonusConfirm(false); }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-md mx-4 shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-11 h-11 rounded-xl bg-success-bg flex items-center justify-center flex-none">
                <Wallet size={20} strokeWidth={1.8} className="text-success-text" />
              </div>
              <div>
                <h3 className="font-display font-bold text-[16px] text-ink mb-1">
                  Set Bonus?
                </h3>
                <p className="text-[13px] text-ink/60 leading-relaxed">
                  Are you sure you want to set the bonus to{' '}
                  <span className="font-bold text-ink">{fmt(pendingBonus)}</span>{' '}
                  for <span className="font-semibold text-ink">{staffName}</span>{' '}
                  for {currentPeriodLabel}?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowBonusConfirm(false); setBonusInputValue(''); }}
                disabled={savingBonus}
                className="h-10 px-5 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBonusSave}
                disabled={savingBonus}
                className="flex items-center gap-2 h-10 px-5 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors disabled:opacity-50"
              >
                {savingBonus ? (
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

      {/* ── Past Payslips Modal ──────────────────────────────────────────────── */}
      {showPayslipsModal && (
        <div 
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPayslipsModal(false);
              setSelectedPayslip(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-3xl mx-4 shadow-2xl max-h-[85vh] flex flex-col">
            
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-ink/[0.08]">
              <h3 className="font-display font-bold text-[18px] text-ink">Past Payslips</h3>
              <p className="text-[13px] text-ink/45 mt-1">
                Payslip history for {staffName}
              </p>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 overflow-y-auto flex-1">
              
              {payslips.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-ink/[0.04] flex items-center justify-center">
                    <FileText size={20} strokeWidth={1.4} className="text-ink/25" />
                  </div>
                  <p className="font-display font-bold text-[15px] text-ink/35">No Payslips Yet</p>
                  <p className="text-[13px] text-ink/30">No payslips have been generated for this staff member.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payslips.map((payslip) => {
                    // Find associated salary record
                    const salaryRecord = allSalaryRecords.find(r => r.id === payslip.salaryRecordId);
                    const periodLabel = salaryRecord 
                      ? `${getMonthName(salaryRecord.salaryMonth)} ${salaryRecord.salaryYear}`
                      : 'Unknown Period';
                    const amount = salaryRecord?.netPayable ?? 0;

                    return (
                      <div
                        key={payslip.id}
                        className="bg-white border border-ink/[0.08] rounded-xl p-5 hover:border-ink/20 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-olive/10 flex items-center justify-center flex-none">
                              <FileText size={18} strokeWidth={1.8} className="text-olive" />
                            </div>
                            <div>
                              <p className="font-semibold text-[14px] text-ink">
                                {payslip.payslipNumber}
                              </p>
                              <p className="text-[12px] text-ink/50 mt-0.5">
                                {periodLabel} • Generated {formatDate(payslip.generatedAt)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-bold text-[16px] text-ink">
                              {fmt(amount)}
                            </p>
                            <button
                              onClick={() => setSelectedPayslip(payslip)}
                              className="text-[12px] font-semibold text-olive hover:text-[#8a9b3f] transition-colors mt-1"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-ink/[0.08] flex items-center justify-end">
              <button
                onClick={() => {
                  setShowPayslipsModal(false);
                  setSelectedPayslip(null);
                }}
                className="h-10 px-5 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Payslip Details Modal ────────────────────────────────────────────── */}
      {selectedPayslip && (() => {
        const salaryRecord = allSalaryRecords.find(r => r.id === selectedPayslip.salaryRecordId);
        const periodLabel = salaryRecord 
          ? `${getMonthName(salaryRecord.salaryMonth)} ${salaryRecord.salaryYear}`
          : 'Unknown Period';
        const netAmount = salaryRecord?.netPayable ?? 0;

        return (
          <div 
            className="fixed inset-0 bg-ink/40 flex items-center justify-center z-[60] backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedPayslip(null);
            }}
          >
            <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-md mx-4 shadow-2xl">
              
              {/* Modal header */}
              <div className="px-6 py-5 border-b border-ink/[0.08]">
                <h3 className="font-display font-bold text-[18px] text-ink">Payslip Details</h3>
                <p className="text-[13px] text-ink/45 mt-1">
                  {selectedPayslip.payslipNumber}
                </p>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4">
                
                <div className="bg-ink/[0.03] rounded-xl p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[12.5px] text-ink/60 font-medium">Staff Member</span>
                    <span className="text-[13px] font-semibold text-ink">{staffName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12.5px] text-ink/60 font-medium">Period</span>
                    <span className="text-[13px] font-semibold text-ink">{periodLabel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12.5px] text-ink/60 font-medium">Generated On</span>
                    <span className="text-[13px] font-semibold text-ink">{formatDate(selectedPayslip.generatedAt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12.5px] text-ink/60 font-medium">Payslip Number</span>
                    <span className="text-[13px] font-semibold text-ink">{selectedPayslip.payslipNumber}</span>
                  </div>
                </div>

                {salaryRecord && (
                  <div className="bg-ink/[0.03] rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-[12.5px]">
                      <span className="text-ink/60">Base Salary</span>
                      <span className="font-semibold text-ink">{fmt(salaryRecord.baseSalary)}</span>
                    </div>
                    {salaryRecord.bonusAmount > 0 && (
                      <div className="flex justify-between items-center text-[12.5px]">
                        <span className="text-ink/60">Bonus</span>
                        <span className="font-semibold text-success-text">+{fmt(salaryRecord.bonusAmount)}</span>
                      </div>
                    )}
                    {salaryRecord.purchaseDeductions > 0 && (
                      <div className="flex justify-between items-center text-[12.5px]">
                        <span className="text-ink/60">Deductions</span>
                        <span className="font-semibold text-danger-text">−{fmt(salaryRecord.purchaseDeductions)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-center py-4">
                  <p className="text-[12px] text-ink/45 mb-2">Net Amount Paid</p>
                  <p className="font-display font-bold text-[28px] text-olive">
                    {fmt(netAmount)}
                  </p>
                </div>

              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 border-t border-ink/[0.08] flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="h-10 px-5 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => toast.info('PDF download coming soon')}
                  className="h-10 px-5 rounded-[9px] bg-olive text-ink text-[13.5px] font-semibold hover:bg-[#bcc65c] transition-colors"
                >
                  Download PDF
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

// ─── Overview tab content ─────────────────────────────────────────────────────

interface OverviewStats {
  attendancePercentage: number;
  attendanceTrend: string;
  tasksCompleted: number;
  tasksPending: number;
  totalPurchases: number;
  purchasesValue: number;
  latestSalary: number;
  salaryNote: string;
}

interface OverviewTabProps {
  stats: OverviewStats | null;
  loading: boolean;
}

const OverviewTab = ({ stats, loading }: OverviewTabProps) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={32} className="text-ink/30 animate-spin" />
        <p className="text-sm text-ink/40">Loading overview...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle size={32} className="text-danger-text" />
        <p className="text-sm text-danger-text font-medium">Failed to load overview data</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<CalendarCheck size={16} strokeWidth={1.6} />}
          label="Attendance"
          value={`${stats.attendancePercentage}%`}
          note={stats.attendanceTrend}
          noteColor={stats.attendancePercentage >= 90 ? "text-success-text" : stats.attendancePercentage >= 75 ? "text-warning-text" : "text-danger-text"}
        />
        <StatCard
          icon={<CheckSquare size={16} strokeWidth={1.6} />}
          label="Tasks Completed"
          value={stats.tasksCompleted.toString()}
          note={stats.tasksPending > 0 ? `${stats.tasksPending} pending items` : 'All caught up!'}
          noteColor={stats.tasksPending > 0 ? "text-warning-text" : "text-success-text"}
        />
        <StatCard
          icon={<ShoppingBag size={16} strokeWidth={1.6} />}
          label="Total Purchases"
          value={stats.totalPurchases.toString()}
          note={`${formatCurrency(stats.purchasesValue)} total value`}
        />
        <StatCard
          icon={<Wallet size={16} strokeWidth={1.6} />}
          label="Net Salary"
          value={formatCurrency(stats.latestSalary)}
          note={stats.salaryNote}
          noteColor="text-success-text"
        />
      </div>

      {/* Bottom two-column layout */}
      <div className="grid grid-cols-[1.15fr_1fr] gap-5">

        {/* Recent Activity - not yet connected to live data */}
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-[17px] text-ink">Recent Activity</h3>
            <span className="text-[11px] font-semibold text-ink/35 uppercase tracking-wide bg-ink/[0.05] px-2.5 py-1 rounded-full">
              Coming Soon
            </span>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-[17px] top-0 bottom-0 w-px bg-ink/[0.07]" />

            <div className="space-y-0">
              {RECENT_ACTIVITY.map((item, idx) => (
                <div key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {/* Icon dot */}
                  <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-none ${item.iconBg}`}>
                    {item.icon}
                  </div>
                  {/* Content */}
                  <div className="pt-1.5 flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13.5px] font-semibold text-ink">{item.title}</p>
                      <span className="text-[11.5px] text-ink/40 flex-none">{item.time.split('—')[0].trim().replace(', ', '\u00A0')}</span>
                    </div>
                    <p className="text-[12.5px] text-ink/50 mt-0.5 leading-relaxed">{item.description}</p>
                    {idx < RECENT_ACTIVITY.length - 1 && <div className="mt-4" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task Priority - not yet connected to live data */}
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-[17px] text-ink">Task Priority</h3>
            <span className="text-[11px] font-semibold text-ink/35 uppercase tracking-wide bg-ink/[0.05] px-2.5 py-1 rounded-full">
              Coming Soon
            </span>
          </div>

          <div className="space-y-5">
            {TASK_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-ink/70">{cat.label}</span>
                  <span className="text-[13px] font-bold text-ink">{cat.percent}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-ink/[0.07] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat.color} transition-all duration-500`}
                    style={{ width: `${cat.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Manager review callout */}
          <div className="mt-6 rounded-[10px] bg-paper border border-ink/[0.07] p-4 relative">
            <Quote
              size={28}
              strokeWidth={1.2}
              className="absolute top-3 right-3 text-ink/[0.08]"
            />
            <p className="text-[13px] text-ink/65 leading-relaxed pr-6">
              Consistently meets deadlines and takes initiative on stock reconciliation. A reliable team member with strong attention to detail.
            </p>
            <p className="text-[11.5px] font-semibold text-ink/40 mt-3">
              — Store Manager note
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

// ─── Main page component ──────────────────────────────────────────────────────

const StaffProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  
  // State
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showNotify, setShowNotify] = useState(false);

  // Fetch staff data
  useEffect(() => {
    const fetchStaff = async () => {
      if (!id) {
        setError('No staff ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await window.electron.getStaffById(id);
        if (response.success && response.data) {
          setStaff(response.data);
        } else {
          setError(response.error || 'Staff member not found');
        }
      } catch (err) {
        console.error('Error fetching staff:', err);
        setError('Failed to load staff member');
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [id]);

  // Fetch overview stats when staff is loaded and overview tab is active
  useEffect(() => {
    const fetchOverviewStats = async () => {
      if (!staff || activeTab !== 'overview') return;

      try {
        setStatsLoading(true);

        // Fetch attendance records for the last 30 days
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;

        const attendanceRes = await window.electron.getStaffAttendance(
          staff.id,
          currentYear,
          currentMonth
        );

        // Calculate attendance percentage
        const attendanceRecords: StaffAttendanceRecord[] = attendanceRes.success ? attendanceRes.data : [];
        const presentDays = attendanceRecords.filter(r => r.status === 'Present').length;
        const totalDays = attendanceRecords.length || 1;
        const attendancePercentage = Math.round((presentDays / totalDays) * 100);
        const trend = attendancePercentage >= 90 ? 'Excellent' : attendancePercentage >= 75 ? 'Good' : 'Needs Improvement';

        // Fetch tasks
        const tasksRes = await window.electron.getStaffTasks(staff.id);
        const tasks: StaffTask[] = tasksRes.success ? tasksRes.data : [];
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in-progress').length;

        // Fetch purchases
        const purchasesRes = await window.electron.getStaffPurchases(staff.id, {
          year: currentYear,
          month: currentMonth,
        });
        const purchases: StaffPurchase[] = purchasesRes.success ? purchasesRes.data : [];
        const purchasesValue = purchases.reduce((sum, p) => sum + p.amount, 0);

        // Fetch latest salary
        const salaryRes = await window.electron.getStaffSalaryForPeriod(
          staff.id,
          currentYear,
          currentMonth
        );
        const latestSalary = salaryRes.success && salaryRes.data
          ? salaryRes.data.netPayable
          : staff.baseSalary;

        setOverviewStats({
          attendancePercentage,
          attendanceTrend: trend,
          tasksCompleted: completedTasks,
          tasksPending: pendingTasks,
          totalPurchases: purchases.length,
          purchasesValue,
          latestSalary,
          salaryNote: `Base: ${formatCurrency(staff.baseSalary)}`,
        });
      } catch (err) {
        console.error('Error fetching overview stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchOverviewStats();
  }, [staff, activeTab]);

  // Handle Edit Profile
  const handleEditProfile = () => {
    if (staff) {
      navigate(`/staff/edit/${staff.id}`);
    }
  };

  // Handle permanent delete
  const handleDelete = async () => {
    if (!staff) return;
    try {
      setDeleting(true);
      const res = await window.electron.hardDeleteStaff(
        staff.id,
        staff.portalUserId ?? undefined
      );
      if (res.success) {
        toast.success(`${staff.firstName} ${staff.lastName} has been permanently deleted.`);
        window.dispatchEvent(new Event('staff:refresh'));
        navigate('/staff');
      } else {
        toast.error(res.error ?? 'Failed to delete staff member.');
      }
    } catch (err) {
      console.error('Delete staff error:', err);
      toast.error('Failed to delete staff member.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 size={40} className="text-ink/30 animate-spin" />
        <p className="text-sm text-ink/40">Loading staff profile...</p>
      </div>
    );
  }

  // Error state
  if (error || !staff) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertCircle size={40} className="text-danger-text" />
        <p className="font-display font-bold text-[20px] text-ink/40">
          {error || 'Staff member not found.'}
        </p>
        <button
          onClick={() => navigate('/staff')}
          className="flex items-center gap-2 text-[13px] font-semibold text-ink/55 hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back to Staff Directory
        </button>
      </div>
    );
  }

  const initials = getInitials(staff.firstName, staff.lastName);
  const avatarColor = getAvatarColor(staff.id);

  return (
    <div className="space-y-0">

      {/* ── Back navigation ──────────────────────────────────────────────────── */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/staff')}
          className="flex items-center gap-1.5 text-[13px] font-medium text-ink/45 hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Staff Management
        </button>
      </div>

      {/* ── Profile Banner ────────────────────────────────────────────────────── */}
      <div className="bg-ink rounded-2xl px-8 py-8 mb-0">
        <div className="flex items-start justify-between gap-6">

          {/* Left: avatar + info */}
          <div className="flex items-start gap-6">
            {/* Avatar */}
            {staff.photoUrl ? (
              <img
                src={staff.photoUrl}
                alt={`${staff.firstName} ${staff.lastName}`}
                className="w-20 h-20 rounded-full object-cover flex-none shadow-lg"
                onError={(e) => {
                  // Hide the broken img and show initials via sibling element
                  e.currentTarget.style.display = 'none';
                  const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (sib) sib.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-display font-bold text-[26px] text-ink flex-none shadow-lg"
              style={{ backgroundColor: avatarColor, display: staff.photoUrl ? 'none' : 'flex' }}
            >
              {initials}
            </div>

            {/* Text info */}
            <div className="pt-1">
              {/* Name + status */}
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display font-bold text-[28px] text-paper leading-tight">
                  {staff.firstName} {staff.lastName}
                </h1>
                <AttendanceBadge status={staff.currentAttendanceStatus} />
              </div>

              {/* Role in accent color */}
              <p className="text-[14.5px] font-semibold text-olive mb-4">
                {staff.jobTitle} · <span className="text-paper/45 font-normal">{staff.staffCode}</span>
              </p>

              {/* Contact + location row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="flex items-center gap-1.5 text-[13px] text-paper/60">
                  <Mail size={13} strokeWidth={1.8} className="text-paper/40 flex-none" />
                  {staff.email || 'No email'}
                </span>
                <span className="flex items-center gap-1.5 text-[13px] text-paper/60">
                  <Phone size={13} strokeWidth={1.8} className="text-paper/40 flex-none" />
                  {staff.phone || 'No phone'}
                </span>
                <span className="flex items-center gap-1.5 text-[13px] text-paper/60">
                  <MapPin size={13} strokeWidth={1.8} className="text-paper/40 flex-none" />
                  {staff.branch || 'No branch'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2.5 flex-none pt-1">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] border border-danger-text/30 text-[13px] font-semibold text-danger-text/70 hover:text-danger-text hover:border-danger-text/60 transition-colors bg-transparent"
              title="Permanently delete this staff member"
            >
              <Trash2 size={13} strokeWidth={2} />
              Delete
            </button>
            <button 
              onClick={handleEditProfile}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-paper/[0.18] text-[13px] font-semibold text-paper/75 hover:text-paper hover:border-paper/35 transition-colors bg-transparent"
            >
              <Pencil size={13} strokeWidth={2} />
              Edit Profile
            </button>
            <button
              onClick={() => setShowNotify(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] bg-olive text-ink text-[13px] font-semibold hover:bg-[#bcc65c] transition-colors"
            >
              <Bell size={13} strokeWidth={2} />
              Notify
            </button>
          </div>

        </div>
      </div>

      {/* ── Tab navigation ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-ink/[0.08] border-t-0 rounded-b-2xl -mt-1 mb-5">
        <div className="flex items-center px-6 border-b border-ink/[0.07]">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-4 px-1 mr-7 text-[13.5px] font-semibold transition-colors ${
                  isActive ? 'text-olive-deep' : 'text-ink/40 hover:text-ink/70'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-olive" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────────────── */}
        <div className="p-6">
          {activeTab === 'overview'   && <OverviewTab stats={overviewStats} loading={statsLoading} />}
          {activeTab === 'attendance' && <AttendanceTab staffId={staff.id} />}
          {activeTab === 'tasks'      && <TasksTab staffId={staff.id} staffName={`${staff.firstName} ${staff.lastName}`} />}
          {activeTab === 'purchases'  && <PurchasesTab staffId={staff.id} staffName={`${staff.firstName} ${staff.lastName}`} />}
          {activeTab === 'salary'     && <SalaryTab staffId={staff.id} staffName={`${staff.firstName} ${staff.lastName}`} baseSalary={staff.baseSalary} />}
        </div>
      </div>

      <StaffNotifyModal
        open={showNotify}
        onClose={() => setShowNotify(false)}
        lockedStaff={staff}
      />

      {/* ── Delete Confirmation Dialog ────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setShowDeleteConfirm(false); }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-md mx-4 shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-11 h-11 rounded-xl bg-danger-bg flex items-center justify-center flex-none">
                <Trash2 size={20} strokeWidth={1.8} className="text-danger-text" />
              </div>
              <div>
                <h3 className="font-display font-bold text-[16px] text-ink mb-1">
                  Delete Staff Member?
                </h3>
                <p className="text-[13px] text-ink/60 leading-relaxed">
                  This will permanently delete{' '}
                  <span className="font-semibold text-ink">
                    {staff.firstName} {staff.lastName}
                  </span>{' '}
                  and all their data — attendance, tasks, purchases, salary records
                  {staff.portalUserId ? ', and their portal login account' : ''}.
                </p>
                <p className="text-[12px] text-danger-text font-semibold mt-2">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="h-10 px-5 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 h-10 px-5 rounded-[9px] bg-danger-text text-white text-[13.5px] font-semibold hover:bg-danger-text/85 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} strokeWidth={2} />
                    Yes, Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffProfilePage;
