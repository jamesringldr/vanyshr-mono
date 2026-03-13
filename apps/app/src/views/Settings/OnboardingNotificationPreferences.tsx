import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type NotificationTier = 'all' | 'general' | 'primary' | 'critical' | 'manual';

// ─────────────────────────────────────────────────────────────────────────────
// Tier Data
// ─────────────────────────────────────────────────────────────────────────────

interface TierConfig {
  id: NotificationTier;
  label: string;
  frequency: string | null;
  description: string;
  isNavigator?: boolean;
}

// Client-side mirror of the notification_settings_for_tier() SQL function.
// Keep in sync with supabase/migrations/20260304_user_tables_setup.sql Section 1d.
const TIER_SETTINGS: Record<Exclude<NotificationTier, 'manual'>, object> = {
  all: {
    alerts:          { darkWebBreach: true,  brokerExposure: true,  tasks: 'new' },
    scanActivity:    { brokerScanComplete: true,  darkWebScanComplete: true },
    removalActivity: { submitted: true,  confirmed: true },
    recapReports:    { securitySnapshot: 'weekly', removalRecap: true },
    productUpdates:  { featureAnnouncements: true,  dealsDiscounts: true },
    newsInfo:        { newsletter: true,  securityTips: true,  cyberSecurityAlerts: true },
  },
  general: {
    alerts:          { darkWebBreach: true,  brokerExposure: true,  tasks: 'new' },
    scanActivity:    { brokerScanComplete: true,  darkWebScanComplete: true },
    removalActivity: { submitted: true,  confirmed: true },
    recapReports:    { securitySnapshot: 'weekly', removalRecap: true },
    productUpdates:  { featureAnnouncements: false, dealsDiscounts: false },
    newsInfo:        { newsletter: false, securityTips: false, cyberSecurityAlerts: true },
  },
  primary: {
    alerts:          { darkWebBreach: true,  brokerExposure: true,  tasks: 'new' },
    scanActivity:    { brokerScanComplete: true,  darkWebScanComplete: true },
    removalActivity: { submitted: false, confirmed: false },
    recapReports:    { securitySnapshot: 'weekly', removalRecap: false },
    productUpdates:  { featureAnnouncements: false, dealsDiscounts: false },
    newsInfo:        { newsletter: false, securityTips: false, cyberSecurityAlerts: false },
  },
  critical: {
    alerts:          { darkWebBreach: true,  brokerExposure: true,  tasks: 'reminders' },
    scanActivity:    { brokerScanComplete: false, darkWebScanComplete: false },
    removalActivity: { submitted: false, confirmed: false },
    recapReports:    { securitySnapshot: 'monthly', removalRecap: true },
    productUpdates:  { featureAnnouncements: false, dealsDiscounts: false },
    newsInfo:        { newsletter: false, securityTips: false, cyberSecurityAlerts: false },
  },
};

const TIERS: TierConfig[] = [
  {
    id: 'all',
    label: 'All',
    frequency: '≈5/week',
    description:
      'Alerts, Scan Activity, Removal Activity, Recap Reports, Product Updates, Cyber Security Alerts, Newsletter, Security Tips',
  },
  {
    id: 'general',
    label: 'General',
    frequency: '3–5/week',
    description: 'Alerts, Scan Activity, Removal Activity, Recap Reports, Cyber Security Alerts',
  },
  {
    id: 'primary',
    label: 'Primary',
    frequency: '2–3/week',
    description: 'Alerts, Scan Activity, Recap Reports',
  },
  {
    id: 'critical',
    label: 'Critical',
    frequency: '1–3/week',
    description: 'Alerts, Recap Reports',
  },
  {
    id: 'manual',
    label: 'Manual',
    frequency: null,
    isNavigator: true,
    description:
      'Manually customize your notifications and frequency to match your exact preferences.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingNotificationPreferences() {
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<NotificationTier>('general');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing choice from DB so returning users see their previous selection.
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
        .select('notification_tier')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (prefs?.notification_tier) {
        setSelectedTier(prefs.notification_tier as NotificationTier);
      }
    }
    load();
  }, []);

  function handleTierSelect(id: NotificationTier) {
    if (id === 'manual') {
      navigate('/settings/notifications');
      return;
    }
    setSelectedTier(id);
  }

  async function handleConfirm() {
    if (isSaving) return;
    setIsSaving(true);

    if (profileId) {
      await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id:               profileId,
            notification_tier:     selectedTier,
            notification_settings: TIER_SETTINGS[selectedTier as Exclude<NotificationTier, 'manual'>] ?? {},
          },
          { onConflict: 'user_id' }
        );
    }

    setIsSaving(false);
    navigate('/onboarding/progress');
  }

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
              <h1 className="text-xl font-bold text-white">Notification Preferences</h1>
              <p className="text-xs text-[#7A92A8] mt-0.5">Choose how often you'd like to hear from us.</p>
            </div>
          </div>

          {/* ── TIER CARDS ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {TIERS.map((tier) => {
              const isSelected = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  onClick={() => handleTierSelect(tier.id)}
                  className={[
                    'w-full text-left rounded-2xl p-5 border transition-all duration-150 cursor-pointer',
                    isSelected
                      ? 'bg-[#2D3847] border-[#00BFFF] shadow-[0_0_0_1px_rgba(0,191,255,0.2)]'
                      : 'bg-[#2D3847] border-[#2A4A68] hover:border-[#3A5A78]',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5 mb-2">
                        <span className="text-base font-bold text-white">{tier.label}</span>
                        {tier.frequency && (
                          <span className="text-sm text-[#7A92A8]">({tier.frequency})</span>
                        )}
                      </div>
                      <p className="text-xs text-[#7A92A8] leading-relaxed">
                        {tier.description}
                      </p>
                    </div>

                    <div className="flex-shrink-0 mt-0.5">
                      {tier.isNavigator ? (
                        <ChevronRight
                          className={[
                            'w-5 h-5 transition-colors duration-150',
                            isSelected ? 'text-[#00BFFF]' : 'text-[#7A92A8]',
                          ].join(' ')}
                        />
                      ) : (
                        <div
                          className={[
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150',
                            isSelected ? 'border-[#00BFFF] bg-[#00BFFF]' : 'border-[#4A5568]',
                          ].join(' ')}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-[#022136]" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── STICKY CONFIRM FOOTER ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#022136] border-t border-[#2A4A68] px-6 py-5">
        <button
          onClick={handleConfirm}
          disabled={isSaving}
          className="w-full h-[52px] rounded-xl bg-[#00BFFF] text-[#022136] font-bold text-base hover:bg-[#00D4FF] active:bg-[#0099CC] active:text-white transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
