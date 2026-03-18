import { createContext, useContext, useState, ReactNode } from 'react';
import BetaModal from './BetaModal';

interface BetaModalContextType {
    openBetaModal: () => void;
}

const BetaModalContext = createContext<BetaModalContextType | null>(null);

export function BetaModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <BetaModalContext.Provider value={{ openBetaModal: () => setIsOpen(true) }}>
            {children}
            <BetaModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </BetaModalContext.Provider>
    );
}

export function useBetaModal() {
    const ctx = useContext(BetaModalContext);
    if (!ctx) throw new Error('useBetaModal must be used within BetaModalProvider');
    return ctx;
}
