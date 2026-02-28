import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Shield,
  Globe,
  AlertTriangle,
  Clock,
  CheckCircle,
  X,
  ExternalLink,
  Home,
  Activity,
  ClipboardList,
  Search,
  Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ExposureStatus =
  | 'found'
  | 'queued'
  | 'removal_requested'
  | 'removal_in_progress'
  | 'removed'
  | 'verified_removed'
  | 'failed'
  | 'relisted'
  | 'manual_required'
  | 'ignored';

type BreachStatus = 'new' | 'unresolved' | 'resolved';

interface RawExposure {
  id: string;
  status: ExposureStatus;
  profile_url: string | null;
  data_snapshot: Record<string, unknown> | null;
  first_found_at: string;
  last_seen_at: string;
  removal_requested_at: string | null;
  removed_at: string | null;
  verified_removed_at: string | null;
  brokers: {
    name: string;
    slug: string;
    website_url: string | null;
  } | null;
}

interface RawBreach {
  id: string;
  breach_name: string;
  breach_title: string | null;
  breach_domain: string | null;
  breach_date: string | null;
  exposed_data_types: string[] | null;
  matched_email: string;
  status: BreachStatus;
  status_updated_at: string | null;
  created_at: string;
}

type ExposureItem = { kind: 'exposure' } & RawExposure;
type BreachItem   = { kind: 'breach'   } & RawBreach;
type ListItem     = ExposureItem | BreachItem;

type TypeFilter   = 'all' | 'exposure' | 'breach';
type StatusFilter = 'all' | 'active' | 'inprogress' | 'resolved';

// ─────────────────────────────────────────────────────────────────────────────
// Status config maps
// ─────────────────────────────────────────────────────────────────────────────

