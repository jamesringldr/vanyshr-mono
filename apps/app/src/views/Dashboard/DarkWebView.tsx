import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Shield, ChevronLeft, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BreachStatus = 'new' | 'unresolved' | 'resolved';

interface DataBreach {
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

type FilterTab = 'all' | BreachStatus;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BreachStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  new:        { label: 'New',        color: 'text-[#FF8A00]', bg: 'bg-[#FF8A00]/15',  Icon: AlertTriangle },
  unresolved: { label: 'Unresolved', color: 'text-[#FFB81C]', bg: 'bg-[#FFB81C]/15',  Icon: Clock         },
  resolved:   { label: 'Resolved',   color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/15',  Icon: CheckCircle   },
};

function formatBreachDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DarkWebView
// ─────────────────────────────────────────────────────────────────────────────

export function DarkWebView() {
  const navigate = useNavigate();

  const [profileId, setProfileId]   = useState<string | null>(null);
  const [breaches, setBreaches]     = useState<DataBreach[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [lastScanned, setLastScanned]   = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────
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
      setProfileId(profile.id);

      const { data } = await supabase
        .from('data_breaches')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (data) {
        setBreaches(data as DataBreach[]);
        if (data.length > 0) setLastScanned(data[0].created_at);
      }

      setIsLoading(false);
    }
    load();
  }, []);

  // ── Mark resolved ─────────────────────────────────────────────────────────
  async function markResolved(breachId: string) {
    const now = new Date().toISOString();

    // Optimistic update
    setBreaches(prev =>
      prev.map(b =>
        b.id === breachId ? { ...b, status: 'resolved', status_updated_at: now } : b
      )
    );

    const { error } = await supabase
      .from('data_breaches')
      .update({ status: 'resolved', status_updated_at: now })
      .eq('id', breachId);

    if (error) {
      console.error('[DarkWebView] markResolved failed:', error.message);
      // Revert on failure
      setBreaches(prev =>
        prev.map(b =>
          b.id === breachId ? { ...b, status: 'unresolved', status_updated_at: null } : b
        )
      );
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = activeFilter === 'all'
    ? breaches
    : breaches.filter(b => b.status === activeFilter);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all',        label: 'All'        },
    { key: 'new',        label: 'New'        },
    { key: 'unresolved', label: 'Unresolved' },
    { key: 'resolved',   label: 'Resolved'   },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#022136] font-ubuntu">
      <div className="pb-10 overflow-y-auto">
        <div className="flex flex-col gap-6 py-6 px-6">

          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1 rounded-lg hover:bg-[#2D3847] transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 text-[#7A92A8]" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Dark Web Scan</h1>
              {lastScanned && (
                <p className="text-xs text-[#7A92A8] mt-0.5">
                  Last scanned {timeAgo(lastScanned)}
                </p>
              )}
            </div>
          </div>

          {/* ── FILTER TABS ─────────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                  activeFilter === tab.key
                    ? 'bg-[#00BFFF]/20 border-[#00BFFF] text-[#00BFFF]'
                    : 'bg-transparent border-[#2A4A68] text-[#7A92A8] hover:border-[#4A6A88] hover:text-[#B8C4CC]'
                }`}
              >
                {tab.label}
                {tab.key !== 'all' && (
                  <span className="ml-1.5 text-[10px]">
                    ({breaches.filter(b => b.status === tab.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── BREACH LIST ──────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#2D3847] border border-[#2A4A68] rounded-xl h-28 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-6 py-10 flex flex-col items-center gap-3 text-center">
              <Shield className="w-8 h-8 text-[#00D4AA]" />
              <p className="text-sm font-bold text-white">
                {activeFilter === 'all'
                  ? 'No breaches found'
                  : `No ${activeFilter} breaches`}
              </p>
              <p className="text-xs text-[#7A92A8]">
                {activeFilter === 'all'
                  ? 'Your emails are clean. We\'ll notify you if anything changes.'
                  : `You have no breaches with status "${activeFilter}".`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(breach => {
                const cfg = STATUS_CONFIG[breach.status];
                const StatusIcon = cfg.Icon;
                return (
                  <div
                    key={breach.id}
                    className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-4 flex flex-col gap-3"
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#7A92A8]/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-[#7A92A8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white leading-snug">
                          {breach.breach_title || breach.breach_name}
                        </p>
                        {breach.breach_domain && (
                          <p className="text-xs text-[#7A92A8]">{breach.breach_domain}</p>
                        )}
                      </div>
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${cfg.color} ${cfg.bg}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label.toUpperCase()}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex flex-col gap-1">
                      {breach.breach_date && (
                        <p className="text-xs text-[#B8C4CC]">
                          <span className="text-[#7A92A8]">Breached:</span>{' '}
                          {formatBreachDate(breach.breach_date)}
                        </p>
                      )}
                      {breach.exposed_data_types && breach.exposed_data_types.length > 0 && (
                        <p className="text-xs text-[#B8C4CC]">
                          <span className="text-[#7A92A8]">Exposed:</span>{' '}
                          {breach.exposed_data_types.slice(0, 4).join(', ')}
                          {breach.exposed_data_types.length > 4 && ` +${breach.exposed_data_types.length - 4} more`}
                        </p>
                      )}
                      <p className="text-xs text-[#B8C4CC]">
                        <span className="text-[#7A92A8]">Matched:</span>{' '}
                        {breach.matched_email}
                      </p>
                    </div>

                    {/* Actions */}
                    {breach.status !== 'resolved' && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => markResolved(breach.id)}
                          className="text-xs font-medium text-[#00D4AA] border border-[#00D4AA]/40 rounded-lg px-3 py-1.5 hover:bg-[#00D4AA]/10 transition-colors duration-150"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
