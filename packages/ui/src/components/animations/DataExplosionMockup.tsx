import { motion } from 'motion/react';
import { 
  Phone, 
  Mail, 
  Users, 
  Briefcase, 
  MapPin, 
  CreditCard, 
  Building2, 
  CalendarDays 
} from 'lucide-react';

const dataPoints = [
  { id: 1, icon: Phone, color: 'bg-blue-400', label: 'Phone Number', top: '15%', left: '5%' },
  { id: 2, icon: Mail, color: 'bg-indigo-400', label: 'Email', top: '8%', right: '8%' },
  { id: 3, icon: Users, color: 'bg-purple-400', label: 'Family', top: '42%', left: '2%' },
  { id: 4, icon: Briefcase, color: 'bg-amber-400', label: 'Employers', top: '22%', right: '-3%' },
  { id: 6, icon: MapPin, color: 'bg-rose-400', label: 'Addresses', top: '32%', left: '-8%' },
  { id: 7, icon: CreditCard, color: 'bg-cyan-400', label: 'Credit Card', top: '38%', right: '2%' },
  { id: 8, icon: Building2, color: 'bg-slate-400', label: 'Bank', top: '25%', left: '38%' },
  { id: 9, icon: CalendarDays, color: 'bg-orange-400', label: 'DOB', top: '5%', left: '10%' },
];

export const DataExplosionMockup = () => {
  return (
    <div className="flex items-center justify-center p-12 font-sans overflow-hidden">
      {/* Container for everything to allow overflow outside phone */}
      <div className="relative">
        
        {/* Floating Icons - Positioned relative to the phone center */}
        {dataPoints.map((point, index) => (
          <motion.div
            key={point.id}
            initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              y: [0, -10, 0], // Gentle floating
            }}
            transition={{
              scale: { type: 'spring', stiffness: 100, delay: index * 0.1 },
              opacity: { duration: 0.5, delay: index * 0.1 },
              y: {
                duration: 3 + index,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
            className={`absolute z-30 w-16 h-16 rounded-full ${point.color} shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center border-4 border-white/20 backdrop-blur-sm`}
            style={{
              top: point.top,
              left: point.left,
              right: point.right,
            }}
          >
            <point.icon className="w-8 h-8 text-white" />
            
            {/* Subtle external glow */}
            <div className={`absolute inset-0 rounded-full ${point.color} opacity-20 blur-xl animate-pulse`}></div>
          </motion.div>
        ))}

        {/* Sleek Midnight iPhone Frame */}
        <div className="relative w-[340px] h-[720px] rounded-[50px] border-[12px] border-black shadow-2xl overflow-hidden ring-1 ring-white/10 z-10">
          
          {/* Ambient background orbs */}
          <div className="absolute top-24 left-[-20px] w-48 h-48 bg-[#14abfe]/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-32 right-[-20px] w-56 h-56 bg-emerald-600/10 rounded-full blur-3xl"></div>

          {/* Dynamic Island / Notch */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-20 flex items-center justify-end px-2">
             <div className="w-2 h-2 bg-green-500/80 rounded-full"></div>
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

          {/* Blurred "Mock Content" background */}
          <div className="mt-24 px-8 text-center opacity-20 blur-sm">
            <div className="w-full h-48 bg-white/10 rounded-3xl mb-6"></div>
            <div className="h-6 w-3/4 bg-white/10 rounded-full mx-auto mb-3"></div>
            <div className="h-4 w-1/2 bg-white/10 rounded-full mx-auto"></div>
            
            <div className="mt-12 flex flex-col gap-4">
               {[1,2,3].map(i => (
                 <div key={i} className="h-16 w-full bg-white/10 rounded-2xl"></div>
               ))}
            </div>
          </div>

          {/* Vanyshr Branding subtle */}
          <div className="absolute bottom-10 inset-x-0 text-center opacity-30">
             <p className="text-white font-bold tracking-widest text-sm italic">VANYSHTR</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataExplosionMockup;
