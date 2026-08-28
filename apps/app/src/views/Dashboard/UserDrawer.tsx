import { ChevronRight, User, Bell, Shield, Layers, Plus, LogOut } from 'lucide-react';

interface UserDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserDrawer({ isOpen, onClose }: UserDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#2D3847] rounded-t-3xl px-4 pt-3 pb-10 max-h-[85vh] overflow-y-auto flex flex-col gap-4 font-ubuntu"
        role="dialog"
        aria-modal="true"
        aria-label="User profile"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-[#2A4A68] rounded-full mx-auto mb-2" />

        {/* ── Section 1 — User Identity ─────────────────────────────────── */}
        <div className="px-2 py-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
            <span className="text-[#00BFFF] text-sm font-bold">JD</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-white font-ubuntu">James Davidson</span>
            <span className="text-xs text-[#7A92A8] font-ubuntu">james@example.com</span>
          </div>
        </div>

        {/* ── Section 2 — Menu Items ────────────────────────────────────── */}
        <div className="bg-[#1E2E3D] rounded-2xl overflow-hidden border border-[#2A4A68]">

          {/* Row 1 — User Profile */}
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#2A4A68]/40 transition-colors duration-100"
            onClick={() => console.log('navigate to: User Profile')}
          >
            <div className="w-8 h-8 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-[#00BFFF]" />
            </div>
            <span className="flex-1 text-sm font-medium text-white font-ubuntu">User Profile</span>
            <ChevronRight className="w-4 h-4 text-[#7A92A8]" />
          </button>

          <div className="h-px bg-[#2A4A68] mx-4" />

          {/* Row 2 — Notification Settings */}
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#2A4A68]/40 transition-colors duration-100"
            onClick={() => console.log('navigate to: Notification Settings')}
          >
            <div className="w-8 h-8 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-[#00BFFF]" />
            </div>
            <span className="flex-1 text-sm font-medium text-white font-ubuntu">Notification Settings</span>
            <ChevronRight className="w-4 h-4 text-[#7A92A8]" />
          </button>

          <div className="h-px bg-[#2A4A68] mx-4" />

          {/* Row 3 — Removal Settings */}
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#2A4A68]/40 transition-colors duration-100"
            onClick={() => console.log('navigate to: Removal Settings')}
          >
            <div className="w-8 h-8 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-[#00BFFF]" />
            </div>
            <span className="flex-1 text-sm font-medium text-white font-ubuntu">Removal Settings</span>
            <ChevronRight className="w-4 h-4 text-[#7A92A8]" />
          </button>

          <div className="h-px bg-[#2A4A68] mx-4" />

          {/* Row 4 — Plans */}
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#2A4A68]/40 transition-colors duration-100"
            onClick={() => console.log('navigate to: Plans')}
          >
            <div className="w-8 h-8 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4 text-[#00BFFF]" />
            </div>
            <span className="flex-1 text-sm font-medium text-white font-ubuntu">Plans</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="bg-[#00BFFF] text-[#022136] text-[10px] font-bold px-2 py-0.5 rounded-full">
                Pro
              </span>
              <ChevronRight className="w-4 h-4 text-[#7A92A8]" />
            </div>
          </button>

        </div>

        {/* ── Section 3 — Family Members ────────────────────────────────── */}
        <div>
          <div className="px-1 mb-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-white font-ubuntu">Family Members</span>
            <span className="text-xs italic text-[#7A92A8] font-ubuntu">Coming Soon</span>
          </div>

          <div className="bg-[#1E2E3D] rounded-2xl overflow-hidden border border-[#2A4A68]">
            <div className="flex items-center gap-3 px-4 py-3.5 opacity-40 cursor-not-allowed pointer-events-none">
              <div className="w-8 h-8 rounded-lg bg-[#022136] border border-[#2A4A68] flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-[#4A5568]" />
              </div>
              <span className="flex-1 text-sm font-medium text-[#4A5568] font-ubuntu">Add Family Member</span>
              <ChevronRight className="w-4 h-4 text-[#4A5568]" />
            </div>
          </div>
        </div>

        {/* ── Sign Out ──────────────────────────────────────────────────── */}
        <div className="bg-[#1E2E3D] rounded-2xl overflow-hidden border border-[#2A4A68]">
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#2A4A68]/40 transition-colors duration-100"
            onClick={() => console.log('sign out')}
          >
            <div className="w-8 h-8 rounded-lg bg-[#FF5757]/10 border border-[#FF5757]/20 flex items-center justify-center flex-shrink-0">
              <LogOut className="w-4 h-4 text-[#FF5757]" />
            </div>
            <span className="text-sm font-medium text-[#FF5757] font-ubuntu">Sign Out</span>
          </button>
        </div>

      </div>
    </>
  );
}
