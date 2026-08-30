import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router";
import { Shield, ArrowRight, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";

export function SimpleOnboardingPhone() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (profile) {
        const { data: phoneData } = await supabase
          .from("user_phones")
          .select("phone_number")
          .eq("user_id", profile.id);

        if (phoneData) {
          setPhones(phoneData.map((p) => p.phone_number));
        }
      }
    }
    load();
  }, []);

  function addPhone() {
    if (!phone.trim()) return;
    setPhones([...phones, phone.trim()]);
    setPhone("");
  }

  function removePhone(index: number) {
    setPhones(phones.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Delete existing phones
      await supabase.from("user_phones").delete().eq("user_id", profile.id);

      // Insert new phones
      if (phones.length > 0) {
        await supabase
          .from("user_phones")
          .insert(phones.map((p) => ({ user_id: profile.id, phone_number: p })));
      }

      navigate("/simple/onboarding/address");
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    navigate("/simple/onboarding/address");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            onClick={() => navigate("/simple/onboarding/name")}
            className="mr-auto text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Vanyshr</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Question */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                2
              </div>
              <span className="text-sm text-gray-500">of 4</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Any phone numbers?</h1>
            <p className="text-base text-gray-600">
              We'll search for these across data broker sites.
            </p>
          </div>

          {/* Added phones */}
          {phones.length > 0 && (
            <div className="space-y-2">
              {phones.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <span className="text-sm text-gray-900">{p}</span>
                  <button
                    type="button"
                    onClick={() => removePhone(i)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPhone();
                }
              }}
              placeholder="(555) 123-4567"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addPhone}
              disabled={!phone.trim()}
              className={cx(
                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
                phone.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-gray-200 text-gray-400",
              )}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </form>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            onClick={handleSkip}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Skip for now
          </button>
          <button
            onClick={handleSubmit}
            disabled={phones.length === 0 || saving}
            className={cx(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors",
              phones.length > 0 && !saving
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-300",
            )}
          >
            {saving ? "Saving..." : "Continue"}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
