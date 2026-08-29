import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { UserDrawer } from './UserDrawer';
import {
  Settings,
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
  Lightbulb,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';


// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Timeframe = '30D' | '90D' | 'All';
type ActivityType = 'Broker Scan' | 'Dark Web Scan' | 'Removal' | 'New Exposure';
type ActivityStatus = 'Complete' | 'In Progress';
type BrokerStatus = 'Exposed' | 'Removal Requested' | 'Removed' | 'New';

interface DataBreach {
  id: string;
  breach_name: string;
  breach_title: string | null;
  breach_domain: string | null;
  breach_date: string | null;
  exposed_data_types: string[] | null;
  matched_email: string;
  status: 'new' | 'unresolved' | 'resolved';
  created_at: string;
}

interface UserUpdate {
  id: string;
  title: string;
  message: string;
  action_text: string | null;
  action_route: string | null;
  type: 'info' | 'tip' | 'alert' | 'action_required' | 'new_feature';
  icon: string | null;
  status: 'unread' | 'dismissed' | 'clicked' | 'converted';
  expires_at: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data (non-breach sections remain mocked)
// ─────────────────────────────────────────────────────────────────────────────

const EXPOSURES_DATA: Record<Timeframe, { count: number; delta: string }> = {
  '30D': { count: 14, delta: '+3' },
  '90D': { count: 31, delta: '+8' },
  'All': { count: 47, delta: '+12' },
};

const REMOVALS_SUBMITTED_DATA = {
  count: 12,
  delta: '+3',
};

const REMOVALS_CONFIRMED_DATA: Record<Timeframe, { count: number; delta: string }> = {
  '30D': { count: 9,  delta: '-2' },
  '90D': { count: 22, delta: '-5' },
  'All': { count: 31, delta: '-8' },
};

const CARD_INFO: Record<string, string> = {
  'exposures':       'Brokers where your data is currently exposed',
  'breaches':        'Unresolved Breaches found on the dark web',
  'needs-attention': 'Number of removal requests submitted',
  'in-progress':     'Number of brokers Vanyshr has successfully removed',
};

const ACTIVITY_ITEMS: {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  descriptor: string;
  time: string;
  minutesAgo: number;
}[] = [
  {
    id: 'dark-web-in-progress',
    type: 'Dark Web Scan',
    status: 'In Progress',
    title: 'Dark Web Scan In Progress',
    descriptor: 'Searching new breach dumps for compromised credentials',
    time: '10m ago',
    minutesAgo: 10,
  },
  {
    type: 'Dark Web Scan',
    id: 'dark-web-complete',
    status: 'Complete',
    title: 'Dark Web Scan Complete',
    descriptor: '2 new breaches identified',
    time: '2h ago',
    minutesAgo: 120,
  },
  {
    id: 'broker-scan-in-progress',
    type: 'Broker Scan',
    status: 'In Progress',
    title: 'Broker Scan In Progress',
    descriptor: '248 of 253 data sources processed',
    time: '45m ago',
    minutesAgo: 45,
  },
  {
    type: 'Removal',
    id: 'removal-complete',
    status: 'Complete',
    title: 'Removal Confirmed',
    descriptor: 'Spokeo — record successfully removed',
    time: '1d ago',
    minutesAgo: 1440,
  },
  {
    type: 'Broker Scan',
    id: 'broker-scan-complete',
    status: 'Complete',
    title: 'Broker Scan Complete',
    descriptor: '253 data sources scanned · 3 new exposures',
    time: '2d ago',
    minutesAgo: 2880,
  },
];

const REMOVAL_ACTIVITY_ITEMS: {
  id: string;
  status: ActivityStatus;
  title: string;
  descriptor: string;
  time: string;
  minutesAgo: number;
}[] = [
  {
    id: 'removal-spokeo',
    status: 'Complete',
    title: 'Spokeo',
    descriptor: 'Record successfully removed',
    time: '1d ago',
    minutesAgo: 1440,
  },
  {
    id: 'removal-whitepages',
    status: 'In Progress',
    title: 'Whitepages',
    descriptor: 'Opt-out submitted, awaiting confirmation',
    time: '7h ago',
    minutesAgo: 420,
  },
  {
    id: 'removal-acxiom',
    status: 'In Progress',
    title: 'Acxiom',
    descriptor: 'Removal request is currently processing',
    time: '3h ago',
    minutesAgo: 180,
  },
];

const UPDATE_TYPE_CONFIG: Record<string, { Icon: React.ElementType; label: string }> = {
  info:            { Icon: Info,          label: 'Info'            },
  tip:             { Icon: Lightbulb,     label: 'Tip'             },
  alert:           { Icon: AlertTriangle, label: 'Alert'           },
  action_required: { Icon: AlertCircle,   label: 'Action Required' },
  new_feature:     { Icon: Zap,           label: 'New Feature'     },
};

const ACTIVITY_STYLES: Record<ActivityType, { bg: string; iconColor: string; Icon: React.ElementType }> = {
  'Broker Scan':   { bg: 'bg-[#14ABFE]/10', iconColor: 'text-[#14ABFE]', Icon: Search        },
  'Dark Web Scan': { bg: 'bg-[#7A92A8]/10', iconColor: 'text-[#7A92A8]', Icon: Shield        },
  'Removal':       { bg: 'bg-[#00D4AA]/10', iconColor: 'text-[#00D4AA]', Icon: CheckCircle   },
  'New Exposure':  { bg: 'bg-[#FF8400]/10', iconColor: 'text-[#FF8400]', Icon: AlertTriangle },
};

const STATUS_CHIP_STYLES: Record<ActivityStatus, { bg: string; text: string; label: string }> = {
  'In Progress': { bg: 'bg-[#14ABFE]/20', text: 'text-[#14ABFE]', label: 'IN PROGRESS' },
  'Complete': { bg: 'bg-[#00D4AA]/20', text: 'text-[#00D4AA]', label: 'COMPLETE' },
};

const BROKER_ITEMS: { broker: string; initials: string; status: BrokerStatus; minutesAgo: number }[] = [
  { broker: 'Acxiom',     initials: 'AC', status: 'Exposed',           minutesAgo: 35 },
  { broker: 'Whitepages', initials: 'WP', status: 'Removal Requested', minutesAgo: 110 },
  { broker: 'Spokeo',     initials: 'SP', status: 'Removed',           minutesAgo: 260 },
];

const BROKER_STATUS_STYLES: Record<BrokerStatus, { dot: string; text: string; label: string }> = {
  'Exposed':           { dot: 'bg-[#FF8400]', text: 'text-[#FF8400]', label: 'Exposed · High Risk'  },
  'Removal Requested': { dot: 'bg-[#FFB81C]', text: 'text-[#FFB81C]', label: 'Removal Requested'    },
  'Removed':           { dot: 'bg-[#00D4AA]', text: 'text-[#00D4AA]', label: 'Opt-out Confirmed'    },
  'New':               { dot: 'bg-[#14ABFE]', text: 'text-[#14ABFE]', label: 'New · Just Found'     },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────


function getDeltaColor(delta: string, cardTrend: 'risk' | 'progress'): string {
  const isNegative = delta.startsWith('-');
  const isPositive = delta.startsWith('+');

  if (!isNegative && !isPositive) return 'text-[#94A3B8]';

  if (cardTrend === 'risk') {
    return isPositive ? 'text-[#EF4444]' : 'text-[#00D4AA]';
  }
  return isPositive ? 'text-[#00D4AA]' : 'text-[#EF4444]';
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

function toMinutesAgo(dateStr: string | null): number {
  if (!dateStr) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardHome
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardHome() {
  const navigate = useNavigate();

  const [timeframe, setTimeframe]           = useState<Timeframe>('30D');
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [openInfoCard, setOpenInfoCard]     = useState<string | null>(null);
  const [showAllCaughtUp, setShowAllCaughtUp] = useState(false);
  const prevUpdatesCountRef = useRef(0);

  // Breach state (real DB data — feeds broker/breach list)
  const [profileId, setProfileId]           = useState<string | null>(null);
  const [profileName, setProfileName]       = useState({ first: '', last: '', email: '' });
  const [newBreaches, setNewBreaches]       = useState<DataBreach[]>([]);
  const [breachesLoaded, setBreachesLoaded] = useState(false);

  // Updates state (real DB data — drives the Updates section)
  const [userUpdates, setUserUpdates]       = useState<UserUpdate[]>([]);
  const [updatesLoaded, setUpdatesLoaded]   = useState(false);

  const exposures  = EXPOSURES_DATA[timeframe];
  const removalsConfirmed = REMOVALS_CONFIRMED_DATA[timeframe];
  const breachesDelta = breachesLoaded ? (newBreaches.length > 0 ? `+${newBreaches.length}` : '0') : '—';
  const latestScanByType = ACTIVITY_ITEMS
    .filter(item => item.type === 'Dark Web Scan' || item.type === 'Broker Scan')
    .reduce<Record<'Dark Web Scan' | 'Broker Scan', (typeof ACTIVITY_ITEMS)[number] | null>>(
      (acc, item) => {
        const key = item.type as 'Dark Web Scan' | 'Broker Scan';
        if (!acc[key] || item.minutesAgo < acc[key]!.minutesAgo) {
          acc[key] = item;
        }
        return acc;
      },
      { 'Dark Web Scan': null, 'Broker Scan': null },
    );
  const scanStatusItems = (Object.values(latestScanByType).filter(Boolean) as (typeof ACTIVITY_ITEMS)[number][])
    .map(item => ({ ...item, title: item.type }))
    .sort((a, b) => a.minutesAgo - b.minutesAgo);
  const sortedRemovalItems = [...REMOVAL_ACTIVITY_ITEMS].sort((a, b) => a.minutesAgo - b.minutesAgo);
  const recentBrokerAndBreachItems = [
    ...BROKER_ITEMS.map(item => ({
      kind: 'broker' as const,
      id: `broker-${item.broker.toLowerCase()}`,
      title: item.broker,
      subtitle: BROKER_STATUS_STYLES[item.status].label,
      minutesAgo: item.minutesAgo,
      initials: item.initials,
      brokerStatus: item.status,
    })),
    ...newBreaches.map(item => ({
      kind: 'breach' as const,
      id: `breach-${item.id}`,
      title: item.breach_title || item.breach_name,
      subtitle: item.matched_email,
      minutesAgo: toMinutesAgo(item.created_at),
      status: item.status,
    })),
  ]
    .sort((a, b) => a.minutesAgo - b.minutesAgo)
    .slice(0, 5);

  // ── Fetch new breaches on mount ──────────────────────────────────────────
  useEffect(() => {
    async function loadBreaches() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setBreachesLoaded(true); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile) { setBreachesLoaded(true); return; }
      setProfileId(profile.id);
      setProfileName({
        first: profile.first_name ?? '',
        last: profile.last_name ?? '',
        email: profile.email ?? '',
      });

      const { data: breachData } = await supabase
        .from('data_breaches')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'new')
        .order('created_at', { ascending: false });

      setNewBreaches((breachData as DataBreach[]) ?? []);
      setBreachesLoaded(true);

      const { data: updatesData } = await supabase
        .from('user_updates')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'unread')
        .order('created_at', { ascending: false });

      setUserUpdates((updatesData as UserUpdate[]) ?? []);
      setUpdatesLoaded(true);
    }
    loadBreaches();
  }, []);

  // Show "all caught up" only when updates actually transition to zero.
  useEffect(() => {
    if (!updatesLoaded) return;

    const currentCount = userUpdates.length;
    const previousCount = prevUpdatesCountRef.current;

    if (previousCount > 0 && currentCount === 0) {
      setShowAllCaughtUp(true);
      const timer = window.setTimeout(() => setShowAllCaughtUp(false), 1800);
      prevUpdatesCountRef.current = currentCount;
      return () => window.clearTimeout(timer);
    }

    prevUpdatesCountRef.current = currentCount;
    return undefined;
  }, [updatesLoaded, userUpdates.length]);

// ── Dismiss update: status → 'dismissed' (optimistic) ───────────────────
  async function dismissUpdate(updateId: string) {
    setUserUpdates(prev => prev.filter(u => u.id !== updateId));

    const { error } = await supabase
      .from('user_updates')
      .update({ status: 'dismissed' })
      .eq('id', updateId);

    if (error) {
      console.error('[DashboardHome] dismissUpdate failed:', error.message);
      if (profileId) {
        const { data } = await supabase
          .from('user_updates')
          .select('*')
          .eq('user_id', profileId)
          .eq('status', 'unread')
          .order('created_at', { ascending: false });
        setUserUpdates((data as UserUpdate[]) ?? []);
      }
    }
  }

  // ── Click update CTA: status → 'clicked', then navigate ─────────────────
  async function clickUpdate(updateId: string, route: string) {
    setUserUpdates(prev => prev.filter(u => u.id !== updateId));

    await supabase
      .from('user_updates')
      .update({ status: 'clicked' })
      .eq('id', updateId);

    navigate(route);
  }

  function toggleInfo(cardId: string) {
    setOpenInfoCard(prev => (prev === cardId ? null : cardId));
  }

  const activeUpdate = userUpdates[0] ?? null;
  const shouldShowUpdatesSection = userUpdates.length > 0 || showAllCaughtUp;
  const displayName = [profileName.first, profileName.last].filter(Boolean).join(' ') || 'Account';
  const displayFirst = profileName.first.trim() || displayName.split(' ')[0] || 'Account';
  const displayInitials = initialsFromName(displayName);

  return (
    <div className="min-h-screen bg-[#0B1B2B] font-ubuntu">

      {/* ── SCROLLABLE CONTENT AREA ──────────────────────────────────────── */}
      <div className="pb-24 overflow-y-auto">
        <div className="flex flex-col gap-6 py-6 px-6">

          {/* ── PROFILE + NOTIFICATION ROW ───────────────────────────────── */}
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2"
              onClick={() => setUserDrawerOpen(true)}
              aria-label="Open profile drawer"
            >
              <div className="w-9 h-9 rounded-full bg-[#112538] border border-[#1E3A52] flex items-center justify-center flex-shrink-0">
                <span className="text-[#14ABFE] text-sm font-bold">{displayInitials}</span>
              </div>
              <span className="text-sm font-medium text-white">{displayFirst}</span>
              <ChevronDown className="w-4 h-4 text-[#7A92A8]" />
            </button>

            <button
              className="relative"
              onClick={() => console.log('open notifications')}
              aria-label="Open notifications"
            >
              <Settings className="w-5 h-5 text-white" />
              {newBreaches.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF8400] rounded-full text-[#0B1B2B] text-[10px] font-bold flex items-center justify-center leading-none">
                  {newBreaches.length}
                </span>
              )}
            </button>
          </div>

          {/* ── EXPOSURE SUMMARY HEADER + TIMEFRAME SELECT ───────────────── */}
          <section>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Exposure Summary</h1>
              <div className="relative flex-shrink-0">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                  className="appearance-none bg-[#112538] text-[#94A3B8] border border-[#1E3A52] rounded-full text-xs pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none focus:border-[#14ABFE] transition-colors duration-150"
                >
                  <option value="30D">30 Days</option>
                  <option value="90D">90 Days</option>
                  <option value="All">All Time</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#7A92A8] pointer-events-none" />
              </div>
            </div>

          </section>

          {/* ── METRIC CARDS — 2×2 GRID ──────────────────────────────────── */}
          <section className="grid grid-cols-2 gap-3">

            {/* Card 1 — Brokers */}
            <div className="bg-[#112538] border border-[#1E3A52] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">Brokers</span>
                <button className="ml-auto p-0.5" onClick={() => toggleInfo('exposures')} aria-label="More info about Brokers">
                  <Info className={`w-3.5 h-3.5 transition-colors duration-150 ${openInfoCard === 'exposures' ? 'text-[#14ABFE]' : 'text-[#7A92A8]'}`} />
                </button>
              </div>
              {openInfoCard === 'exposures' && (
                <div className="bg-[#0B1B2B] border border-[#1E3A52] rounded-lg px-2.5 py-1.5 -mt-1">
                  <p className="text-[11px] text-[#94A3B8] leading-snug">{CARD_INFO['exposures']}</p>
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white">{exposures.count}</p>
                <span className={`text-lg font-semibold ${getDeltaColor(exposures.delta, 'risk')}`}>{exposures.delta}</span>
              </div>
            </div>

            {/* Card 2 — Breaches (real data, tappable) */}
            <button
              className="bg-[#112538] border border-[#1E3A52] rounded-2xl p-4 flex flex-col gap-2 text-left"
              onClick={() => navigate('/dashboard/dark-web')}
            >
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">Breaches</span>
                <button
                  className="ml-auto p-0.5"
                  onClick={(e) => { e.stopPropagation(); toggleInfo('breaches'); }}
                  aria-label="More info about Breaches"
                >
                  <Info className={`w-3.5 h-3.5 transition-colors duration-150 ${openInfoCard === 'breaches' ? 'text-[#14ABFE]' : 'text-[#7A92A8]'}`} />
                </button>
              </div>
              {openInfoCard === 'breaches' && (
                <div className="bg-[#0B1B2B] border border-[#1E3A52] rounded-lg px-2.5 py-1.5 -mt-1">
                  <p className="text-[11px] text-[#94A3B8] leading-snug">{CARD_INFO['breaches']}</p>
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white">
                  {breachesLoaded ? newBreaches.length : '—'}
                </p>
                <span className={`text-lg font-semibold ${getDeltaColor(breachesDelta, 'risk')}`}>{breachesDelta}</span>
              </div>
            </button>

            {/* Card 3 — Removals Submitted */}
            <div className="bg-[#112538] border border-[#1E3A52] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">Removals Submitted</span>
                <button className="ml-auto p-0.5" onClick={() => toggleInfo('needs-attention')} aria-label="More info about Removals Submitted">
                  <Info className={`w-3.5 h-3.5 transition-colors duration-150 ${openInfoCard === 'needs-attention' ? 'text-[#14ABFE]' : 'text-[#7A92A8]'}`} />
                </button>
              </div>
              {openInfoCard === 'needs-attention' && (
                <div className="bg-[#0B1B2B] border border-[#1E3A52] rounded-lg px-2.5 py-1.5 -mt-1">
                  <p className="text-[11px] text-[#94A3B8] leading-snug">{CARD_INFO['needs-attention']}</p>
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white">{REMOVALS_SUBMITTED_DATA.count}</p>
                <span className={`text-lg font-semibold ${getDeltaColor(REMOVALS_SUBMITTED_DATA.delta, 'progress')}`}>{REMOVALS_SUBMITTED_DATA.delta}</span>
              </div>
            </div>

            {/* Card 4 — Removals Confirmed */}
            <div className="bg-[#112538] border border-[#1E3A52] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">Removals Confirmed</span>
                <button className="ml-auto p-0.5" onClick={() => toggleInfo('in-progress')} aria-label="More info about Removals Confirmed">
                  <Info className={`w-3.5 h-3.5 transition-colors duration-150 ${openInfoCard === 'in-progress' ? 'text-[#14ABFE]' : 'text-[#7A92A8]'}`} />
                </button>
              </div>
              {openInfoCard === 'in-progress' && (
                <div className="bg-[#0B1B2B] border border-[#1E3A52] rounded-lg px-2.5 py-1.5 -mt-1">
                  <p className="text-[11px] text-[#94A3B8] leading-snug">{CARD_INFO['in-progress']}</p>
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white">{removalsConfirmed.count}</p>
                <span className={`text-lg font-semibold ${getDeltaColor(removalsConfirmed.delta, 'progress')}`}>{removalsConfirmed.delta}</span>
              </div>
            </div>

          </section>

          {/* ── UPDATES ───────────────────────────────────────────────────── */}
          {shouldShowUpdatesSection && (
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-white">Updates</h2>
                {userUpdates.length > 0 && (
                  <span className="text-xs text-[#94A3B8]">{userUpdates.length} new</span>
                )}
              </div>

              {activeUpdate ? (() => {
                const typeConfig = UPDATE_TYPE_CONFIG[activeUpdate.type] ?? UPDATE_TYPE_CONFIG.info;
                const TypeIcon = typeConfig.Icon;
                const currentIndex = userUpdates.findIndex(u => u.id === activeUpdate.id) + 1;
                return (
                  <div className="bg-[#112538] border border-[#1E3A52] rounded-2xl px-5 py-4 flex flex-col gap-4">
                    {/* Top row: icon + label | dismiss */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-[#7A92A8] flex-shrink-0" />
                        <span className="text-xs text-[#7A92A8] font-medium">{activeUpdate.title}</span>
                      </div>
                      <button
                        className="text-[#7A92A8] hover:text-white transition-colors duration-150 flex-shrink-0 cursor-pointer"
                        onClick={() => dismissUpdate(activeUpdate.id)}
                        aria-label="Dismiss update"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>

                    {/* Body: large message text */}
                    <p className="text-base font-normal text-white leading-snug">{activeUpdate.message}</p>

                    {/* Footer: CTA + counter */}
                    <div className="flex items-center justify-between">
                      {activeUpdate.action_text && activeUpdate.action_route ? (
                        <button
                          className="text-sm font-semibold text-[#14ABFE] hover:text-[#00D4FF] underline underline-offset-2 transition-colors duration-150 cursor-pointer"
                          onClick={() => clickUpdate(activeUpdate.id, activeUpdate.action_route!)}
                        >
                          {activeUpdate.action_text}
                        </button>
                      ) : <span />}
                      {userUpdates.length > 1 && (
                        <span className="text-sm text-[#7A92A8]">
                          {currentIndex}/{userUpdates.length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-[#112538] border border-[#1E3A52] rounded-2xl px-5 py-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#00D4AA] flex-shrink-0" />
                  <p className="text-sm text-[#94A3B8]">You're all caught up</p>
                </div>
              )}
            </section>
          )}

          {/* ── SCAN STATUS ───────────────────────────────────────────────── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-white">Scan Status</h2>
              <button className="text-xs text-[#14ABFE]" onClick={() => console.log('view scan history')}>View Scan History</button>
            </div>

            <div className="flex flex-col gap-2">
              {scanStatusItems.map((item) => {
                const style = ACTIVITY_STYLES[item.type];
                const Icon  = style.Icon;
                const chip = STATUS_CHIP_STYLES[item.status];
                return (
                  <button
                    key={item.id}
                    className="bg-[#112538] border border-[#1E3A52] rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
                    onClick={() => console.log(`open activity: ${item.type}`)}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Icon className={`w-4 h-4 ${style.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-[#94A3B8]">{item.descriptor}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${chip.bg} ${chip.text}`}>{chip.label}</span>
                      <span className="text-xs text-[#7A92A8]">{item.time}</span>
                      <ChevronRight className="w-4 h-4 text-[#7A92A8]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── RECENT ACTIVITY (REMOVALS) ───────────────────────────────── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-white">Recent Activity</h2>
              <button className="text-xs text-[#14ABFE]" onClick={() => navigate('/dashboard/exposures')}>View All</button>
            </div>

            <div className="flex flex-col gap-2">
              {sortedRemovalItems.map((item) => {
                const style = ACTIVITY_STYLES['Removal'];
                const Icon = style.Icon;
                const chip = STATUS_CHIP_STYLES[item.status];
                return (
                  <button
                    key={item.id}
                    className="bg-[#112538] border border-[#1E3A52] rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
                    onClick={() => console.log(`open removal: ${item.id}`)}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Icon className={`w-4 h-4 ${style.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-[#94A3B8]">{item.descriptor}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${chip.bg} ${chip.text}`}>{chip.label}</span>
                      <span className="text-xs text-[#7A92A8]">{item.time}</span>
                      <ChevronRight className="w-4 h-4 text-[#7A92A8]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── BROKERS & BREACHES ───────────────────────────────────────── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-white">Brokers & Breaches</h2>
              <button className="text-xs text-[#14ABFE]" onClick={() => navigate('/dashboard/exposures')}>View All</button>
            </div>

            <div className="flex flex-col gap-2">
              {recentBrokerAndBreachItems.map((item) => {
                if (item.kind === 'broker') {
                  const brokerStyle = BROKER_STATUS_STYLES[item.brokerStatus];
                  return (
                    <button
                      key={item.id}
                      className="bg-[#112538] border border-[#1E3A52] rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
                      onClick={() => navigate('/dashboard/exposures')}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#0B1B2B] border border-[#1E3A52] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#14ABFE] text-xs font-bold">{item.initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className={`text-xs flex items-center ${brokerStyle.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 flex-shrink-0 ${brokerStyle.dot}`} />
                          {item.subtitle}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#7A92A8] flex-shrink-0" />
                    </button>
                  );
                }

                return (
                  <button
                    key={item.id}
                    className="bg-[#112538] border border-[#1E3A52] rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
                    onClick={() => navigate('/dashboard/dark-web')}
                  >
                    <div className="w-9 h-9 rounded-full bg-[#FF8400]/10 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-[#FF8400]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-[#94A3B8]">{item.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#7A92A8] flex-shrink-0" />
                  </button>
                );
              })}
              {recentBrokerAndBreachItems.length === 0 && (
                <p className="text-xs text-[#7A92A8]">No broker or breach updates yet.</p>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* ── FIXED BOTTOM NAV ──────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-[#0B1B2B] to-transparent z-50" aria-label="Main navigation">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-around bg-[#112538] rounded-full px-4 py-2 border border-[#1E3A52]">
            {[
              { label: 'Home',      Icon: Home,         path: '/dashboard/home',      active: true  },
              { label: 'Exposures', Icon: AlertTriangle,  path: '/dashboard/exposures', active: false },
              { label: 'Tasks',     Icon: ClipboardList, path: '/dashboard/tasks',     active: false },
              { label: 'Activity',  Icon: Activity,      path: '/dashboard/activity',  active: false },
            ].map(({ label, Icon, path, active }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(path)}
                className={`relative flex items-center justify-center w-14 h-10 rounded-full transition-colors cursor-pointer ${
                  active ? 'bg-[#0B1B2B]' : 'hover:bg-[#0B1B2B]/50'
                }`}
              >
                <Icon className={`w-6 h-6 ${active ? 'text-[#14ABFE]' : 'text-[#7A92A8]'}`} />
              </button>
            ))}
          </div>
        </div>
      </nav>

      <UserDrawer
        isOpen={userDrawerOpen}
        onClose={() => setUserDrawerOpen(false)}
        firstName={profileName.first}
        lastName={profileName.last}
        email={profileName.email}
      />

    </div>
  );
}
