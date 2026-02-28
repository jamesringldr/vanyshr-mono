import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronLeft,
  Search,
  Shield,
  CheckCircle,
  AlertTriangle,
  Activity,
  Home,
  ClipboardList,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActivityType = 'Broker Scan' | 'Dark Web Scan' | 'Removal' | 'Breach' | 'Exposure';
type ActivityStatus = 'New' | 'In Progress' | 'Complete';
type TypeFilter = 'All' | 'Scans' | 'Removals' | 'Breaches' | 'Exposures';
type StatusFilter = 'All' | ActivityStatus;
type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

interface ActivityItem {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  summary: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const _now = Date.now();
const _mins  = (n: number) => n * 60 * 1000;
const _hours = (n: number) => n * 60 * _mins(1);
const _days  = (n: number) => n * 24 * _hours(1);

const MOCK_ACTIVITIES: ActivityItem[] = [
  // Today
  {
    id: 'a1',
    type: 'Dark Web Scan',
    status: 'In Progress',
    title: 'Dark Web Scan Running',
    summary: 'Scanning 2.3B breach records across your monitored emails',
    timestamp: new Date(_now - _mins(10)).toISOString(),
  },
  {
    id: 'a2',
    type: 'Exposure',
    status: 'New',
    title: 'New Exposure Detected',
    summary: 'Acxiom — home address and phone number listed publicly',
    timestamp: new Date(_now - _hours(2)).toISOString(),
  },
  {
    id: 'a3',
    type: 'Broker Scan',
    status: 'Complete',
    title: 'Broker Scan Complete',
    summary: '253 data sources scanned · 3 new exposures found',
    timestamp: new Date(_now - _hours(3)).toISOString(),
  },
  // Yesterday
  {
    id: 'a4',
    type: 'Removal',
    status: 'Complete',
    title: 'Removal Confirmed',
    summary: 'Spokeo — your record has been successfully removed',
    timestamp: new Date(_now - _hours(26)).toISOString(),
  },
  {
    id: 'a5',
    type: 'Removal',
    status: 'In Progress',
    title: 'Removal Requested',
    summary: 'Whitepages — opt-out submitted, awaiting confirmation',
    timestamp: new Date(_now - _hours(30)).toISOString(),
  },
  {
    id: 'a6',
    type: 'Breach',
    status: 'New',
    title: 'New Dark Web Breach',
    summary: 'LinkedIn (2024) — email and password hash exposed',
    timestamp: new Date(_now - _hours(32)).toISOString(),
  },
  {
    id: 'a7',
    type: 'Dark Web Scan',
    status: 'Complete',
    title: 'Dark Web Scan Complete',
    summary: '2 new breaches identified across your monitored emails',
    timestamp: new Date(_now - _hours(36)).toISOString(),
  },
  // This Week
  {
    id: 'a8',
    type: 'Removal',
    status: 'In Progress',
    title: 'Removal Requested',
    summary: 'BeenVerified — opt-out submitted, processing',
    timestamp: new Date(_now - _days(4)).toISOString(),
  },
  {
    id: 'a9',
    type: 'Broker Scan',
    status: 'Complete',
    title: 'Broker Scan Complete',
    summary: '248 data sources scanned · no new exposures found',
    timestamp: new Date(_now - _days(5)).toISOString(),
  },
  {
    id: 'a10',
    type: 'Removal',
    status: 'Complete',
    title: 'Removal Confirmed',
    summary: 'PeopleFinders — record permanently deleted',
    timestamp: new Date(_now - _days(6)).toISOString(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Style Config
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ActivityType, { bg: string; iconColor: string; Icon: React.ElementType }> = {
  'Broker Scan':   { bg: 'bg-[#00BFFF]/10', iconColor: 'text-[#00BFFF]', Icon: Search        },
  'Dark Web Scan': { bg: 'bg-[#7A92A8]/10', iconColor: 'text-[#7A92A8]', Icon: Shield        },
  'Removal':       { bg: 'bg-[#00D4AA]/10', iconColor: 'text-[#00D4AA]', Icon: CheckCircle   },
  'Breach':        { bg: 'bg-[#FF8A00]/10', iconColor: 'text-[#FF8A00]', Icon: AlertTriangle },
  'Exposure':      { bg: 'bg-[#FF8A00]/10', iconColor: 'text-[#FF8A00]', Icon: AlertTriangle },
};

const STATUS_CONFIG: Record<ActivityStatus, { color: string; bg: string; label: string }> = {
  'New':         { color: 'text-[#FF8A00]', bg: 'bg-[#FF8A00]/15', label: 'NEW'         },
  'In Progress': { color: 'text-[#00BFFF]', bg: 'bg-[#00BFFF]/15', label: 'IN PROGRESS' },
  'Complete':    { color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/15', label: 'COMPLETE'    },
};

const TYPE_LABELS: Record<ActivityType, string> = {
  'Broker Scan':   'Broker Scan',
  'Dark Web Scan': 'Dark Web',
  'Removal':       'Removal',
  'Breach':        'Breach',
  'Exposure':      'Exposure',
};

// ─────────────────────────────────────────────────────────────────────────────
// Filter Options
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_FILTER_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: 'All',       label: 'All'       },
  { key: 'Scans',     label: 'Scans'     },
  { key: 'Removals',  label: 'Removals'  },
  { key: 'Breaches',  label: 'Breaches'  },
  { key: 'Exposures', label: 'Exposures' },
];

const STATUS_FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'All',         label: 'All'         },
  { key: 'New',         label: 'New'         },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Complete',    label: 'Complete'    },
];

const DATE_GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDateGroup(timestamp: string): DateGroup {
  const diff = Date.now() - new Date(timestamp).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return 'This Week';
  return 'Earlier';
}

function formatTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return '1 day ago';
  return `${d} days ago`;
}

