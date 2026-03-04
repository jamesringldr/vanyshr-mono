import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, CheckCircle2, XCircle, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'vanyshr_removal_strategy';
type RemovalStrategy = 'aggressive' | 'targeted';

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

interface StrategyConfig {
  id: RemovalStrategy;
  label: string;
  recommended?: boolean;
  description: string;
  pros: string;
  cons: string;
  bestFor: string;
}

const STRATEGIES: StrategyConfig[] = [
  {
    id: 'aggressive',
    label: 'Aggressive Removal',
    recommended: true,
    description:
      'Vanyshr broadcasts removal requests to our entire network of 200+ brokers, regardless of whether their current database is publicly searchable.',
    pros: 'Widest possible reach; scrubs your data from "dark" brokers and prevents future listings before they happen.',
    cons: 'Requires sharing your "Opt-Out" details with the broker network to process the deletions.',
    bestFor: 'Users seeking the most aggressive and comprehensive digital cleanup.',
  },
  {
    id: 'targeted',
    label: 'Targeted Removal',
    description:
      'Vanyshr only sends removal requests to brokers where we have successfully confirmed your data is being actively hosted or sold.',
    pros: 'Maximum privacy; your personal identifiers are never shared with a broker that doesn\'t already have them.',
    cons: 'Higher "blind spot" risk; may miss "dark" brokers that sell data behind private APIs without public search tools.',
    bestFor: 'Privacy purists who want to minimize any new data exposure.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingRemovalStrategy() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<RemovalStrategy>('aggressive');
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirm() {
    if (isSaving) return;
    setIsSaving(true);
    localStorage.setItem(STORAGE_KEY, selected);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_profiles')
        .update({ removal_aggression: selected })
        .eq('auth_user_id', user.id);
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
              <h1 className="text-xl font-bold text-white">Removal Strategy</h1>
              <p className="text-xs text-[#7A92A8] mt-0.5">
                Choose how aggressively Vanyshr submits removals with data brokers.
              </p>
            </div>
          </div>

          {/* ── STRATEGY CARDS ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {STRATEGIES.map((strategy) => {
              const isSelected = selected === strategy.id;
              return (
                <button
                  key={strategy.id}
                  onClick={() => setSelected(strategy.id)}
                  className={[
                    'w-full text-left rounded-2xl p-5 border transition-all duration-150 cursor-pointer',
                    isSelected
                      ? 'bg-[#2D3847] border-[#00BFFF] shadow-[0_0_0_1px_rgba(0,191,255,0.2)]'
                      : 'bg-[#2D3847] border-[#2A4A68] hover:border-[#3A5A78]',
                  ].join(' ')}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center flex-wrap gap-2 min-w-0">
                      <span className="text-base font-bold text-white">{strategy.label}</span>
                      {strategy.recommended && (
                        <span
                          className={[
                            'text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full border transition-all duration-150',
                            isSelected
                              ? 'bg-[#00BFFF]/15 text-[#00BFFF] border-[#00BFFF]/40'
                              : 'bg-[#2A4A68] text-[#7A92A8] border-[#2A4A68]',
                          ].join(' ')}
                        >
                          Recommended
                        </span>
                      )}
                    </div>

                    {/* Radio Indicator */}
                    <div
                      className={[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-150',
                        isSelected ? 'border-[#00BFFF] bg-[#00BFFF]' : 'border-[#4A5568]',
                      ].join(' ')}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-[#022136]" />}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-[#B8C4CC] leading-relaxed mb-4">
                    {strategy.description}
                  </p>

                  {/* Divider */}
                  <div className="h-px bg-[#2A4A68] mb-4" />

                  {/* Pros */}
                  <div className="flex gap-2.5 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium tracking-wide uppercase text-[#00D4AA] block mb-0.5">
                        Pros
                      </span>
                      <p className="text-xs text-[#B8C4CC] leading-relaxed">{strategy.pros}</p>
                    </div>
                  </div>

                  {/* Cons */}
                  <div className="flex gap-2.5 mb-3">
                    <XCircle className="w-4 h-4 text-[#7A92A8] flex-shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium tracking-wide uppercase text-[#7A92A8] block mb-0.5">
                        Cons
                      </span>
                      <p className="text-xs text-[#7A92A8] leading-relaxed">{strategy.cons}</p>
                    </div>
                  </div>

                  {/* Best For */}
                  <div className="flex gap-2.5">
                    <Target className="w-4 h-4 text-[#00BFFF] flex-shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium tracking-wide uppercase text-[#00BFFF] block mb-0.5">
                        Best For
                      </span>
                      <p className="text-xs text-[#B8C4CC] leading-relaxed">{strategy.bestFor}</p>
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
          {isSaving ? 'Saving...' : 'Confirm & Continue'}
        </button>
      </div>
    </div>
  );
}
