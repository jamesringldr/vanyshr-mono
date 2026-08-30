import { useNavigate } from "react-router";
import { Shield, ArrowLeft } from "lucide-react";

export function SimpleStatus() {
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
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Your protection status</h1>
            <p className="text-base text-gray-600">Here's what we're doing for you.</p>
          </div>

          {/* Status cards */}
          <div className="space-y-4">
            {/* Monitoring */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="font-medium text-gray-900">Monitoring active</span>
                  </div>
                  <span className="text-sm text-gray-500">24/7</span>
                </div>
                <p className="text-sm text-gray-600">
                  We're continuously scanning for new exposures across data broker sites.
                </p>
              </div>
            </div>

            {/* Scan progress */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Latest scan</span>
                  <span className="text-sm text-gray-500">2 hours ago</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sites scanned</span>
                    <span className="font-medium text-gray-900">253 / 253</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full w-full bg-blue-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Removal progress */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="space-y-3">
                <span className="font-medium text-gray-900">Removal requests</span>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">In progress</span>
                    <span className="font-medium text-gray-900">12</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Confirmed</span>
                    <span className="font-medium text-green-600">31</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
