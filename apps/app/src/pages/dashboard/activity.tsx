import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Search,
  Filter,
  Shield,
  AlertTriangle,
  CheckCircle,
  Home,
  Activity,
  ClipboardList,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActivityType = 'Scan' | 'Exposure' | 'Breach';
type ActivityStatus = 'New' | 'Unresolved' | 'Requested' | 'Resolved';
type TypeFilter = 'All' | 'Scans' | 'Exposures' | 'Breaches';
type StatusFilter = 'All' | ActivityStatus;

interface ActivityItem {
  id: string;
  type: ActivityType;
  subtype: string;
  title: string;
  description: string;
  status: ActivityStatus;
  dateGroup: 'Today' | 'Yesterday' | 'This Week';
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ACTIVITIES: ActivityItem[] = [
  // Today
  { id: '1', type: 'Scan',     subtype: 'Broker Scan',    title: 'Broker Scan Complete',   description: '253 data sources scanned · 2 new exposures found',     status: 'New',        dateGroup: 'Today'     },
  { id: '2', type: 'Exposure', subtype: 'BeenVerified',   title: 'New Exposure Found',     description: 'BeenVerified — name, address, and phone number listed', status: 'New',        dateGroup: 'Today'     },
  { id: '3', type: 'Scan',     subtype: 'Dark Web Scan',  title: 'Dark Web Scan Complete', description: '1 new breach identified across your monitored emails',  status: 'New',        dateGroup: 'Today'     },
  // Yesterday
  { id: '4', type: 'Breach',   subtype: 'LinkedIn',       title: 'New Breach: LinkedIn',   description: 'Email and password hash exposed (2024 leak)',           status: 'Unresolved', dateGroup: 'Yesterday' },
  { id: '5', type: 'Exposure', subtype: 'Whitepages',     title: 'Removal Confirmed',      description: 'Whitepages — your record has been successfully removed', status: 'Resolved',   dateGroup: 'Yesterday' },
  { id: '6', type: 'Exposure', subtype: 'Spokeo',         title: 'Removal Requested',      description: 'Spokeo — opt-out submitted, awaiting confirmation',     status: 'Requested',  dateGroup: 'Yesterday' },
  { id: '7', type: 'Scan',     subtype: 'Dark Web Scan',  title: 'Dark Web Scan Complete', description: 'No new breaches found across your monitored emails',    status: 'Resolved',   dateGroup: 'Yesterday' },
  // This Week
  { id: '8', type: 'Exposure', subtype: 'Acxiom',         title: 'Removal Requested',      description: 'Acxiom — opt-out submitted, currently processing',      status: 'Requested',  dateGroup: 'This Week' },
  { id: '9', type: 'Scan',     subtype: 'Broker Scan',    title: 'Broker Scan Complete',   description: '248 data sources scanned · no new exposures found',     status: 'Resolved',   dateGroup: 'This Week' },
  { id: '10', type: 'Breach',  subtype: 'Adobe',          title: 'Breach Resolved',        description: 'Adobe — marked resolved after password was updated',    status: 'Resolved',   dateGroup: 'This Week' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Style Config
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ActivityType, { bg: string; iconColor: string; Icon: React.ElementType }> = {
  'Scan':     { bg: 'bg-[#00BFFF]/10', iconColor: 'text-[#00BFFF]', Icon: Search        },
  'Exposure': { bg: 'bg-[#FF8A00]/10', iconColor: 'text-[#FF8A00]', Icon: AlertTriangle },
  'Breach':   { bg: 'bg-[#7A92A8]/10', iconColor: 'text-[#7A92A8]', Icon: Shield        },
};

const STATUS_CONFIG: Record<ActivityStatus, { color: string; bg: string; label: string }> = {
  'New':        { color: 'text-[#FF8A00]', bg: 'bg-[#FF8A00]/15', label: 'New'        },
  'Unresolved': { color: 'text-[#FFB81C]', bg: 'bg-[#FFB81C]/15', label: 'Unresolved' },
  'Requested':  { color: 'text-[#00BFFF]', bg: 'bg-[#00BFFF]/15', label: 'Requested'  },
  'Resolved':   { color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/15', label: 'Resolved'   },
};

// ─────────────────────────────────────────────────────────────────────────────
// Filter Options
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'All',       label: 'All'       },
  { key: 'Scans',     label: 'Scans'     },
  { key: 'Exposures', label: 'Exposures' },
  { key: 'Breaches',  label: 'Breaches'  },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'All',        label: 'All'        },
  { key: 'New',        label: 'New'        },
  { key: 'Unresolved', label: 'Unresolved' },
  { key: 'Requested',  label: 'Requested'  },
  { key: 'Resolved',   label: 'Resolved'   },
];

const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'This Week'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Transactions (Activity Monitor)
// ─────────────────────────────────────────────────────────────────────────────

export const Transactions = () => {
  const navigate = useNavigate();
  const [searchQuery,     setSearchQuery]     = useState('');
  const [typeFilter,      setTypeFilter]      = useState<TypeFilter>('All');
  const [statusFilter,    setStatusFilter]    = useState<StatusFilter>('All');
  const [showStatusMenu,  setShowStatusMenu]  = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Filter logic ───────────────────────────────────────────────────────────
  function matchesType(item: ActivityItem): boolean {
    if (typeFilter === 'All') return true;
    if (typeFilter === 'Scans') return item.type === 'Scan';
    if (typeFilter === 'Exposures') return item.type === 'Exposure';
    if (typeFilter === 'Breaches') return item.type === 'Breach';
    return true;
  }

  const filtered = MOCK_ACTIVITIES.filter(item =>
    matchesType(item) &&
    (statusFilter === 'All' || item.status === statusFilter) &&
    (searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtype.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isStatusFiltered = statusFilter !== 'All';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#022136] font-ubuntu">

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <main className="px-4 pb-24 space-y-4">

        {/* Page Title */}
        <div className="pt-6">
          <h1 className="text-2xl font-bold text-white">Activity</h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="search"
            placeholder="Search activity"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[52px] w-full rounded-xl border border-[#2A4A68] px-12 py-3 text-sm bg-[#022136]/50 text-white placeholder:text-[#7A92A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 transition-all font-ubuntu"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7A92A8] pointer-events-none" />
        </div>

        {/* Type Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TYPE_FILTERS.map((f) => {
            const isActive = typeFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setTypeFilter(f.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#00BFFF] text-[#022136]'
                    : 'bg-[#2D3847] border border-[#2A4A68] text-[#B8C4CC]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Activity List */}
        <div className="space-y-6">
          {DATE_GROUP_ORDER.map((group) => {
            const groupItems = filtered.filter(i => i.dateGroup === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group}>

                {/* Date group header + filter icon */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-white">{group}</h2>

                  {/* Status filter — only rendered on the first visible group */}
                  {group === DATE_GROUP_ORDER.find(g => filtered.some(i => i.dateGroup === g)) && (
                    <div className="relative" ref={filterMenuRef}>
                      <button
                        type="button"
                        aria-label="Filter by status"
                        onClick={() => setShowStatusMenu(s => !s)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                          isStatusFiltered
                            ? 'bg-[#00BFFF]/20 border border-[#00BFFF]'
                            : 'bg-[#2D3847] border border-[#2A4A68]'
                        }`}
                      >
                        <Filter className={`w-4 h-4 ${isStatusFiltered ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
                      </button>

                      {/* Status dropdown */}
                      {showStatusMenu && (
                        <div className="absolute right-0 top-10 z-20 bg-[#2D3847] border border-[#2A4A68] rounded-xl overflow-hidden shadow-xl min-w-[148px]">
                          {STATUS_FILTERS.map((opt) => {
                            const isSelected = statusFilter === opt.key;
                            const cfg = opt.key !== 'All' ? STATUS_CONFIG[opt.key as ActivityStatus] : null;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => { setStatusFilter(opt.key); setShowStatusMenu(false); }}
                                className={`w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#00BFFF]/15 text-[#00BFFF]'
                                    : 'text-[#B8C4CC] hover:bg-[#022136]/50 hover:text-white'
                                }`}
                              >
                                {cfg && (
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.bg.replace('/15', '')}`} />
                                )}
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {groupItems.map((item) => {
                    const typeStyle   = TYPE_CONFIG[item.type];
                    const statusStyle = STATUS_CONFIG[item.status];
                    const TypeIcon    = typeStyle.Icon;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-[#2D3847] rounded-xl border border-[#2A4A68] p-4"
                      >
                        {/* Left: Icon + Details */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${typeStyle.bg}`}>
                            <TypeIcon className={`w-5 h-5 ${typeStyle.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{item.title}</p>
                            <p className="text-xs text-[#B8C4CC] mt-0.5 truncate">{item.description}</p>
                          </div>
                        </div>

                        {/* Right: Status chip */}
                        <div className="ml-3 flex-shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusStyle.color} ${statusStyle.bg}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-6 py-12 flex flex-col items-center gap-3 text-center">
              <CheckCircle className="w-8 h-8 text-[#7A92A8]" />
              <p className="text-sm font-bold text-white">No activity found</p>
              <p className="text-xs text-[#7A92A8]">Try adjusting your filters.</p>
            </div>
          )}
        </div>

      </main>

      {/* ── BOTTOM NAV — matches /dashboard/home ──────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#022136] border-t border-[#2A4A68] h-16 px-2 flex items-center justify-around z-50">
        {[
          { label: 'Home',      Icon: Home,         path: '/dashboard/home',     active: false },
          { label: 'Exposures', Icon: Shield,        path: '/dashboard/exposures', active: false },
          { label: 'Tasks',    Icon: ClipboardList, path: '/dashboard/tasks',     active: false },
          { label: 'Activity',  Icon: Activity,      path: '/dashboard/activity',  active: true  },
        ].map(({ label, Icon, path, active }) => (
          <button
            key={label}
            type="button"
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
};
