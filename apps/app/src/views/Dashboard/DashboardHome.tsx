import { useState } from 'react';
import { UserDrawer } from './UserDrawer';
import {
  Bell,
  Info,
  ChevronDown,
  ChevronRight,
  Home,
  Shield,
  ClipboardList,
  Activity,
  Search,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Timeframe = '30D' | '90D' | 'All';
type ActivityType = 'Broker Scan' | 'Dark Web Scan' | 'Removal' | 'New Exposure';
type BrokerStatus = 'Exposed' | 'Removal Requested' | 'Removed' | 'New';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const EXPOSURES_DATA: Record<Timeframe, { count: number; delta: string; points: [number, number][] }> = {
  '30D': { count: 14, delta: '+3',  points: [[0,18],[10,14],[20,10],[30,8],[40,6],[50,6],[60,6]] },
  '90D': { count: 31, delta: '+8',  points: [[0,20],[10,17],[20,13],[30,10],[40,8],[50,5],[60,3]] },
  'All': { count: 47, delta: '+12', points: [[0,22],[10,18],[20,14],[30,10],[40,6],[50,4],[60,2]] },
};

const BREACHES_DATA = {
  count: 4,
  delta: '+1',
  points: [[0,18],[10,18],[20,18],[30,5],[40,18],[50,18],[60,18]] as [number, number][],
};

const NEEDS_ATTENTION_DATA = {
  count: 12,
  delta: '+3',
  points: [[0,18],[10,17],[20,16],[30,14],[40,12],[50,10],[60,8]] as [number, number][],
};

const IN_PROGRESS_DATA: Record<Timeframe, { count: number; delta: string; points: [number, number][] }> = {
  '30D': { count: 9,  delta: '-2', points: [[0,5],[10,7],[20,10],[30,13],[40,15],[50,16],[60,18]] },
  '90D': { count: 22, delta: '-5', points: [[0,4],[10,6],[20,10],[30,14],[40,17],[50,20],[60,22]] },
  'All': { count: 31, delta: '-8', points: [[0,3],[10,6],[20,9],[30,13],[40,17],[50,20],[60,22]] },
};

// Card info tooltip text
const CARD_INFO: Record<string, string> = {
  'exposures':       'Broker & people-search listings',
  'breaches':        'Credentials found in dark web leaks',
  'needs-attention': 'Credential leaks requiring your action',
  'in-progress':     'Removal requests submitted & pending',
};

const BREACH_ITEMS = [
  { company: 'LinkedIn', initials: 'LI', date: 'Breached Jan 12, 2025', isNew: true  },
  { company: 'Adobe',    initials: 'AD', date: 'Breached Mar 3, 2024',  isNew: false },
  { company: 'Dropbox',  initials: 'DB', date: 'Breached Nov 19, 2023', isNew: false },
];

const ACTIVITY_ITEMS: { type: ActivityType; title: string; descriptor: string; time: string }[] = [
  {
    type: 'Dark Web Scan',
    title: 'Dark Web Scan Complete',
    descriptor: '2 new breaches identified',
    time: '2h ago',
  },
  {
    type: 'Removal',
    title: 'Removal Confirmed',
    descriptor: 'Spokeo — record successfully removed',
    time: '1d ago',
  },
  {
    type: 'Broker Scan',
    title: 'Broker Scan Complete',
    descriptor: '253 data sources scanned · 3 new exposures',
    time: '2d ago',
  },
];

const ACTIVITY_STYLES: Record<ActivityType, { bg: string; iconColor: string; Icon: React.ElementType }> = {
  'Broker Scan':   { bg: 'bg-[#00BFFF]/10', iconColor: 'text-[#00BFFF]', Icon: Search        },
  'Dark Web Scan': { bg: 'bg-[#7A92A8]/10', iconColor: 'text-[#7A92A8]', Icon: Shield        },
  'Removal':       { bg: 'bg-[#00D4AA]/10', iconColor: 'text-[#00D4AA]', Icon: CheckCircle   },
  'New Exposure':  { bg: 'bg-[#FF8A00]/10', iconColor: 'text-[#FF8A00]', Icon: AlertTriangle },
};

const BROKER_ITEMS: { broker: string; initials: string; status: BrokerStatus }[] = [
  { broker: 'Acxiom',     initials: 'AC', status: 'Exposed'           },
  { broker: 'Whitepages', initials: 'WP', status: 'Removal Requested' },
  { broker: 'Spokeo',     initials: 'SP', status: 'Removed'           },
];

const BROKER_STATUS_STYLES: Record<BrokerStatus, { dot: string; text: string; label: string }> = {
  'Exposed':           { dot: 'bg-[#FF8A00]', text: 'text-[#FF8A00]', label: 'Exposed · High Risk'  },
  'Removal Requested': { dot: 'bg-[#FFB81C]', text: 'text-[#FFB81C]', label: 'Removal Requested'    },
  'Removed':           { dot: 'bg-[#00D4AA]', text: 'text-[#00D4AA]', label: 'Opt-out Confirmed'    },
  'New':               { dot: 'bg-[#00BFFF]', text: 'text-[#00BFFF]', label: 'New · Just Found'     },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline (inline SVG, no library)
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({
  points,
  stroke,
  fill,
}: {
  points: [number, number][];
  stroke: string;
  fill: string;
}) {
  const linePoints = points.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPoints = `${linePoints} 60,24 0,24`;
  return (
    <svg viewBox="0 0 60 24" width={60} height={24} aria-hidden="true">
      <polygon points={areaPoints} fill={fill} fillOpacity={0.2} />
      <polyline
        points={linePoints}
        stroke={stroke}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardHome
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardHome() {
  const [timeframe, setTimeframe]             = useState<Timeframe>('30D');
  const [userDrawerOpen, setUserDrawerOpen]   = useState(false);
  const [openInfoCard, setOpenInfoCard]       = useState<string | null>(null);

  const exposures  = EXPOSURES_DATA[timeframe];
  const inProgress = IN_PROGRESS_DATA[timeframe];

  function toggleInfo(cardId: string) {
    setOpenInfoCard(prev => (prev === cardId ? null : cardId));
  }

  return (
    <div className="min-h-screen bg-[#022136] font-ubuntu">

      {/* ── SCROLLABLE CONTENT AREA ──────────────────────────────────────── */}
      <div className="pb-24 overflow-y-auto">
        <div className="flex flex-col gap-6 py-6 px-6">

          {/* ── PROFILE + NOTIFICATION ROW ───────────────────────────────── */}
          <div className="flex items-center justify-between">
            {/* Profile trigger — opens bottom drawer */}
            <button
              className="flex items-center gap-2"
              onClick={() => setUserDrawerOpen(true)}
              aria-label="Open profile drawer"
            >
              <div className="w-9 h-9 rounded-full bg-[#2D3847] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
                <span className="text-[#00BFFF] text-sm font-bold">JD</span>
              </div>
              <span className="text-sm font-medium text-white">James</span>
              <ChevronDown className="w-4 h-4 text-[#7A92A8]" />
            </button>

            {/* Notification bell */}
            <button
              className="relative"
              onClick={() => console.log('open notifications')}
              aria-label="Open notifications"
            >
              <Bell className="w-5 h-5 text-white" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF8A00] rounded-full text-[#022136] text-[10px] font-bold flex items-center justify-center leading-none">
                3
              </span>
            </button>
          </div>

          {/* ── EXPOSURE SUMMARY HEADER + TIMEFRAME SELECT ───────────────── */}
          <section>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Exposure Summary</h1>

              {/* Timeframe dropdown */}
              <div className="relative flex-shrink-0">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                  className="appearance-none bg-[#2D3847] text-[#B8C4CC] border border-[#2A4A68] rounded-full text-xs pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none focus:border-[#00BFFF] transition-colors duration-150"
                >
                  <option value="30D">30 Days</option>
                  <option value="90D">90 Days</option>
                  <option value="All">All Time</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#7A92A8] pointer-events-none" />
              </div>
            </div>
            <p className="text-xs text-[#7A92A8] mt-1">Last scanned 2 hours ago</p>
          </section>

          {/* ── METRIC CARDS — 2×2 GRID ──────────────────────────────────── */}
          <section className="grid grid-cols-2 gap-3">

            {/* Card 1 — Exposures */}
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#B8C4CC] uppercase tracking-wide">Exposures</span>
                <button
                  className="ml-auto p-0.5"
                  onClick={() => toggleInfo('exposures')}
                  aria-label="More info about Exposures"
                >
                  <Info className={`w-3.5 h-3.5 transition-colors duration-150 ${openInfoCard === 'exposures' ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
                </button>
              </div>
              {openInfoCard === 'exposures' && (
                <div className="bg-[#022136] border border-[#2A4A68] rounded-lg px-2.5 py-1.5 -mt-1">
                  <p className="text-[11px] text-[#B8C4CC] leading-snug">{CARD_INFO['exposures']}</p>
                </div>
              )}
              <p className="text-3xl font-bold text-white">{exposures.count}</p>
              <div className="flex items-center gap-2">
                <Sparkline points={exposures.points} stroke="#FF8A00" fill="#FF8A00" />
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[#FF8A00]/20 text-[#FF8A00]">
                  {exposures.delta}
                </span>
              </div>
            </div>

            {/* Card 2 — Breaches (static) */}
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#B8C4CC] uppercase tracking-wide">Breaches</span>
                <button
                  className="ml-auto p-0.5"
                  onClick={() => toggleInfo('breaches')}
                  aria-label="More info about Breaches"
                >
                  <Info className={`w-3.5 h-3.5 transition-colors duration-150 ${openInfoCard === 'breaches' ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
                </button>
              </div>
              {openInfoCard === 'breaches' && (
                <div className="bg-[#022136] border border-[#2A4A68] rounded-lg px-2.5 py-1.5 -mt-1">
                  <p className="text-[11px] text-[#B8C4CC] leading-snug">{CARD_INFO['breaches']}</p>
                </div>
              )}
              <p className="text-3xl font-bold text-white">{BREACHES_DATA.count}</p>
              <div className="flex items-center gap-2">
                <Sparkline points={BREACHES_DATA.points} stroke="#FF8A00" fill="#FF8A00" />
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[#FF8A00]/20 text-[#FF8A00]">
                  {BREACHES_DATA.delta}
                </span>
              </div>
            </div>

            {/* Card 3 — Needs Attention (static, now uniform format) */}
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#B8C4CC] uppercase tracking-wide">Needs Attention</span>
                <button
                  className="ml-auto p-0.5"
                  onClick={() => toggleInfo('needs-attention')}
                  aria-label="More info about Needs Attention"
                >
                  <Info className={`w-3.5 h-3.5 transition-colors duration-150 ${openInfoCard === 'needs-attention' ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
                </button>
              </div>
              {openInfoCard === 'needs-attention' && (
                <div className="bg-[#022136] border border-[#2A4A68] rounded-lg px-2.5 py-1.5 -mt-1">
                  <p className="text-[11px] text-[#B8C4CC] leading-snug">{CARD_INFO['needs-attention']}</p>
                </div>
              )}
              <p className="text-3xl font-bold text-white">{NEEDS_ATTENTION_DATA.count}</p>
              <div className="flex items-center gap-2">
                <Sparkline points={NEEDS_ATTENTION_DATA.points} stroke="#FF8A00" fill="#FF8A00" />
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[#FF8A00]/20 text-[#FF8A00]">
                  {NEEDS_ATTENTION_DATA.delta}
                </span>
              </div>
            </div>

            {/* Card 4 — In Progress */}
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#B8C4CC] uppercase tracking-wide">In Progress</span>
                <button
                  className="ml-auto p-0.5"
                  onClick={() => toggleInfo('in-progress')}
                  aria-label="More info about In Progress"
                >
                  <Info className={`w-3.5 h-3.5 transition-colors duration-150 ${openInfoCard === 'in-progress' ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
                </button>
              </div>
              {openInfoCard === 'in-progress' && (
                <div className="bg-[#022136] border border-[#2A4A68] rounded-lg px-2.5 py-1.5 -mt-1">
                  <p className="text-[11px] text-[#B8C4CC] leading-snug">{CARD_INFO['in-progress']}</p>
                </div>
              )}
              <p className="text-3xl font-bold text-white">{inProgress.count}</p>
              <div className="flex items-center gap-2">
                <Sparkline points={inProgress.points} stroke="#00D4AA" fill="#00D4AA" />
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[#00D4AA]/20 text-[#00D4AA]">
                  {inProgress.delta}
                </span>
              </div>
            </div>

          </section>

          {/* ── NEEDS ATTENTION STRIP ────────────────────────────────────── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-white">Needs Attention</h2>
              <button
                className="text-xs text-[#00BFFF]"
                onClick={() => console.log('view all needs attention')}
              >
                View All
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {BREACH_ITEMS.map((item) => (
                <button
                  key={item.company}
                  className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
                  onClick={() => console.log(`open breach modal: ${item.company}`)}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#00BFFF] text-xs font-bold">{item.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{item.company}</p>
                    <p className="text-xs text-[#7A92A8]">{item.date}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.isNew && (
                      <span className="text-[10px] font-bold bg-[#FF8A00]/20 text-[#FF8A00] px-1.5 py-0.5 rounded-full">
                        NEW
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#7A92A8]" />
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── RECENT ACTIVITY FEED ─────────────────────────────────────── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-white">Recent Activity</h2>
              <button
                className="text-xs text-[#00BFFF]"
                onClick={() => console.log('view all activity')}
              >
                View All
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {ACTIVITY_ITEMS.map((item) => {
                const style = ACTIVITY_STYLES[item.type];
                const Icon  = style.Icon;
                return (
                  <button
                    key={item.title}
                    className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
                    onClick={() => console.log(`open activity: ${item.type}`)}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Icon className={`w-4 h-4 ${style.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-[#B8C4CC]">{item.descriptor}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-[#7A92A8]">{item.time}</span>
                      <ChevronRight className="w-4 h-4 text-[#7A92A8]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── BROKER EXPOSURE LIST ─────────────────────────────────────── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-white">Exposures</h2>
              <button
                className="text-xs text-[#00BFFF]"
                onClick={() => console.log('view all exposures')}
              >
                View All →
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {BROKER_ITEMS.map((item) => {
                const style = BROKER_STATUS_STYLES[item.status];
                return (
                  <button
                    key={item.broker}
                    className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
                    onClick={() => console.log(`open broker: ${item.broker}`)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00BFFF] text-xs font-bold">{item.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.broker}</p>
                      <p className={`text-xs flex items-center ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 flex-shrink-0 ${style.dot}`} />
                        {style.label}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#7A92A8] flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>

        </div>
      </div>

      {/* ── 3. FIXED BOTTOM NAV ──────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#022136] border-t border-[#2A4A68] h-16 px-2 flex items-center justify-around z-50">
        {([
          { label: 'Home',      Icon: Home,         active: true  },
          { label: 'Exposures', Icon: Shield,        active: false },
          { label: 'To Do',     Icon: ClipboardList, active: false },
          { label: 'Activity',  Icon: Activity,      active: false },
        ] as const).map(({ label, Icon, active }) => (
          <button
            key={label}
            className="flex flex-col items-center gap-1 flex-1 py-2"
            onClick={() => console.log(`navigate to: ${label}`)}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
            <span className={`text-[10px] font-medium ${active ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`}>
              {label}
            </span>
          </button>
        ))}
      </nav>

      <UserDrawer isOpen={userDrawerOpen} onClose={() => setUserDrawerOpen(false)} />

    </div>
  );
}
