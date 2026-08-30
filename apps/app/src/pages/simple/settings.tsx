import { useNavigate } from "react-router";
import { Shield, ArrowLeft } from "lucide-react";

export function SimpleSettings() {
  const navigate = useNavigate();

  async function handleLogout() {
    // Log out logic here if needed
    navigate("/login");
  }

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
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

          <div className="space-y-4">
            <button
              onClick={() => navigate("/simple/profile")}
              className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">Edit profile</span>
            </button>

            <button
              onClick={() => navigate("/simple/notifications")}
              className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">Notifications</span>
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">Switch to detailed view</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full rounded-2xl border border-red-200 bg-white p-4 text-left transition-all hover:border-red-300 hover:bg-red-50"
            >
              <span className="text-sm font-medium text-red-600">Log out</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
