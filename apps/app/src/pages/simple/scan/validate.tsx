import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Shield, Check, ChevronRight } from "lucide-react";
import {
  loadConsolidatedProfile,
  toProperCase,
  formatPhone,
  parseFullAddress,
  type ConsolidatedProfile,
} from "@/pages/pilot-scan/consolidated-profile";

/**
 * Simple scan validate — let user review and approve scraped data.
 * Shows sections one at a time: contact, emails, phones, addresses, relatives.
 * Minimal, conversational. Not a dense table.
 */
export function SimpleScanValidate() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ConsolidatedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = loadConsolidatedProfile();
    if (data.data) {
      setProfile(data.data);
    } else {
      navigate("/simple/scan");
    }
    setLoading(false);
  }, [navigate]);

  const sections = useMemo(() => {
    if (!profile) return [];

    const result: Array<{ id: string; title: string; items: string[] }> = [];

    // Contact info
    if (profile.full_name || profile.age || profile.primary_address) {
      const contactItems: string[] = [];
      if (profile.full_name) contactItems.push(profile.full_name);
      if (profile.age) contactItems.push(`${profile.age} years old`);
      if (profile.primary_address) {
        const addr = parseFullAddress(profile.primary_address);
        contactItems.push(`${addr.city}, ${addr.state}`);
      }
      result.push({ id: "contact", title: "About you", items: contactItems });
    }

    // Emails
    if (profile.emails && profile.emails.length > 0) {
      result.push({
        id: "emails",
        title: "Email addresses",
        items: profile.emails,
      });
    }

    // Phones
    if (profile.phones && profile.phones.length > 0) {
      result.push({
        id: "phones",
        title: "Phone numbers",
        items: profile.phones.map(formatPhone),
      });
    }

    // Addresses
    const addresses: string[] = [];
    if (profile.primary_address) {
      const addr = parseFullAddress(profile.primary_address);
      addresses.push(`${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`);
    }
    if (profile.previous_addresses) {
      profile.previous_addresses.forEach((a) => {
        const addr = parseFullAddress(a);
        addresses.push(`${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`);
      });
    }
    if (addresses.length > 0) {
      result.push({
        id: "addresses",
        title: "Addresses",
        items: addresses.slice(0, 5), // Limit to 5 for simplicity
      });
    }

    // Relatives
    if (profile.relatives && profile.relatives.length > 0) {
      result.push({
        id: "relatives",
        title: "Possible relatives",
        items: profile.relatives.slice(0, 5).map((r) => toProperCase(r.name)),
      });
    }

    return result;
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <button
            onClick={() => navigate("/simple/scan/reveal")}
            className="text-gray-500 hover:text-gray-900"
          >
            ← Back
          </button>
          <div className="flex flex-1 items-center justify-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Vanyshr</span>
          </div>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-8">
        <div className="space-y-8">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Does this look right?</h1>
            <p className="text-base text-gray-600">
              This is what we found. You can correct anything that's wrong.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-medium text-gray-900">{section.title}</h2>
                    <button className="text-sm text-blue-600 hover:text-blue-700">Edit</button>
                  </div>
                  <ul className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="h-4 w-4 flex-shrink-0 text-green-600 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Trust message */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-center text-sm text-blue-800">
              This data will be used to monitor for new exposures and request removals.
            </p>
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => navigate("/simple/scan/signup")}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Looks good
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
