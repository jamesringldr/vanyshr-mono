import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Shield, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";

interface DataBreach {
  id: string;
  breach_name: string;
  breach_title: string | null;
  status: "new" | "unresolved" | "resolved";
}

export function SimpleHome() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState<string>("");
  const [newBreaches, setNewBreaches] = useState<DataBreach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, first_name")
        .eq("auth_user_id", user.id)
        .single();

      if (profile) {
        setFirstName(profile.first_name ?? "");

        const { data: breachData } = await supabase
          .from("data_breaches")
          .select("*")
          .eq("user_id", profile.id)
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(3);

        setNewBreaches((breachData as DataBreach[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const greeting = firstName ? `Hi, ${firstName}` : "Hi there";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Vanyshr</span>
          </div>
          <button
            onClick={() => navigate("/simple/settings")}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-12">
        <div className="space-y-8">
          {/* Greeting */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">{greeting}</h1>
            <p className="text-base text-gray-600">
              {newBreaches.length > 0
                ? "We found some things that need your attention."
                : "Everything looks good. We're keeping watch."}
            </p>
          </div>

          {/* New breaches alert */}
          {newBreaches.length > 0 && (
            <button
              onClick={() => navigate("/simple/breaches")}
              className={cx(
                "w-full rounded-2xl border border-red-100 bg-red-50 p-6 text-left transition-all hover:border-red-200 hover:bg-red-100",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium text-red-900">
                      {newBreaches.length === 1 ? "1 new breach" : `${newBreaches.length} new breaches`}
                    </span>
                  </div>
                  <p className="text-sm text-red-700">
                    Your data was found in a recent breach. Tap to see details.
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-red-600" />
              </div>
            </button>
          )}

          {/* Status card */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Your status</h2>
            <button
              onClick={() => navigate("/simple/status")}
              className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left transition-all hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-base font-medium text-gray-900">Protection active</p>
                  <p className="text-sm text-gray-600">
                    We're monitoring for exposures and working on removals.
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
              </div>
            </button>
          </div>

          {/* Quick actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate("/simple/scan")}
                className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Run a new scan</span>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </button>
              <button
                onClick={() => navigate("/simple/removals")}
                className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">View removal requests</span>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/80 px-4 py-4 backdrop-blur-lg">
        <div className="mx-auto max-w-2xl">
          <p className="text-center text-xs text-gray-500">
            Need help? <button className="font-medium text-blue-600 hover:text-blue-700">Chat with us</button>
          </p>
        </div>
      </div>
    </div>
  );
}
