import { User, MapPin } from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";

export function QuickScan() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F0F4F8] dark:bg-[#022136] font-sans transition-colors duration-200">
      
      {/* Logo - Positioned above container and 50% larger (40px -> 60px) */}
      <div className="mb-8">
         <img 
            src={PrimaryLogo} 
            alt="Vanyshr Logo" 
            className="h-[60px] w-auto dark:hidden block"
         />
         <img 
            src={PrimaryLogoDark} 
            alt="Vanyshr Logo" 
            className="h-[60px] w-auto hidden dark:block" 
         />
      </div>

      {/* Container - Untitled UI style centering */}
      <div className="w-full max-w-md bg-white dark:bg-[#0F2D45] rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] shadow-lg overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="p-6 md:p-8 space-y-4 text-center">
            
          <h1 className="text-2xl md:text-3xl font-bold text-[#022136] dark:text-white tracking-tight">
            See what brokers know about you
          </h1>
          <p className="text-[#476B84] dark:text-[#A8BFD4] text-sm md:text-base leading-relaxed">
            Enter your details to instantly scan top data brokers for your personal information. It's free and takes seconds.
          </p>
        </div>

        {/* Form */}
        <div className="p-6 md:p-8 pt-0">
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            
            {/* First Name */}
            <div className="space-y-1.5">
              <label htmlFor="firstName" className="block text-sm font-medium text-[#022136] dark:text-white">
                First Name
              </label>
              <div className="relative">
                <input
                  id="firstName"
                  type="text"
                  placeholder="First name"
                  className="h-[52px] w-full rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] px-12 py-3 text-sm bg-[#F0F4F8]/50 dark:bg-[#022136]/50 text-[#022136] dark:text-white placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] pointer-events-none" />
              </div>
            </div>

            {/* Last Name */}
             <div className="space-y-1.5">
              <label htmlFor="lastName" className="block text-sm font-medium text-[#022136] dark:text-white">
                Last Name
              </label>
              <div className="relative">
                <input
                  id="lastName"
                  type="text"
                  placeholder="Last name"
                  className="h-[52px] w-full rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] px-12 py-3 text-sm bg-[#F0F4F8]/50 dark:bg-[#022136]/50 text-[#022136] dark:text-white placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] pointer-events-none" />
              </div>
            </div>

            {/* Zip Code */}
             <div className="space-y-1.5">
              <label htmlFor="zipCode" className="block text-sm font-medium text-[#022136] dark:text-white">
                Zip Code
              </label>
              <div className="relative">
                <input
                  id="zipCode"
                  type="text"
                  placeholder="12345"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  className="h-[52px] w-full rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] px-12 py-3 text-sm bg-[#F0F4F8]/50 dark:bg-[#022136]/50 text-[#022136] dark:text-white placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                />
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] pointer-events-none" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full h-[52px] bg-[#14ABFE] hover:bg-[#1196E0] text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#14ABFE] mt-2 active:scale-[0.98]"
            >
              Scan Now
            </button>

            {/* Trust/Disclaimer */}
            <p className="text-xs text-center text-[#94A3B8] mt-4">
               By clicking "Scan Now", you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