const EXPOSURE_STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  Icon: React.ElementType;
}> = {
  found:               { label: 'Exposed',          color: 'text-[#FF8A00]', bg: 'bg-[#FF8A00]/15', Icon: AlertTriangle },
  queued:              { label: 'Queued',            color: 'text-[#FFB81C]', bg: 'bg-[#FFB81C]/15', Icon: Clock         },
  removal_requested:   { label: 'Removal Req.',      color: 'text-[#FFB81C]', bg: 'bg-[#FFB81C]/15', Icon: Clock         },
  removal_in_progress: { label: 'In Progress',       color: 'text-[#00BFFF]', bg: 'bg-[#00BFFF]/15', Icon: Clock         },
  removed:             { label: 'Removed',           color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/15', Icon: CheckCircle   },
  verified_removed:    { label: 'Verified Removed',  color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/15', Icon: CheckCircle   },
  failed:              { label: 'Failed',            color: 'text-[#FF5757]', bg: 'bg-[#FF5757]/15', Icon: AlertTriangle },
  relisted:            { label: 'Relisted',          color: 'text-[#FF8A00]', bg: 'bg-[#FF8A00]/15', Icon: AlertTriangle },
  manual_required:     { label: 'Action Needed',     color: 'text-[#FFB81C]', bg: 'bg-[#FFB81C]/15', Icon: AlertTriangle },
  ignored:             { label: 'Ignored',           color: 'text-[#7A92A8]', bg: 'bg-[#7A92A8]/15', Icon: Clock         },
};

const BREACH_STATUS_CONFIG: Record<BreachStatus, {
  label: string;
  color: string;
  bg: string;
  Icon: React.ElementType;
}> = {
  new:        { label: 'New',        color: 'text-[#FF8A00]', bg: 'bg-[#FF8A00]/15', Icon: AlertTriangle },
  unresolved: { label: 'Unresolved', color: 'text-[#FFB81C]', bg: 'bg-[#FFB81C]/15', Icon: Clock         },
  resolved:   { label: 'Resolved',   color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/15', Icon: CheckCircle   },
};

// Status filter dropdown options
const STATUS_FILTER_OPTIONS: { key: StatusFilter; label: string; dot: string | null }[] = [
  { key: 'all',        label: 'All',         dot: null            },
  { key: 'active',     label: 'Exposed',     dot: 'bg-[#FF8A00]' },
  { key: 'inprogress', label: 'In Progress', dot: 'bg-[#00BFFF]' },
  { key: 'resolved',   label: 'Resolved',    dot: 'bg-[#00D4AA]' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const days  = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30)  return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

function getItemDate(item: ListItem): string {
  return item.kind === 'exposure' ? item.first_found_at : item.created_at;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function snapshotPreview(snapshot: Record<string, unknown> | null): string | null {
  if (!snapshot) return null;
  const LABELS: Record<string, string> = {
    name: 'name', address: 'address', phones: 'phone', emails: 'email',
    age: 'age', relatives: 'relatives', employer: 'employer',
  };
  const found = Object.entries(LABELS)
    .filter(([key]) => snapshot[key] && (Array.isArray(snapshot[key]) ? (snapshot[key] as unknown[]).length > 0 : true))
    .map(([, label]) => label);
  return found.length > 0 ? found.slice(0, 3).join(', ') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ExposureCard
// ─────────────────────────────────────────────────────────────────────────────

function ExposureCard({ item, onClick }: { item: ExposureItem; onClick: () => void }) {
  const cfg        = EXPOSURE_STATUS_CONFIG[item.status] ?? EXPOSURE_STATUS_CONFIG.found;
  const StatusIcon = cfg.Icon;
  const brokerName = item.brokers?.name ?? 'Unknown Broker';
  const preview    = snapshotPreview(item.data_snapshot);

  return (
    <button
      className="w-full bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3.5 flex items-center gap-3 text-left hover:border-[#3A5A78] transition-colors duration-150 cursor-pointer"
      onClick={onClick}
      aria-label={`View details for ${brokerName} exposure`}
    >
      {/* Broker avatar */}
      <div className="w-10 h-10 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
        <span className="text-[#00BFFF] text-xs font-bold">{initials(brokerName)}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-tight truncate">{brokerName}</p>
        {preview && (
          <p className="text-xs text-[#7A92A8] mt-0.5 truncate">{preview}</p>
        )}
        <p className="text-[10px] text-[#7A92A8] mt-0.5">Found {timeAgo(item.first_found_at)}</p>
      </div>

      {/* Status */}
      <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
        <StatusIcon className="w-2.5 h-2.5" aria-hidden="true" />
        {cfg.label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BreachCard
// ─────────────────────────────────────────────────────────────────────────────

function BreachCard({ item, onClick }: { item: BreachItem; onClick: () => void }) {
  const cfg        = BREACH_STATUS_CONFIG[item.status];
  const StatusIcon = cfg.Icon;
  const title      = item.breach_title ?? item.breach_name;

  return (
    <button
      className="w-full bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3.5 flex items-center gap-3 text-left hover:border-[#3A5A78] transition-colors duration-150 cursor-pointer"
      onClick={onClick}
      aria-label={`View details for ${title} breach`}
    >
      {/* Shield avatar */}
      <div className="w-10 h-10 rounded-lg bg-[#7A92A8]/10 flex items-center justify-center flex-shrink-0">
        <Shield className="w-5 h-5 text-[#7A92A8]" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-tight truncate">{title}</p>
        <p className="text-xs text-[#7A92A8] mt-0.5 truncate">{item.matched_email}</p>
        <p className="text-[10px] text-[#7A92A8] mt-0.5">
          {item.breach_date ? `Breached ${formatDate(item.breach_date)}` : `Found ${timeAgo(item.created_at)}`}
        </p>
      </div>

      {/* Badges stacked */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className="text-[9px] font-medium text-[#7A92A8] bg-[#7A92A8]/10 px-2 py-0.5 rounded-full">
          DARK WEB
        </span>
        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
          <StatusIcon className="w-2.5 h-2.5" aria-hidden="true" />
          {cfg.label}
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom Sheet Modal wrapper
// ─────────────────────────────────────────────────────────────────────────────

function BottomSheetModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div className="relative bg-[#022136] border-t border-[#2A4A68] rounded-t-2xl px-6 pt-3 pb-10 max-h-[88vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="w-10 h-1 bg-[#2A4A68] rounded-full mx-auto mb-5" />
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExposureModal
// ─────────────────────────────────────────────────────────────────────────────

function ExposureModal({
  item,
  onClose,
  onUpdate,
}: {
  item: ExposureItem;
  onClose: () => void;
  onUpdate: (id: string, status: ExposureStatus) => void;
}) {
  const cfg        = EXPOSURE_STATUS_CONFIG[item.status] ?? EXPOSURE_STATUS_CONFIG.found;
  const StatusIcon = cfg.Icon;
  const brokerName = item.brokers?.name ?? 'Unknown Broker';
  const snapshot   = item.data_snapshot ?? {};
  const snapshotEntries = Object.entries(snapshot).filter(([, v]) =>
    v !== null && v !== undefined && v !== ''
  );

  const isActionable = !['removed', 'verified_removed', 'ignored'].includes(item.status);

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
            <span className="text-[#00BFFF] text-xs font-bold">{initials(brokerName)}</span>
          </div>
          <div>
            <p className="text-base font-bold text-white">{brokerName}</p>
            {item.brokers?.website_url && (
              <a
                href={item.brokers.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#00BFFF] mt-0.5 hover:text-[#00D4FF] transition-colors"
              >
                <Globe className="w-3 h-3" aria-hidden="true" />
                {item.brokers.website_url.replace(/^https?:\/\//, '')}
                <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[#2D3847] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-[#7A92A8]" />
        </button>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2.5">
        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cfg.color} ${cfg.bg}`}>
          <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {cfg.label}
        </span>
        <span className="text-xs text-[#7A92A8]">Broker Exposure</span>
      </div>

      {/* Timeline */}
      <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3.5 flex flex-col gap-2">
        <p className="text-[11px] font-medium text-[#7A92A8] uppercase tracking-wide">Timeline</p>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-white">
            <span className="text-[#7A92A8]">First found: </span>
            {formatDate(item.first_found_at)}
          </p>
          <p className="text-xs text-white">
            <span className="text-[#7A92A8]">Last seen: </span>
            {formatDate(item.last_seen_at)}
          </p>
          {item.removal_requested_at && (
            <p className="text-xs text-white">
              <span className="text-[#7A92A8]">Removal requested: </span>
              {formatDate(item.removal_requested_at)}
            </p>
          )}
          {item.removed_at && (
            <p className="text-xs text-white">
              <span className="text-[#7A92A8]">Removed: </span>
              {formatDate(item.removed_at)}
            </p>
          )}
          {item.verified_removed_at && (
            <p className="text-xs text-white">
              <span className="text-[#7A92A8]">Verified removed: </span>
              {formatDate(item.verified_removed_at)}
            </p>
          )}
        </div>
      </div>

      {/* Data snapshot */}
      {snapshotEntries.length > 0 && (
        <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3.5 flex flex-col gap-2">
          <p className="text-[11px] font-medium text-[#7A92A8] uppercase tracking-wide">Exposed Data</p>
          <div className="flex flex-col gap-1.5">
            {snapshotEntries.map(([key, value]) => (
              <p key={key} className="text-xs text-white">
                <span className="text-[#7A92A8] capitalize">{key.replace(/_/g, ' ')}: </span>
                {Array.isArray(value)
                  ? (value as string[]).join(', ')
                  : String(value)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* View listing link */}
      {item.profile_url && (
        <a
          href={item.profile_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm font-medium text-[#00BFFF] border border-[#00BFFF]/40 rounded-xl py-3 hover:bg-[#00BFFF]/10 transition-colors duration-150"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          View Listing
        </a>
      )}

      {/* Ignore action */}
      {isActionable && (
        <button
          onClick={() => onUpdate(item.id, 'ignored')}
          className="text-xs text-[#7A92A8] border border-[#2A4A68] rounded-xl py-2.5 hover:text-white hover:border-[#3A5A78] transition-colors duration-150 cursor-pointer"
        >
          Ignore This Exposure
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BreachModal
// ─────────────────────────────────────────────────────────────────────────────

function BreachModal({
  item,
  onClose,
  onMarkResolved,
}: {
  item: BreachItem;
  onClose: () => void;
  onMarkResolved: (id: string) => void;
}) {
  const cfg        = BREACH_STATUS_CONFIG[item.status];
  const StatusIcon = cfg.Icon;
  const title      = item.breach_title ?? item.breach_name;

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#7A92A8]/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-[#7A92A8]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-bold text-white">{title}</p>
            {item.breach_domain && (
              <p className="text-xs text-[#7A92A8] mt-0.5">{item.breach_domain}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[#2D3847] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-[#7A92A8]" />
        </button>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2.5">
        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cfg.color} ${cfg.bg}`}>
          <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {cfg.label}
        </span>
        <span className="text-xs text-[#7A92A8]">Dark Web Breach</span>
      </div>

      {/* Breach details */}
      <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3.5 flex flex-col gap-2">
        <p className="text-[11px] font-medium text-[#7A92A8] uppercase tracking-wide">Breach Details</p>
        <div className="flex flex-col gap-1.5">
          {item.breach_date && (
            <p className="text-xs text-white">
              <span className="text-[#7A92A8]">Breach date: </span>
              {formatDate(item.breach_date)}
            </p>
          )}
          <p className="text-xs text-white">
            <span className="text-[#7A92A8]">Matched email: </span>
            {item.matched_email}
          </p>
          <p className="text-xs text-white">
            <span className="text-[#7A92A8]">Discovered: </span>
            {timeAgo(item.created_at)}
          </p>
        </div>
      </div>

      {/* Exposed data types */}
      {item.exposed_data_types && item.exposed_data_types.length > 0 && (
        <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3.5 flex flex-col gap-2.5">
          <p className="text-[11px] font-medium text-[#7A92A8] uppercase tracking-wide">
            Exposed Data Types
          </p>
          <div className="flex flex-wrap gap-2">
            {item.exposed_data_types.map(type => (
              <span
                key={type}
                className="text-xs text-[#B8C4CC] bg-[#022136] border border-[#2A4A68] rounded-lg px-2.5 py-1"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended action */}
      <div className="bg-[#FF8A00]/8 border border-[#FF8A00]/25 rounded-xl px-4 py-3.5">
        <p className="text-xs font-bold text-[#FF8A00] mb-1.5">Recommended Action</p>
        <p className="text-xs text-[#B8C4CC] leading-relaxed">
          Change the password for any accounts using{' '}
          <span className="text-white">{item.matched_email}</span> and enable
          two-factor authentication where available.
        </p>
      </div>

      {/* Mark resolved */}
      {item.status !== 'resolved' && (
        <button
          onClick={() => onMarkResolved(item.id)}
          className="w-full text-sm font-medium text-[#00D4AA] border border-[#00D4AA]/40 rounded-xl py-3 hover:bg-[#00D4AA]/10 transition-colors duration-150 cursor-pointer"
        >
          Mark Resolved
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeletons
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className="bg-[#2D3847] border border-[#2A4A68] rounded-xl h-[72px] animate-pulse"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExposuresView
// ─────────────────────────────────────────────────────────────────────────────

export function ExposuresView() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading]       = useState(true);
  const [exposures, setExposures]       = useState<ExposureItem[]>([]);
  const [breaches, setBreaches]         = useState<BreachItem[]>([]);
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
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

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile) { setIsLoading(false); return; }

      const [{ data: exposureData }, { data: breachData }] = await Promise.all([
        supabase
          .from('exposures')
          .select('*, brokers(name, slug, website_url)')
          .eq('user_id', profile.id)
          .order('first_found_at', { ascending: false }),
        supabase
          .from('data_breaches')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
      ]);

      setExposures((exposureData ?? []).map(e => ({ ...e, kind: 'exposure' as const })));
      setBreaches((breachData ?? []).map(b => ({ ...b, kind: 'breach' as const })));
      setIsLoading(false);
    }
    load();
  }, []);

  // ── Filter predicates ─────────────────────────────────────────────────
  const ACTIVE_EXPOSURE = new Set(['found', 'queued', 'manual_required', 'relisted', 'failed']);
  const INPROG_EXPOSURE = new Set(['removal_requested', 'removal_in_progress']);
  const RESOLVED_EXPOSURE = new Set(['removed', 'verified_removed', 'ignored']);

  function matchesStatus(item: ListItem): boolean {
    if (statusFilter === 'all') return true;
    if (item.kind === 'exposure') {
      if (statusFilter === 'active')     return ACTIVE_EXPOSURE.has(item.status);
      if (statusFilter === 'inprogress') return INPROG_EXPOSURE.has(item.status);
      if (statusFilter === 'resolved')   return RESOLVED_EXPOSURE.has(item.status);
    } else {
      if (statusFilter === 'active')     return item.status === 'new';
      if (statusFilter === 'inprogress') return item.status === 'unresolved';
      if (statusFilter === 'resolved')   return item.status === 'resolved';
    }
    return true;
  }

  // ── Combined sorted list ──────────────────────────────────────────────
  const allItems: ListItem[] = [...exposures, ...breaches].sort(
    (a, b) => new Date(getItemDate(b)).getTime() - new Date(getItemDate(a)).getTime()
  );

  const filtered = allItems.filter(item => {
    if (typeFilter === 'exposure' && item.kind !== 'exposure') return false;
    if (typeFilter === 'breach'   && item.kind !== 'breach')   return false;
    if (!matchesStatus(item)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (item.kind === 'exposure') {
        const name = (item.brokers?.name ?? '').toLowerCase();
        const snap = JSON.stringify(item.data_snapshot ?? '').toLowerCase();
        if (!name.includes(q) && !snap.includes(q)) return false;
      } else {
        const title  = (item.breach_title ?? item.breach_name).toLowerCase();
        const domain = (item.breach_domain ?? '').toLowerCase();
        const email  = item.matched_email.toLowerCase();
        if (!title.includes(q) && !domain.includes(q) && !email.includes(q)) return false;
      }
    }
    return true;
  });

  // ── Actions ───────────────────────────────────────────────────────────
  async function markBreachResolved(breachId: string) {
    const now = new Date().toISOString();
    setBreaches(prev =>
      prev.map(b => b.id === breachId ? { ...b, status: 'resolved' as BreachStatus, status_updated_at: now } : b)
    );
    setSelectedItem(null);
    const { error } = await supabase
      .from('data_breaches')
      .update({ status: 'resolved', status_updated_at: now })
      .eq('id', breachId);
    if (error) console.error('[ExposuresView] markBreachResolved:', error.message);
  }

  async function updateExposureStatus(exposureId: string, status: ExposureStatus) {
    setExposures(prev => prev.map(e => e.id === exposureId ? { ...e, status } : e));
    setSelectedItem(null);
    const { error } = await supabase
      .from('exposures')
      .update({ status })
      .eq('id', exposureId);
    if (error) console.error('[ExposuresView] updateExposureStatus:', error.message);
  }

  // ── Tab configs ───────────────────────────────────────────────────────
  const typeTabs: { key: TypeFilter; label: string }[] = [
    { key: 'all',      label: 'All'      },
    { key: 'exposure', label: 'Brokers'  },
    { key: 'breach',   label: 'Breaches' },
  ];

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#022136] font-ubuntu">
      <div className="pb-24 overflow-y-auto">
        <div className="flex flex-col gap-5 py-6 px-6">

          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Exposures & Breaches</h1>

            {/* Status filter icon + dropdown */}
            <div className="relative" ref={filterMenuRef}>
              <button
                type="button"
                aria-label="Filter by status"
                onClick={() => setShowStatusMenu(s => !s)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  statusFilter !== 'all'
                    ? 'bg-[#00BFFF]/20 border border-[#00BFFF]'
                    : 'bg-[#2D3847] border border-[#2A4A68]'
                }`}
              >
                <Filter className={`w-4 h-4 ${statusFilter !== 'all' ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
              </button>

              {showStatusMenu && (
                <div className="absolute right-0 top-10 z-20 bg-[#2D3847] border border-[#2A4A68] rounded-xl overflow-hidden shadow-xl min-w-[152px]">
                  {STATUS_FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setStatusFilter(opt.key); setShowStatusMenu(false); }}
                      className={`w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                        statusFilter === opt.key
                          ? 'bg-[#00BFFF]/15 text-[#00BFFF]'
                          : 'text-[#B8C4CC] hover:bg-[#022136]/50 hover:text-white'
                      }`}
                    >
                      {opt.dot && (
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${opt.dot}`} />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── SEARCH BAR ───────────────────────────────────────────────── */}
          <div className="relative">
            <input
              type="search"
              placeholder="Search exposures & breaches"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-[52px] w-full rounded-xl border border-[#2A4A68] px-12 py-3 text-sm bg-[#022136]/50 text-white placeholder:text-[#7A92A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 transition-all font-ubuntu"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7A92A8] pointer-events-none" aria-hidden="true" />
          </div>

          {/* ── TYPE FILTER CHIPS ────────────────────────────────────────── */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {typeTabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setTypeFilter(tab.key); setStatusFilter('all'); }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  typeFilter === tab.key
                    ? 'bg-[#00BFFF] text-[#022136]'
                    : 'bg-[#2D3847] border border-[#2A4A68] text-[#B8C4CC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── LIST ─────────────────────────────────────────────────────── */}
          {isLoading ? (
            <SkeletonList />
          ) : filtered.length === 0 ? (
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-6 py-12 flex flex-col items-center gap-3 text-center">
              <Shield className="w-8 h-8 text-[#00D4AA]" aria-hidden="true" />
              <p className="text-sm font-bold text-white">
                {allItems.length === 0 ? 'All clear' : 'No results for this filter'}
              </p>
              <p className="text-xs text-[#7A92A8] leading-relaxed">
                {allItems.length === 0
                  ? "We haven't found any exposures yet. Run a full scan to check all data brokers."
                  : 'Try selecting a different filter above.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filtered.map(item =>
                item.kind === 'exposure' ? (
                  <ExposureCard
                    key={`exp-${item.id}`}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                  />
                ) : (
                  <BreachCard
                    key={`breach-${item.id}`}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                  />
                )
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── BOTTOM NAV ───────────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-[#022136] border-t border-[#2A4A68] h-16 px-2 flex items-center justify-around z-40"
        aria-label="Main navigation"
      >
        {[
          { label: 'Home',      Icon: Home,          path: '/dashboard/home',      active: false },
          { label: 'Exposures', Icon: Shield,         path: '/dashboard/exposures', active: true  },
          { label: 'To Do',     Icon: ClipboardList,  path: '/dashboard/todos',     active: false },
          { label: 'Activity',  Icon: Activity,       path: '/activity',            active: false },
        ].map(({ label, Icon, path, active }) => (
          <button
            key={label}
            className="flex flex-col items-center gap-1 flex-1 py-2 cursor-pointer"
            onClick={() => navigate(path)}
            aria-label={`Navigate to ${label}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} aria-hidden="true" />
            <span className={`text-[10px] font-medium ${active ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`}>
              {label}
            </span>
          </button>
        ))}
      </nav>

      {/* ── BOTTOM SHEET MODAL ───────────────────────────────────────────── */}
      {selectedItem && (
        <BottomSheetModal onClose={() => setSelectedItem(null)}>
          {selectedItem.kind === 'exposure' ? (
            <ExposureModal
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onUpdate={updateExposureStatus}
            />
          ) : (
            <BreachModal
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onMarkResolved={markBreachResolved}
            />
          )}
        </BottomSheetModal>
      )}
    </div>
  );
}
