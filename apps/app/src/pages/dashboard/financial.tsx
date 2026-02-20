import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Info, 
  TrendingUp, 
  TrendingDown,
  Bookmark,
  Building2,
  CreditCard,
  User,
  Home,
  List,
  ArrowLeftRight
} from 'lucide-react';

interface Card {
  id: string;
  name: string;
  maskedNumber: string;
  type: 'Physical Debit' | 'Virtual Debit';
}

const MOCK_CARDS: Card[] = [
  { id: '1', name: "james's Debit Card", maskedNumber: '..1477', type: 'Physical Debit' },
  { id: '2', name: 'Domains', maskedNumber: '..1477', type: 'Virtual Debit' },
  { id: '3', name: 'Apple Wallet', maskedNumber: '..1477', type: 'Virtual Debit' },
];


export const FinancialDashboard = () => {
  const [timePeriod, setTimePeriod] = useState<'7D' | '30D' | '90D' | '1Y'>('7D');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [selectedAccount] = useState('ringldr');
  const [showAccountSheet, setShowAccountSheet] = useState(false);

  const balance = 140.13;
  const moneyIn = 214.47;
  const moneySpent = 86.43;

  // Mock graph data points
  const graphPoints = [80, 70, 60, 40, 30, 35, 40];

  return (
    <div className="min-h-screen bg-[#F0F4F8] dark:bg-[#022136]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#F0F4F8] dark:bg-[#022136]">
        {/* Left: Account Switcher */}
        <button
          type="button"
          onClick={() => setShowAccountSheet(true)}
          aria-label={`Switch account, current: ${selectedAccount}`}
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2 rounded-lg transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-[#2A2A3F] dark:bg-[#2A2A3F] flex items-center justify-center">
            <span className="text-sm font-semibold text-white">R</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-[#022136] dark:text-white">
              {selectedAccount}
            </span>
            <ChevronDown className="w-4 h-4 text-[#B8C4CC] dark:text-[#B8C4CC]" />
          </div>
        </button>

        {/* Right: User Avatar */}
        <button
          type="button"
          aria-label="User settings"
          className="w-10 h-10 rounded-full bg-[#00BFFF]/20 dark:bg-[#00BFFF]/20 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2 transition-colors hover:bg-[#00BFFF]/30"
        >
          <span className="text-sm font-semibold text-[#00BFFF]">JO</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-24 space-y-6">
        {/* Balance Section */}
        <div className="bg-[#FFFFFF] dark:bg-[#2A2A3F] rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] p-6 space-y-4">
          {/* Balance Header */}
          <div className="flex items-center gap-1">
            <h2 className="text-sm font-medium text-[#B8C4CC] dark:text-[#B8C4CC]">
              Mercury balance
            </h2>
            <button
              type="button"
              aria-label="Learn more about balance"
              className="text-[#94A3B8] dark:text-[#56687F] hover:text-[#B8C4CC] dark:hover:text-[#B8C4CC] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] rounded"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* Balance Amount */}
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-[#022136] dark:text-white">
              ${balance.toFixed(2).split('.')[0]}
            </span>
            <span className="text-2xl font-bold text-[#022136] dark:text-white">
              .{balance.toFixed(2).split('.')[1]}
            </span>
          </div>

          {/* Period Selector & Stats */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Period Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#F0F4F8] dark:bg-[#022136] text-sm font-medium text-[#022136] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
              >
                {timePeriod}
                <ChevronDown className="w-4 h-4" />
              </button>

              {showPeriodDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-[#FFFFFF] dark:bg-[#2A2A3F] border border-[#D4DFE8] dark:border-[#2A4A68] rounded-lg shadow-lg z-10 min-w-[120px]">
                  {(['7D', '30D', '90D', '1Y'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        setTimePeriod(period);
                        setShowPeriodDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F0F4F8] dark:hover:bg-[#022136] first:rounded-t-lg last:rounded-b-lg focus:outline-none focus:ring-2 focus:ring-[#00BFFF] ${
                        timePeriod === period
                          ? 'text-[#00BFFF] font-medium'
                          : 'text-[#022136] dark:text-white'
                      }`}
                    >
                      {period === '1Y' ? 'Last Year' : `Last ${period}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Money In */}
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-[#00D4AA]" />
              <span className="text-sm font-medium text-[#00D4AA]">
                ${moneyIn.toFixed(2)}
              </span>
            </div>

            {/* Money Spent */}
            <div className="flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-[#FF5757]" />
              <span className="text-sm font-medium text-[#FF5757]">
                ${Math.abs(moneySpent).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Trend Graph */}
          <div className="h-32 relative overflow-hidden rounded-lg">
            <svg
              viewBox="0 0 400 100"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00BFFF" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00BFFF" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Area fill */}
              <path
                d={`M0,${100 - graphPoints[0]} ${graphPoints.map((point, i) => `L${(i * 400) / (graphPoints.length - 1)},${100 - point}`).join(' ')} L400,100 L0,100 Z`}
                fill="url(#chartGradient)"
              />
              {/* Line */}
              <path
                d={`M0,${100 - graphPoints[0]} ${graphPoints.map((point, i) => `L${(i * 400) / (graphPoints.length - 1)},${100 - point}`).join(' ')}`}
                fill="none"
                stroke="#00BFFF"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* January 2026 Summary */}
        <div className="bg-[#FFFFFF] dark:bg-[#2A2A3F] rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#022136] dark:text-white">
              January 2026
            </h3>
            <ChevronRight className="w-5 h-5 text-[#B8C4CC] dark:text-[#B8C4CC]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Money In */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-4 h-4 text-[#00D4AA]" />
                <span className="text-sm text-[#B8C4CC] dark:text-[#B8C4CC]">Money in</span>
              </div>
              <p className="text-xl font-semibold text-[#00D4AA]">
                ${moneyIn.toFixed(2)}
              </p>
            </div>

            {/* Money Spent */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <TrendingDown className="w-4 h-4 text-[#FF5757]" />
                <span className="text-sm text-[#B8C4CC] dark:text-[#B8C4CC]">Money spent</span>
              </div>
              <p className="text-xl font-semibold text-[#FF5757]">
                ${Math.abs(moneySpent).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Cards Section */}
        <div className="bg-[#FFFFFF] dark:bg-[#2A2A3F] rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#022136] dark:text-white">
              Cards
            </h3>
            <ChevronRight className="w-5 h-5 text-[#B8C4CC] dark:text-[#B8C4CC]" />
          </div>

          <div className="space-y-3">
            {MOCK_CARDS.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#F0F4F8]/50 dark:hover:bg-[#022136]/50 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-[#F0F4F8] dark:bg-[#022136] flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#B8C4CC] dark:text-[#B8C4CC]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#022136] dark:text-white">
                    {card.name}
                  </p>
                  <p className="text-xs text-[#B8C4CC] dark:text-[#B8C4CC]">
                    {card.maskedNumber} • {card.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-[#F0F4F8] dark:from-[#022136] to-transparent"
        aria-label="Main navigation"
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-around bg-[#FFFFFF] dark:bg-[#2A2A3F] rounded-full px-4 py-2 border border-[#D4DFE8] dark:border-[#2A4A68]">
            <button
              type="button"
              aria-label="Home"
              className="relative flex items-center justify-center w-14 h-10 rounded-full bg-[#2A2A3F] dark:bg-[#2A2A3F] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
            >
              <Home className="w-6 h-6 text-[#00BFFF]" />
            </button>
            <button
              type="button"
              aria-label="Transactions"
              className="relative flex items-center justify-center w-14 h-10 rounded-full transition-colors hover:bg-[#2A2A3F]/50 dark:hover:bg-[#2A2A3F]/50 focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
            >
              <List className="w-6 h-6 text-white" />
            </button>
            <button
              type="button"
              aria-label="Transfer"
              className="relative flex items-center justify-center w-14 h-10 rounded-full transition-colors hover:bg-[#2A2A3F]/50 dark:hover:bg-[#2A2A3F]/50 focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
            >
              <ArrowLeftRight className="w-6 h-6 text-white" />
            </button>
            <button
              type="button"
              aria-label="Account"
              className="relative flex items-center justify-center w-14 h-10 rounded-full transition-colors hover:bg-[#2A2A3F]/50 dark:hover:bg-[#2A2A3F]/50 focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
            >
              <Building2 className="w-6 h-6 text-white" />
            </button>
            <button
              type="button"
              aria-label="Card"
              className="relative flex items-center justify-center w-14 h-10 rounded-full transition-colors hover:bg-[#2A2A3F]/50 dark:hover:bg-[#2A2A3F]/50 focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
            >
              <CreditCard className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </nav>

      {/* Account Switch Bottom Sheet */}
      {showAccountSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close account menu"
            className="absolute inset-0 bg-[#022136]/40 dark:bg-black/50"
            onClick={() => setShowAccountSheet(false)}
          />

          {/* Sheet */}
          <div className="relative w-full bg-[#FFFFFF] dark:bg-[#2A2A3F] border-t border-[#D4DFE8] dark:border-[#2A4A68] rounded-t-2xl p-4 shadow-lg max-w-lg mx-auto">
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#B8C4CC] dark:bg-[#B8C4CC]" />
            </div>

            {/* Account Name */}
            <div className="px-4 pb-2">
              <h2 className="text-lg font-bold text-[#022136] dark:text-white">
                {selectedAccount}
              </h2>
            </div>

            {/* Menu Items */}
            <div className="px-2 pb-2 space-y-1">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-[#F0F4F8]/50 dark:hover:bg-[#022136]/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-[#94A3B8] dark:text-[#56687F]" />
                  <span className="text-sm font-medium text-[#022136] dark:text-white">
                    Company profile
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-[#F0F4F8]/50 dark:hover:bg-[#022136]/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-[#94A3B8] dark:text-[#56687F]" />
                  <span className="text-sm font-medium text-[#022136] dark:text-white">
                    Team
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-[#F0F4F8]/50 dark:hover:bg-[#022136]/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-[#94A3B8] dark:text-[#56687F]" />
                  <span className="text-sm font-medium text-[#022136] dark:text-white">
                    Documents
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-[#F0F4F8]/50 dark:hover:bg-[#022136]/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
              >
                <div className="flex items-center gap-3">
                  <Bookmark className="w-5 h-5 text-[#94A3B8] dark:text-[#56687F]" />
                  <span className="text-sm font-medium text-[#022136] dark:text-white">
                    Plans
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#2A2A3F] dark:bg-[#2A2A3F] text-xs font-medium text-white">
                  Mercury
                </span>
              </button>
            </div>

            {/* Separator */}
            <div className="mx-4 my-2 border-t border-[#D4DFE8] dark:border-[#2A4A68]" />

            {/* Switch Accounts Section */}
            <div className="px-4 pt-2 pb-2">
              <h3 className="text-sm font-semibold text-[#B8C4CC] dark:text-[#B8C4CC]">
                Switch accounts
              </h3>
            </div>

            {/* Add Account */}
            <div className="px-2 pb-6">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#F0F4F8]/50 dark:hover:bg-[#022136]/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
              >
                <div className="w-8 h-8 rounded-lg border-2 border-dashed border-[#00BFFF] flex items-center justify-center">
                  <span className="text-[#00BFFF] text-lg">+</span>
                </div>
                <span className="text-sm font-medium text-[#00BFFF]">
                  Link an existing account
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
