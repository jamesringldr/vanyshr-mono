'use client';

import React from 'react';
import { motion } from 'framer-motion';

// Assets
import vanyshrLogo from "../../../../shared/assets/LogoFiles/PrimaryIcon-outline.png";

const notifications = [
  {
    id: 1,
    title: 'Vanyshr Removed a Broker!',
    detail: 'Data Removal Request Confirmed',
    time: '24m ago',
  },
  {
    id: 2,
    title: 'New Exposure Found!',
    detail: 'Privacy Alert: Database Leak',
    time: '1h ago',
  },
  {
    id: 3,
    title: 'Vanyshr Full Scan Completed',
    detail: 'No New Risks Detected',
    time: '3h ago',
  },
  {
    id: 4,
    title: 'Password Found On Dark Web!',
    detail: 'Critical: Update Credentials',
    time: '5h ago',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { 
    opacity: 0, 
    y: 40,
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20
    }
  },
};

export const RemovalsMockup: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-6 font-sans relative">
      {/* Sleek Midnight iPhone Frame */}
      <div className="relative w-[340px] h-[720px] rounded-[50px] border-[12px] border-black shadow-2xl overflow-hidden ring-1 ring-white/10">
        
        {/* Ambient background orbs */}
        <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[60%] bg-[#14abfe]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] right-[-10%] w-[100%] h-[40%] bg-indigo-500/5 blur-[100px] rounded-full" />

        {/* Lock Screen Header */}
        <div className="absolute top-16 inset-x-0 text-center z-20">
          <div className="flex justify-center mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 mx-1" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 mx-1" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 mx-1" />
          </div>
          <h1 className="text-7xl font-light text-white mb-1 tracking-tight">11:14</h1>
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
          {notifications.map((notif, index) => {
            const widths = ['w-[310px]', 'w-[360px]', 'w-[390px]', 'w-[420px]', 'w-[440px]'];
            const widthClass = widths[index] || 'w-[440px]';
            
            return (
              <motion.div
                key={notif.id}
                variants={itemVariants}
                className={`${widthClass} p-4 rounded-[28px] bg-white backdrop-blur-3xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-[#001D3D] flex items-center justify-center shrink-0 overflow-hidden p-2.5">
                    <img 
                      src={vanyshrLogo} 
                      alt="Vanyshr" 
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-[17px] font-bold text-neutral-900 truncate tracking-tight">{notif.title}</h3>
                    <p className="text-[13px] text-neutral-500 font-medium">{notif.detail}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                   <div className="text-[13px] text-neutral-400 font-semibold tracking-tight">
                     {notif.time}
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
