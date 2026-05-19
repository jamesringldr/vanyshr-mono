import { createContext, useContext, ReactNode } from 'react';
import { useNavigate } from 'react-router';

interface BetaModalContextType {
    /** @deprecated Beta gate removed — navigates to magic-link signup. */
    openBetaModal: () => void;
}

const BetaModalContext = createContext<BetaModalContextType | null>(null);

export function BetaModalProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();

    return (
        <BetaModalContext.Provider
            value={{
                openBetaModal: () => navigate('/signup'),
            }}
        >
            {children}
        </BetaModalContext.Provider>
    );
}

export function useBetaModal() {
    const ctx = useContext(BetaModalContext);
    if (!ctx) throw new Error('useBetaModal must be used within BetaModalProvider');
    return ctx;
}