function matchesTypeFilter(item: ActivityItem, filter: TypeFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Scans') return item.type === 'Broker Scan' || item.type === 'Dark Web Scan';
  if (filter === 'Removals') return item.type === 'Removal';
  if (filter === 'Breaches') return item.type === 'Breach';
  if (filter === 'Exposures') return item.type === 'Exposure';
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityView
// ─────────────────────────────────────────────────────────────────────────────

export function ActivityView() {
  const navigate = useNavigate();
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = MOCK_ACTIVITIES.filter(item =>
    matchesTypeFilter(item, typeFilter) &&
    (statusFilter === 'All' || item.status === statusFilter)
  );

  // ── Group by date ─────────────────────────────────────────────────────────
  const groups: Partial<Record<DateGroup, ActivityItem[]>> = {};
  for (const item of filtered) {
    const g = getDateGroup(item.timestamp);
    if (!groups[g]) groups[g] = [];
    groups[g]!.push(item);
  }

  const isFiltered = typeFilter !== 'All' || statusFilter !== 'All';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#022136] font-ubuntu">
      <div className="pb-24 overflow-y-auto">
        <div className="flex flex-col gap-5 py-6 px-6">

          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard/home')}
              className="p-1 rounded-lg hover:bg-[#2D3847] transition-colors cursor-pointer"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 text-[#7A92A8]" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">Activity</h1>
              <p className="text-xs text-[#7A92A8] mt-0.5">
                {filtered.length} event{filtered.length !== 1 ? 's' : ''}
                {isFiltered ? ' · filtered' : ''}
              </p>
            </div>
          </div>

          {/* ── TYPE FILTER ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-medium tracking-widest uppercase text-[#7A92A8]">Type</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {TYPE_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTypeFilter(opt.key)}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 cursor-pointer ${
                    typeFilter === opt.key
                      ? 'bg-[#00BFFF]/20 border-[#00BFFF] text-[#00BFFF]'
                      : 'bg-transparent border-[#2A4A68] text-[#7A92A8] hover:border-[#4A6A88] hover:text-[#B8C4CC]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── STATUS FILTER ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-medium tracking-widest uppercase text-[#7A92A8]">Status</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {STATUS_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setStatusFilter(opt.key)}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 cursor-pointer ${
                    statusFilter === opt.key
                      ? 'bg-[#00BFFF]/20 border-[#00BFFF] text-[#00BFFF]'
                      : 'bg-transparent border-[#2A4A68] text-[#7A92A8] hover:border-[#4A6A88] hover:text-[#B8C4CC]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── ACTIVITY LIST ───────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-6 py-12 flex flex-col items-center gap-3 text-center mt-2">
              <Activity className="w-8 h-8 text-[#7A92A8]" />
              <p className="text-sm font-bold text-white">No activity found</p>
              <p className="text-xs text-[#7A92A8]">
                Try adjusting your filters to see more events.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {DATE_GROUP_ORDER.filter(g => groups[g]?.length).map(group => (
                <section key={group}>

                  {/* Date group header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-medium tracking-widest uppercase text-[#7A92A8] flex-shrink-0">
                      {group}
                    </span>
                    <div className="flex-1 h-px bg-[#2A4A68]" />
                  </div>

                  {/* Activity items */}
                  <div className="flex flex-col gap-2">
                    {groups[group]!.map(item => {
                      const typeStyle   = TYPE_CONFIG[item.type];
                      const statusStyle = STATUS_CONFIG[item.status];
                      const TypeIcon    = typeStyle.Icon;

                      return (
                        <button
                          key={item.id}
                          className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3 flex items-start gap-3 w-full text-left cursor-pointer hover:border-[#3A5A78] transition-colors duration-150"
                          onClick={() => console.log(`open activity: ${item.id}`)}
                        >
                          {/* Type icon */}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${typeStyle.bg}`}>
                            <TypeIcon className={`w-4 h-4 ${typeStyle.iconColor}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-white leading-snug">{item.title}</p>
                              {/* Status badge */}
                              <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusStyle.color} ${statusStyle.bg}`}>
                                {statusStyle.label}
                              </span>
                            </div>

                            <p className="text-xs text-[#B8C4CC] mt-0.5 leading-snug">{item.summary}</p>

                            {/* Meta row */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] font-medium bg-[#7A92A8]/20 text-[#7A92A8] px-1.5 py-0.5 rounded-full">
                                {TYPE_LABELS[item.type]}
                              </span>
                              <span className="text-[10px] text-[#7A92A8]">{formatTime(item.timestamp)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── FIXED BOTTOM NAV ──────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#022136] border-t border-[#2A4A68] h-16 px-2 flex items-center justify-around z-50">
        {[
          { label: 'Home',      Icon: Home,          path: '/dashboard/home',     active: false },
          { label: 'Exposures', Icon: Shield,         path: '/dashboard/exposures', active: false },
          { label: 'Tasks',     Icon: ClipboardList,  path: '/dashboard/tasks',    active: false },
          { label: 'Activity',  Icon: Activity,       path: '/dashboard/activity',  active: true  },
        ].map(({ label, Icon, path, active }) => (
          <button
            key={label}
            className="flex flex-col items-center gap-1 flex-1 py-2 cursor-pointer"
            onClick={() => navigate(path)}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
            <span className={`text-[10px] font-medium ${active ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`}>{label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}
