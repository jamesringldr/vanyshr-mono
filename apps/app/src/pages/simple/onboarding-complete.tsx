import { useNavigate } from "react-router";
import { Shield, Check } from "lucide-react";
import { cx } from "@/utils/cx";

export function SimpleOnboardingComplete() {
  const navigate = useNavigate();

  async function handleContinue() {
    // Could trigger a scan here or just navigate to home
    navigate("/simple/home");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
            <Shield className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Vanyshr</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 pb-32 pt-8">
        <div className="w-full space-y-8 text-center">
          {/* Success icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
            <Check className="h-10 w-10 text-green-600" />
          </div>

          {/* Message */}
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold text-gray-900">You're all set</h1>
            <p className="text-lg text-gray-600">
              We'll start scanning for your data right away. You'll get a notification when we find
              something.
            </p>
          </div>

          {/* What happens next */}
          <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">
            <p className="font-medium text-gray-900">What happens next</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>We'll scan hundreds of data broker sites</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>We'll submit removal requests automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>You'll see updates on your home screen</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={handleContinue}
            className={cx(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700",
            )}
          >
            Go to home
          </button>
        </div>
      </div>
    </div>
  );
}
