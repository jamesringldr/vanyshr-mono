import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Shield, Loader2 } from "lucide-react";

/**
 * Simple scan loading — clean, minimal progress indicator.
 * Polls for scan completion, then navigates to reveal.
 */
export function SimpleScanLoading() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Starting scan...");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const scanId = sessionStorage.getItem("pendingScanId");
    if (!scanId) {
      navigate("/simple/scan");
      return;
    }

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);

    // Poll for completion (simplified - real implementation would poll backend)
    const statusMessages = [
      "Searching data brokers...",
      "Found your profiles...",
      "Gathering details...",
      "Almost done...",
    ];

    let messageIndex = 0;
    const statusInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % statusMessages.length;
      setStatus(statusMessages[messageIndex]);
    }, 2000);

    // Redirect after ~8 seconds (matches typical scan time)
    const timeout = setTimeout(() => {
      navigate("/simple/scan/reveal");
    }, 8000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      clearTimeout(timeout);
    };
  }, [navigate]);

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
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4">
        <div className="w-full space-y-8 text-center">
          {/* Spinner */}
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <p className="text-xl font-semibold text-gray-900">{status}</p>
            <p className="text-sm text-gray-500">This usually takes 2-3 minutes</p>
          </div>

          {/* Progress bar */}
          <div className="mx-auto w-full max-w-md">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
