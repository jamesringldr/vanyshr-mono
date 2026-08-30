import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router";
import { Shield, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";

export function SimpleOnboardingAddress() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
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
        const { data: addressData } = await supabase
          .from("user_addresses")
          .select("*")
          .eq("user_id", profile.id)
          .limit(1)
          .single();

        if (addressData) {
          setCity(addressData.city ?? "");
          setState(addressData.state ?? "");
          setZipCode(addressData.zip_code ?? "");
        }
      }
    }
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!city.trim() || !state.trim() || !zipCode.trim()) return;

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

      // Insert or update address
      const { data: existing } = await supabase
        .from("user_addresses")
        .select("id")
        .eq("user_id", profile.id)
        .limit(1)
        .single();

      if (existing) {
        await supabase
          .from("user_addresses")
          .update({
            city: city.trim(),
            state: state.trim(),
            zip_code: zipCode.trim(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("user_addresses").insert({
          user_id: profile.id,
          city: city.trim(),
          state: state.trim(),
          zip_code: zipCode.trim(),
        });
      }

      navigate("/simple/onboarding/complete");
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = city.trim() && state.trim() && zipCode.trim();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            onClick={() => navigate("/simple/onboarding/phone")}
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
                3
              </div>
              <span className="text-sm text-gray-500">of 4</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Where do you live?</h1>
            <p className="text-base text-gray-600">
              We need your current address to find data broker listings.
            </p>
          </div>

          {/* Input fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="city" className="mb-2 block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="San Francisco"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="state" className="mb-2 block text-sm font-medium text-gray-700">
                  State
                </label>
                <input
                  id="state"
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="CA"
                  maxLength={2}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="zipCode" className="mb-2 block text-sm font-medium text-gray-700">
                  ZIP code
                </label>
                <input
                  id="zipCode"
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="94102"
                  maxLength={5}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className={cx(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors",
              canSubmit && !saving
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
