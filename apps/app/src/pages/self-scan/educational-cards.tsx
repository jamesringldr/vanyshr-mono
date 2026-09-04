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
      className="w-full px-4 pb-8 pt-3"
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
            "group flex flex-col gap-3 rounded-lg border-2 border-accent-primary/30 bg-gray-950",
            "px-4 py-4 text-left transition-all duration-200",
            "hover:border-accent-primary/60 hover:bg-gray-900",
            "active:border-accent-primary active:bg-gray-950",
            "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-page"
          )}
        >
          <div>
            <h3 className="text-[15px] font-semibold text-white leading-snug">
              How Data Brokers Get Your Data
            </h3>
            <p className="mt-2 text-[13px] leading-snug text-text-secondary">
              Data Brokers harvest and profit from exposing your private data to
            </p>
          </div>
          <div className="text-[13px] font-medium text-accent-primary transition-colors group-hover:text-accent-hover">
            See How →
          </div>
        </motion.button>

        {/* Card 2: Risks of your data exposure */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onCardClick?.("risks")}
          className={cx(
            "group flex flex-col gap-3 rounded-lg border-2 border-accent-primary/30 bg-gray-950",
            "px-4 py-4 text-left transition-all duration-200",
            "hover:border-accent-primary/60 hover:bg-gray-900",
            "active:border-accent-primary active:bg-gray-950",
            "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-page"
          )}
        >
          <div>
            <h3 className="text-[15px] font-semibold text-white leading-snug">
              Risks of your data exposure
            </h3>
            <p className="mt-2 text-[13px] leading-snug text-text-secondary">
              Hackers, Scammers & spammers have free and easy access making it easier to attack you
            </p>
          </div>
          <div className="text-[13px] font-medium text-accent-primary transition-colors group-hover:text-accent-hover">
            Learn How →
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
