import { useNavigate } from "react-router";
import { Shield, ArrowLeft } from "lucide-react";

export function SimpleRemovals() {
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
            <h1 className="text-2xl font-semibold text-gray-900">Removal requests</h1>
            <p className="text-base text-gray-600">
              We're working to remove your data from these sites.
            </p>
          </div>

          {/* Placeholder for removal cards */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">Spokeo</p>
                    <p className="text-sm text-gray-600">Submitted 2 days ago</p>
                  </div>
                  <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                    In progress
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">Whitepages</p>
                    <p className="text-sm text-gray-600">Confirmed 1 week ago</p>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    Complete
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
