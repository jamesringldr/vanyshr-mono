import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Shield, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";

export function SimpleWelcome() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name")
        .eq("auth_user_id", user.id)
        .single();

      if (profile?.first_name) setFirstName(profile.first_name);
    }
    load();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
            <Shield className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Vanyshr</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-8">
        <div className="space-y-12">
          {/* Welcome message */}
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-tight text-gray-900">
              {firstName ? `Welcome, ${firstName}` : "Welcome"}
            </h1>
            <p className="text-lg text-gray-600">Let's get you protected.</p>
          </div>

          {/* What we'll do */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                  1
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">Find where your data is exposed</p>
                  <p className="text-sm text-gray-600">
                    We'll search hundreds of data broker sites.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                  2
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">Remove it automatically</p>
                  <p className="text-sm text-gray-600">
                    We submit removal requests on your behalf.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                  3
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">Keep you protected</p>
                  <p className="text-sm text-gray-600">
                    We monitor continuously for new exposures.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* What we need */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <div className="space-y-3">
              <p className="font-medium text-blue-900">What we'll need from you</p>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Your legal name and date of birth</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Phone numbers and email addresses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Current and past addresses</span>
                </li>
              </ul>
              <p className="text-xs text-blue-700">
                We only use this to protect you. We never sell or share your data.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => navigate("/simple/onboarding/name")}
            className={cx(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700",
            )}
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
