import { motion } from 'motion/react';
import type { Variants } from 'motion/react';

// Brand icons
import chaseIcon from "../../assets/chase_icon.png";
import coinbaseIcon from "../../assets/coinbase_icon.png";
import netflixIcon from "../../assets/netflix_icon.png";

const notifications = [
  { id: 1, title: 'Chase Bank', detail: 'Suspicious Activity Detected. Your account has been locked. Verify here: bit.ly/chase-secure', type: 'brand', icon: chaseIcon, bgColor: 'bg-[#004481]', time: '11:12 AM' },
  { id: 2, title: 'Coinbase', detail: 'Security Alert: New login from Unknown Device (Moscow, Russia). If this wasn\'t you, tap to secure.', type: 'brand', icon: coinbaseIcon, bgColor: 'bg-[#0052ff]', time: '10:45 AM' },
  { id: 3, title: 'Netflix', detail: 'Failed Login Attempt: Someone just tried to sign in to your account from a new location. Secure your account.', type: 'brand', icon: netflixIcon, bgColor: 'bg-black', time: '9:58 AM' },
  { id: 4, title: 'Text Message', detail: 'Package Delivery Failed: Your item [ID: 8291] requires a $2 re-delivery fee. Update at: postal-portal.com', type: 'spam', time: '9:15 AM' },
  { id: 5, title: 'Geek Squad', detail: 'PAYMENT NOTICE: $499.99 will be debited from your account. Call +1 (888) 123-4567 to cancel.', type: 'spam', time: '8:42 AM' },
];

export const ScamMockup = () => {
  // Parent variant to control the staggering of the list
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15, // Delays each child animation for the "stacking" effect
        delayChildren: 0.3,
      },
    },
  };

  // Child variant with the requested spring transition
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 80, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 20,
      },
    },
  };

  return (
    <div className="flex items-center justify-center p-6 font-sans relative">
      {/* Sleek Midnight iPhone Frame */}
      <div className="relative w-[340px] h-[720px] rounded-[50px] border-[12px] border-black shadow-2xl overflow-hidden ring-1 ring-white/10">
        
        {/* Ambient background orbs for color */}
        <div className="absolute top-24 left-[-20px] w-48 h-48 bg-[#14abfe]/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-32 right-[-20px] w-56 h-56 bg-emerald-600/20 rounded-full blur-3xl"></div>

        {/* Dynamic Island / Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-20 flex items-center justify-end px-2">
           <div className="w-2 h-2 bg-green-500/80 rounded-full"></div> {/* Camera indicator */}
        </div>

        {/* Status Bar */}
        <div className="absolute top-0 inset-x-0 px-6 pt-4 flex justify-between text-white/90 text-[12px] font-semibold z-10 tracking-wider">
          <span>11:14</span>
          <div className="flex gap-2 items-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21L23.6 7.4C23.1 7 18.6 3 12 3C5.4 3 0.9 7 0.4 7.4L12 21Z"/></svg>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2 22H22V2L2 22Z"/></svg>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 4H3C1.9 4 1 4.9 1 6V18C1 19.1 1.9 20 3 20H17C18.1 20 19 19.1 19 18V6C19 4.9 18.1 4 17 4ZM23 16V8L19 11V13L23 16Z"/></svg>
          </div>
        </div>

        {/* App Header / Lock Screen Clock */}
        <div className="mt-16 px-6 text-center z-10 relative">
          <h1 className="text-[72px] font-medium text-white tracking-tight leading-none mb-2">11:14</h1>
          <p className="text-lg text-neutral-200 font-medium">Saturday, Sept 12th</p>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/20 rounded-full"></div>
      </div>

      {/* Notifications Layer - Outside overflow-hidden for true overflow effect */}
      <div className="absolute inset-x-0 inset-y-0 flex flex-col items-center pointer-events-none z-50">
        <motion.div
          className="mt-[200px] flex flex-col-reverse gap-4 pointer-events-auto items-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {[...notifications].reverse().map((notif, index) => {
            const widths = ['w-[310px]', 'w-[360px]', 'w-[390px]', 'w-[420px]', 'w-[440px]'];
            const widthClass = widths[index] || 'w-[440px]';

            return (
              <motion.div
                key={notif.id}
                variants={itemVariants}
                className={`${widthClass} p-4 rounded-[28px] bg-white backdrop-blur-3xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${
                      notif.type === 'brand' ? (notif.bgColor || 'bg-white/5') : 'bg-orange-100 text-orange-600'
                    }`}
                  >
                    {notif.type === 'brand' ? (
                      <img src={notif.icon} alt={notif.title} className="w-full h-full object-cover p-2" />
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-[17px] font-bold text-neutral-900 truncate tracking-tight">{notif.title}</h3>
                    <p className="text-[13px] text-neutral-500 font-medium line-clamp-1">{notif.detail}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                   <div className="text-[13px] text-neutral-400 font-semibold tracking-tight">
                     {['12m ago', '45m ago', '2h ago', '4h ago', '1d ago'][index] || 'Now'}
                   </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

export default ScamMockup;
