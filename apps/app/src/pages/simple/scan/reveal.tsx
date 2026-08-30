import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Shield, AlertTriangle, Mail, Phone, MapPin, Users, ArrowRight } from "lucide-react";
import { loadConsolidatedProfile, type ConsolidatedProfile } from "@/pages/pilot-scan/consolidated-profile";

/**
 * Simple scan reveal — the "oh shit" moment.
 * Shows what was found in minimal, punchy cards. No hex chart, no dense tables.
 * One section at a time, lots of air, conversational copy.
 */
export function SimpleScanReveal() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ConsolidatedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = loadConsolidatedProfile();
    if (data.data) {
      setProfile(data.data);
    }
    setLoading(false);
  }, []);

  const stats = useMemo(() => {
    if (!profile) return { emails: 0, phones: 0, addresses: 0, relatives: 0 };
    return {
      emails: profile.emails?.length ?? 0,
      phones: profile.phones?.length ?? 0,
      addresses: (profile.previous_addresses?.length ?? 0) + (profile.primary_address ? 1 : 0),
      relatives: profile.relatives?.length ?? 0,
    };
  }, [profile]);

  const total = stats.emails + stats.phones + stats.addresses + stats.relatives;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <header className="px-4 py-6">
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-lg font-semibold text-gray-900">Vanyshr</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-16">
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">No results found</h1>
            <p className="text-base text-gray-600">
              We didn't find any public records for this search.
            </p>
            <button
              onClick={() => navigate("/simple/scan")}
              className="mx-auto mt-8 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Try another search
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-lg font-semibold text-gray-900">Vanyshr</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-8">
        <div className="space-y-10">
          {/* Headline */}
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-gray-900">
              We found {total} pieces of your data
            </h1>
            <p className="text-lg text-gray-600">
              This is what's publicly available about you on data broker sites.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            {stats.emails > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Mail className="h-6 w-6 text-gray-600" />
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{stats.emails}</p>
                    <p className="text-sm text-gray-600">Email{stats.emails !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
            )}

            {stats.phones > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Phone className="h-6 w-6 text-gray-600" />
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{stats.phones}</p>
                    <p className="text-sm text-gray-600">Phone{stats.phones !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
            )}

            {stats.addresses > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <MapPin className="h-6 w-6 text-gray-600" />
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{stats.addresses}</p>
                    <p className="text-sm text-gray-600">Address{stats.addresses !== 1 ? "es" : ""}</p>
                  </div>
                </div>
              </div>
            )}

            {stats.relatives > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Users className="h-6 w-6 text-gray-600" />
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{stats.relatives}</p>
                    <p className="text-sm text-gray-600">Relative{stats.relatives !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CTA card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <div className="space-y-3">
              <p className="font-medium text-blue-900">Want to remove this?</p>
              <p className="text-sm text-blue-800">
                We can automatically request removal from all these sites.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => navigate("/simple/scan/validate")}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            See full details
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
