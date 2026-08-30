import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router";
import { Shield, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";

export function SimpleOnboardingName() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name, last_name, date_of_birth")
        .eq("auth_user_id", user.id)
        .single();

      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setDateOfBirth(profile.date_of_birth ?? "");
      }
    }
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth) return;

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dateOfBirth,
        })
        .eq("auth_user_id", user.id);

      if (error) throw error;

      navigate("/simple/onboarding/phone");
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = firstName.trim() && lastName.trim() && dateOfBirth;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            onClick={() => navigate("/simple/welcome")}
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
                1
              </div>
              <span className="text-sm text-gray-500">of 4</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">What's your legal name?</h1>
            <p className="text-base text-gray-600">
              We need this to find where your data is listed.
            </p>
          </div>

          {/* Input fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-gray-700">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-gray-700">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="dob" className="mb-2 block text-sm font-medium text-gray-700">
                Date of birth
              </label>
              <input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
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
