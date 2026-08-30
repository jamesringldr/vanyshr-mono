import { useNavigate } from "react-router";
import { Shield, ArrowLeft } from "lucide-react";

export function SimpleScan() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <button
            onClick={() => navigate("/simple/home")}
            className="text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
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
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Run a new scan</h1>
            <p className="text-base text-gray-600">
              We'll search all data broker sites to find new exposures.
            </p>
          </div>

          <button className="w-full rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
            <p className="font-medium text-blue-900">Start scan</p>
            <p className="mt-1 text-sm text-blue-700">Takes about 3 minutes</p>
          </button>
        </div>
      </main>
    </div>
  );
}
