import { motion } from "framer-motion";
import { cx } from "@/utils/cx";

export interface EducationalCardsProps {
  onCardClick?: (cardId: "brokers" | "risks") => void;
}

const EASE_OUT = [0.2, 0, 0, 1] as const;

export function EducationalCards({ onCardClick }: EducationalCardsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.2 }}
      className="w-full max-w-sm px-6 py-8"
    >
      {/* Headline */}
      <div className="mb-8 text-center">
        <h2 className="text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
          Learn about how your data gets exposed and the risks...
        </h2>
      </div>

      {/* Cards Container */}
      <div className="flex flex-col gap-4">
        {/* Card 1: How Data Brokers Get Your Data */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onCardClick?.("brokers")}
          className={cx(
            "group flex flex-col gap-3 rounded-lg border-2 border-[#00BFFF]/30 bg-[#01192f]",
            "px-4 py-4 text-left transition-all duration-200",
            "hover:border-[#00BFFF]/60 hover:bg-[#021f3a]",
            "active:border-[#00BFFF] active:bg-[#01192f]",
            "focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2 focus:ring-offset-[#022136]"
          )}
        >
          <div>
            <h3 className="text-[15px] font-semibold text-white leading-snug">
              How Data Brokers Get Your Data
            </h3>
            <p className="mt-2 text-[13px] leading-snug text-[#B8C4CC]">
              Data Brokers harvest and profit from exposing your private data to
            </p>
          </div>
          <div className="text-[13px] font-medium text-[#00BFFF] transition-colors group-hover:text-[#00E5FF]">
            See How →
          </div>
        </motion.button>

        {/* Card 2: Risks of your data exposure */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onCardClick?.("risks")}
          className={cx(
            "group flex flex-col gap-3 rounded-lg border-2 border-[#00BFFF]/30 bg-[#01192f]",
            "px-4 py-4 text-left transition-all duration-200",
            "hover:border-[#00BFFF]/60 hover:bg-[#021f3a]",
            "active:border-[#00BFFF] active:bg-[#01192f]",
            "focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-2 focus:ring-offset-[#022136]"
          )}
        >
          <div>
            <h3 className="text-[15px] font-semibold text-white leading-snug">
              Risks of your data exposure
            </h3>
            <p className="mt-2 text-[13px] leading-snug text-[#B8C4CC]">
              Hackers, Scammers & spammers have free and easy access making it easier to attack you
            </p>
          </div>
          <div className="text-[13px] font-medium text-[#00BFFF] transition-colors group-hover:text-[#00E5FF]">
            Learn How →
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
