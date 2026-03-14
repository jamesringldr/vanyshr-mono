import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ChevronLeft, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TasksOption = 'new' | 'reminders' | 'none';
type SnapshotFrequency = 'weekly' | 'monthly' | 'manual';

interface ManualSettings {
  alerts: {
    darkWebBreach: boolean;
    brokerExposure: boolean;
    tasks: TasksOption;
  };
  scanActivity: {
    brokerScanComplete: boolean;
    darkWebScanComplete: boolean;
  };
  removalActivity: {
    submitted: boolean;
    confirmed: boolean;
  };
  recapReports: {
    securitySnapshot: SnapshotFrequency;
    removalRecap: boolean;
  };
  productUpdates: {
    featureAnnouncements: boolean;
    dealsDiscounts: boolean;
  };
  newsInfo: {
    newsletter: boolean;
    securityTips: boolean;
    cyberSecurityAlerts: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults (mirrors General preset)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: ManualSettings = {
  alerts:          { darkWebBreach: true, brokerExposure: true, tasks: 'new' },
  scanActivity:    { brokerScanComplete: true, darkWebScanComplete: true },
  removalActivity: { submitted: true, confirmed: true },
  recapReports:    { securitySnapshot: 'weekly', removalRecap: true },
  productUpdates:  { featureAnnouncements: false, dealsDiscounts: false },
  newsInfo:        { newsletter: false, securityTips: false, cyberSecurityAlerts: true },
};

const SETTINGS_KEY = 'vanyshr_manual_settings';
const TIER_KEY     = 'vanyshr_notif_tier';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ToggleSwitch({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={isOn}
      onClick={onToggle}
      className={[
        'relative w-11 h-6 rounded-full transition-colors duration-150 cursor-pointer flex-shrink-0',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D3847]',
        isOn ? 'bg-[#00BFFF]' : 'bg-[#4A5568]',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-150',
          isOn ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

function PillSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-[#022136] rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'flex-1 text-xs font-medium py-1.5 px-1 rounded-md transition-colors duration-150 cursor-pointer',
            value === opt.value
              ? 'bg-[#2D3847] text-white shadow-sm'
              : 'text-[#7A92A8] hover:text-[#B8C4CC]',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[11px] font-medium tracking-wide uppercase text-[#7A92A8] px-1">
        {title}
      </h2>
      <div className="bg-[#2D3847] border border-[#2A4A68] rounded-2xl overflow-hidden divide-y divide-[#2A4A68]">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  right,
  stacked,
}: {
  label: string;
  hint?: string;
  right?: React.ReactNode;
  stacked?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{label}</p>
          {hint && (
            <p className="text-xs text-[#7A92A8] mt-0.5 leading-relaxed">{hint}</p>
          )}
        </div>
        {right && <div className="flex-shrink-0 mt-0.5">{right}</div>}
      </div>
      {stacked && <div>{stacked}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ManualNotifications
// ─────────────────────────────────────────────────────────────────────────────

function loadSettings(): ManualSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? (JSON.parse(saved) as ManualSettings) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function ManualNotifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? null;

  const [settings, setSettings] = useState<ManualSettings>(loadSettings);
  const [showBreachNudge, setShowBreachNudge] = useState(
    () => !loadSettings().alerts.darkWebBreach
  );
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load profileId and merge any DB-saved settings on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile) return;
      setProfileId(profile.id);

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('notification_settings')
        .eq('user_id', profile.id)
        .maybeSingle();

      // If DB has saved custom settings, prefer those over localStorage
      if (prefs?.notification_settings && Object.keys(prefs.notification_settings).length > 0) {
        const dbSettings = prefs.notification_settings as ManualSettings;
        setSettings(dbSettings);
        setShowBreachNudge(!dbSettings.alerts?.darkWebBreach);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(dbSettings));
      }
    }
    load();
  }, []);

  function update<K extends keyof ManualSettings>(group: K, patch: Partial<ManualSettings[K]>) {
    setSettings((prev) => ({
      ...prev,
      [group]: { ...prev[group], ...patch },
    }));

    if (group === 'alerts' && 'darkWebBreach' in patch) {
      setShowBreachNudge(!(patch as Partial<ManualSettings['alerts']>).darkWebBreach);
    }
  }

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(TIER_KEY, 'manual');

    if (profileId) {
      await supabase
        .from('user_preferences')
        .update({
          notification_tier: 'manual',
          notification_settings: settings,
        })
        .eq('user_id', profileId);
    }

    setIsSaving(false);
    if (returnTo) {
      navigate(returnTo, { replace: true });
    } else {
      navigate(-1);
    }
  }

  const { alerts, scanActivity, removalActivity, recapReports, productUpdates, newsInfo } = settings;

  return (
    <div className="min-h-screen bg-[#022136] font-ubuntu">
      <div className="pb-36 overflow-y-auto">
        <div className="flex flex-col gap-6 py-6 px-6">

          {/* ── HEADER ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-[#2D3847] border border-[#2A4A68] flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-[#3A5A78] transition-colors duration-150"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 text-[#B8C4CC]" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Custom Notifications</h1>
              <p className="text-xs text-[#7A92A8] mt-0.5">Manage each notification individually.</p>
            </div>
          </div>

          {/* ── DARK WEB BREACH NUDGE BANNER ───────────────────────────────── */}
          {showBreachNudge && (
            <div className="bg-[#022136] border border-[#FFB81C]/40 rounded-xl px-4 py-3 flex items-start gap-3">
              <Shield className="w-4 h-4 text-[#FFB81C] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#B8C4CC] leading-relaxed flex-1">
                <span className="text-[#FFB81C] font-medium">Dark Web Breach alerts are off.</span>
                {' '}These are the most time-sensitive notifications we send. We strongly recommend keeping them enabled.
              </p>
              <button
                onClick={() => update('alerts', { darkWebBreach: true })}
                className="text-xs text-[#00BFFF] font-medium hover:text-[#00D4FF] transition-colors duration-150 flex-shrink-0 cursor-pointer"
              >
                Turn On
              </button>
            </div>
          )}

          {/* ── GROUP 1: ALERTS ────────────────────────────────────────────── */}
          <Group title="Alerts">
            <Row
              label="New Dark Web Breach"
              hint="Get notified immediately when your data appears in a breach."
              right={
                <ToggleSwitch
                  isOn={alerts.darkWebBreach}
                  onToggle={() => update('alerts', { darkWebBreach: !alerts.darkWebBreach })}
                />
              }
            />
            <Row
              label="New Broker Exposure"
              hint="Notified when a new data broker listing is found containing your information."
              right={
                <ToggleSwitch
                  isOn={alerts.brokerExposure}
                  onToggle={() => update('alerts', { brokerExposure: !alerts.brokerExposure })}
                />
              }
            />
            <Row
              label="Tasks"
              hint="Control when you receive notifications about pending tasks."
              stacked={
                <PillSelector<TasksOption>
                  options={[
                    { label: 'New',       value: 'new'       },
                    { label: 'Reminders', value: 'reminders' },
                    { label: 'None',      value: 'none'      },
                  ]}
                  value={alerts.tasks}
                  onChange={(v) => update('alerts', { tasks: v })}
                />
              }
            />
          </Group>

          {/* ── GROUP 2: SCAN ACTIVITY ─────────────────────────────────────── */}
          <Group title="Scan Activity">
            <Row
              label="Broker Scan Complete"
              hint="Daily notification when your data broker scan finishes."
              right={
                <ToggleSwitch
                  isOn={scanActivity.brokerScanComplete}
                  onToggle={() =>
                    update('scanActivity', { brokerScanComplete: !scanActivity.brokerScanComplete })
                  }
                />
              }
            />
            <Row
              label="Dark Web Scan Complete"
              hint="Weekly notification when your dark web scan finishes."
              right={
                <ToggleSwitch
                  isOn={scanActivity.darkWebScanComplete}
                  onToggle={() =>
                    update('scanActivity', { darkWebScanComplete: !scanActivity.darkWebScanComplete })
                  }
                />
              }
            />
          </Group>

          {/* ── GROUP 3: REMOVAL ACTIVITY ──────────────────────────────────── */}
          <Group title="Removal Activity">
            <Row
              label="Removal Submitted"
              hint="Notified in real time when a removal request is sent to a broker."
              right={
                <ToggleSwitch
                  isOn={removalActivity.submitted}
                  onToggle={() =>
                    update('removalActivity', { submitted: !removalActivity.submitted })
                  }
                />
              }
            />
            <Row
              label="Removal Confirmed"
              hint="Notified when a broker confirms your data has been successfully removed."
              right={
                <ToggleSwitch
                  isOn={removalActivity.confirmed}
                  onToggle={() =>
                    update('removalActivity', { confirmed: !removalActivity.confirmed })
                  }
                />
              }
            />
          </Group>

          {/* ── GROUP 4: RECAP REPORTS ─────────────────────────────────────── */}
          <Group title="Recap Reports">
            <Row
              label="Security Snapshot"
              hint="A summarized view of your privacy health, exposures, and removal progress."
              stacked={
                <PillSelector<SnapshotFrequency>
                  options={[
                    { label: 'Weekly',  value: 'weekly'  },
                    { label: 'Monthly', value: 'monthly' },
                    { label: 'Manual',  value: 'manual'  },
                  ]}
                  value={recapReports.securitySnapshot}
                  onChange={(v) => update('recapReports', { securitySnapshot: v })}
                />
              }
            />
            <Row
              label="Removal Recap"
              hint="Periodic digest summarizing all removal activity across your brokers."
              right={
                <ToggleSwitch
                  isOn={recapReports.removalRecap}
                  onToggle={() =>
                    update('recapReports', { removalRecap: !recapReports.removalRecap })
                  }
                />
              }
            />
          </Group>

          {/* ── GROUP 5: PRODUCT UPDATES ───────────────────────────────────── */}
          <Group title="Product Updates">
            <Row
              label="Feature Announcements"
              hint="Updates about new Vanyshr features and improvements."
              right={
                <ToggleSwitch
                  isOn={productUpdates.featureAnnouncements}
                  onToggle={() =>
                    update('productUpdates', {
                      featureAnnouncements: !productUpdates.featureAnnouncements,
                    })
                  }
                />
              }
            />
            <Row
              label="Deals & Discounts"
              hint="Exclusive offers and plan upgrade opportunities."
              right={
                <ToggleSwitch
                  isOn={productUpdates.dealsDiscounts}
                  onToggle={() =>
                    update('productUpdates', { dealsDiscounts: !productUpdates.dealsDiscounts })
                  }
                />
              }
            />
          </Group>

          {/* ── GROUP 6: NEWS & INFO ───────────────────────────────────────── */}
          <Group title="News & Info">
            <Row
              label="Newsletter"
              hint="Periodic updates on privacy trends and the data broker landscape."
              right={
                <ToggleSwitch
                  isOn={newsInfo.newsletter}
                  onToggle={() => update('newsInfo', { newsletter: !newsInfo.newsletter })}
                />
              }
            />
            <Row
              label="Security Tips"
              hint="Actionable advice to help protect and strengthen your digital identity."
              right={
                <ToggleSwitch
                  isOn={newsInfo.securityTips}
                  onToggle={() => update('newsInfo', { securityTips: !newsInfo.securityTips })}
                />
              }
            />
            <Row
              label="Cyber Security Alerts"
              hint="Industry-wide threat alerts and major breach events that may affect you."
              right={
                <ToggleSwitch
                  isOn={newsInfo.cyberSecurityAlerts}
                  onToggle={() =>
                    update('newsInfo', { cyberSecurityAlerts: !newsInfo.cyberSecurityAlerts })
                  }
                />
              }
            />
          </Group>

        </div>
      </div>

      {/* ── STICKY SAVE BUTTON ─────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#022136] border-t border-[#2A4A68] px-6 py-5">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-[52px] rounded-xl bg-[#00BFFF] text-[#022136] font-bold text-base hover:bg-[#00D4FF] active:bg-[#0099CC] active:text-white transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
