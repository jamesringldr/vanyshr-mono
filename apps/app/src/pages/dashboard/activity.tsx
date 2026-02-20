import { useState } from 'react';
import { 
  Search,
  Filter,
  Bookmark,
  DollarSign,
  Building2,
  ChevronDown,
  User,
  CreditCard,
  Home,
  List,
  ArrowLeftRight
} from 'lucide-react';

interface Transaction {
  id: string;
  merchant: string;
  description: string;
  amount: number;
  status?: 'pending' | 'failed';
  date: string;
  icon?: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', merchant: 'Apple', description: 'james o. •••7442', amount: -30.98, status: 'pending', date: 'Today', icon: '🍎' },
  { id: '2', merchant: 'From Mercury Savings', description: 'Transfer In •••6188', amount: 10.00, date: 'Today' },
  { id: '3', merchant: 'To Mercury Checking', description: 'Transfer Out •••9729', amount: -10.00, date: 'Today' },
  { id: '4', merchant: 'Cash App', description: 'james o. •••1477', amount: 20.57, date: 'Today', icon: '💵' },
  { id: '5', merchant: 'Apple', description: 'james o. •••7442', amount: -30.98, status: 'failed', date: 'Today', icon: '🍎' },
  { id: '6', merchant: 'Apple', description: 'james o. •••7442', amount: -30.98, status: 'failed', date: 'Today', icon: '🍎' },
  { id: '7', merchant: 'Apple', description: 'james o. •••1477', amount: -30.98, status: 'failed', date: 'Today', icon: '🍎' },
  { id: '8', merchant: 'Apple', description: 'james o. •••7442', amount: -9.99, status: 'pending', date: 'Today', icon: '🍎' },
  { id: '9', merchant: 'Apple', description: 'james o. •••7442', amount: -30.98, status: 'failed', date: 'Today', icon: '🍎' },
  { id: '10', merchant: 'Apple', description: 'james o. •••7442', amount: -30.98, status: 'failed', date: 'Today', icon: '🍎' },
];

export const Transactions = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>('Views');
  const [selectedAccount] = useState('ringldr');
  const [showAccountSheet, setShowAccountSheet] = useState(false);

  const filters = [
    { id: 'Views', label: 'Views', icon: Bookmark },
    { id: 'Methods', label: '$ Methods', icon: DollarSign },
    { id: 'Amount', label: '<= Amount', icon: DollarSign },
    { id: 'Account', label: 'Account', icon: Building2 },
  ];

  const filteredTransactions = MOCK_TRANSACTIONS.filter((transaction) => {
    if (searchQuery) {
      return (
        transaction.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  const formatAmount = (amount: number) => {
    const formatted = Math.abs(amount).toFixed(2);
    return amount >= 0 ? `$${formatted}` : `-$${formatted}`;
  };

  const getStatusBadge = (status?: 'pending' | 'failed') => {
    if (!status) return null;

    if (status === 'pending') {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#F0F4F8] dark:bg-[#022136] text-[#B8C4CC] dark:text-[#B8C4CC]">
          Pending
        </span>
      );
    }

    if (status === 'failed') {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#FF5757]/10 text-[#FF5757]">
          Failed
        </span>
      );
    }

    return null;
  };

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

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="View options"
            className="w-10 h-10 rounded-lg bg-[#FFFFFF] dark:bg-[#2A2A3F] border border-[#D4DFE8] dark:border-[#2A4A68] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
          >
            <Filter className="w-5 h-5 text-[#022136] dark:text-white" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-24 space-y-4">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#022136] dark:text-white">
            Transactions
          </h1>
          <button
            type="button"
            aria-label="View options"
            className="w-10 h-10 rounded-lg bg-[#FFFFFF] dark:bg-[#2A2A3F] border border-[#D4DFE8] dark:border-[#2A4A68] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
          >
            <Filter className="w-5 h-5 text-[#022136] dark:text-white" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="search"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[52px] w-full rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] px-12 py-3 text-sm bg-[#F0F4F8]/50 dark:bg-[#022136]/50 text-[#022136] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#56687F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 transition-all"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] dark:text-[#56687F] pointer-events-none" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(isActive ? null : filter.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                  transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2
                  ${
                    isActive
                      ? 'bg-[#00BFFF] text-white'
                      : 'bg-[#FFFFFF] dark:bg-[#2A2A3F] border border-[#D4DFE8] dark:border-[#2A4A68] text-[#022136] dark:text-white'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Transactions List */}
        <div className="space-y-4">
          {/* Today Section */}
          <div>
            <h2 className="text-lg font-bold text-[#022136] dark:text-white mb-3">
              Today
            </h2>

            <div className="space-y-2">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between bg-[#FFFFFF] dark:bg-[#2A2A3F] rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] p-4"
                >
                  {/* Left: Icon + Details */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-full bg-[#F0F4F8] dark:bg-[#022136] flex items-center justify-center flex-shrink-0">
                      {transaction.icon ? (
                        <span className="text-lg">{transaction.icon}</span>
                      ) : (
                        <DollarSign className="w-5 h-5 text-[#00D4AA]" />
                      )}
                    </div>

                    {/* Merchant + Description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#022136] dark:text-white truncate">
                        {transaction.merchant}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-[#B8C4CC] dark:text-[#B8C4CC]">
                          {transaction.description}
                        </p>
                        {getStatusBadge(transaction.status)}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount */}
                  <div className="ml-4 flex-shrink-0">
                    <p
                      className={`text-sm font-medium ${
                        transaction.amount >= 0
                          ? 'text-[#00D4AA]'
                          : 'text-[#022136] dark:text-white'
                      }`}
                    >
                      {formatAmount(transaction.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
              className="relative flex items-center justify-center w-14 h-10 rounded-full transition-colors hover:bg-[#2A2A3F]/50 dark:hover:bg-[#2A2A3F]/50 focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
            >
              <Home className="w-6 h-6 text-white" />
            </button>
            <button
              type="button"
              aria-label="Transactions"
              className="relative flex items-center justify-center w-14 h-10 rounded-full bg-[#2A2A3F] dark:bg-[#2A2A3F] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2"
            >
              <List className="w-6 h-6 text-[#00BFFF]" />
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
