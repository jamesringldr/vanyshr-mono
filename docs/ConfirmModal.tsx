import React, { useEffect, useState } from 'react';
import {
  Phone,
  Address,
  Relative,
  Alias,
  Job,
  OnlinePresence,
  FamilyRecord,
} from '../../services/UniversalPeopleScraper';

// --- Interfaces ---
export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  age?: number;
  phones?: Phone[];
  currentAddress?: Address;
  relatives?: Relative[];
  aliases?: Alias[];
  jobs?: Job[];
  online_presence?: OnlinePresence[];
  family_records?: FamilyRecord[];
  source?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchParams: {
    first: string;
    last: string;
    state: string;
  };
  profile: Profile;
  onConfirm?: (profileId: string) => void;
  onCancel?: () => void;
}

// --- Component ---
const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  searchParams, 
  profile, 
  onConfirm,
  onCancel 
}) => {
  const [showContent, setShowContent] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Small delay to allow the modal to mount before fading in
      const timer = setTimeout(() => setShowContent(true), 10);
      
      // Timer for the buttons animation
      const buttonTimer = setTimeout(() => setShowButtons(true), 500);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        clearTimeout(timer);
        clearTimeout(buttonTimer);
      };
    } else {
      // Reset states on close
      setShowContent(false);
      setShowButtons(false);
    }
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    if (onConfirm) onConfirm(profile.id);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else onClose();
  };

  if (!isOpen) return null;

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300">
      
      {/* Modal Container */}
      <div 
        className={`
          bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden
          transform transition-all duration-300 ease-out 
          ${showContent ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
      >
        
        {/* --- Header --- */}
        <div className="p-6 text-center border-b border-gray-100 flex-shrink-0 relative">
          {/* Close X */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-xl font-extrabold text-primary leading-tight mb-2">
            We Found A Record For <br />
            <span className="text-[var(--brand-primary)]">
              {searchParams.first} {searchParams.last}
            </span> in {searchParams.state}
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Is This Your Profile?
          </p>
        </div>

        {/* --- Profile Card --- */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          <div className="rounded-lg p-5 bg-gray-50 border-2 border-[var(--brand-primary)]/20">
            {/* Card Header Name and Source (if Zabasearch) */}
            <h3 className="text-lg font-bold mb-1 text-primary">
              {profile.firstName} {profile.lastName}
              {profile.source === 'ZabaSearch' && (
                <span className="ml-2 px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded-full">
                  Complete Profile
                </span>
              )}
            </h3>
            {profile.age && <p className="text-sm text-slate-500 mb-1">Age: {profile.age}</p>}

            {/* Aliases */}
            {profile.aliases && profile.aliases.length > 0 && (
              <div className="py-[5px] mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wide flex-shrink-0" style={{ fontSize: '0.675rem' }}>Aliases</span>
                  <div className="text-slate-600 font-medium flex-1 flex flex-wrap gap-x-2" style={{ fontSize: '0.675rem' }}>
                    {profile.aliases.slice(0, 2).map((alias, idx) => (
                      <span key={idx} className="truncate">{alias.alias}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Data Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-1">
              
              {/* Left Column */}
              <div className="space-y-3">
                {/* Phones */}
                {profile.phones && profile.phones.length > 0 && (
                  <div>
                    <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">Phones</span>
                    {profile.phones.slice(0, 2).map((phone, idx) => (
                      <span key={idx} className="block text-slate-600 font-medium">{phone.number}</span>
                    ))}
                  </div>
                )}

                {/* Current Address */}
                {profile.currentAddress && (
                  <div>
                    <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">Current Address</span>
                    <div className="text-slate-600 font-medium leading-snug">
                      {profile.currentAddress.address && <>{profile.currentAddress.address}<br/></>}
                      {profile.currentAddress.city && profile.currentAddress.state && (
                        <>
                          {profile.currentAddress.city}, {profile.currentAddress.state}
                          {profile.currentAddress.zip && ` ${profile.currentAddress.zip}`}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Jobs */}
                {profile.jobs && profile.jobs.length > 0 && (
                  <div>
                    <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">Recent Job</span>
                    <div className="text-slate-600 font-medium leading-snug">
                      {profile.jobs[0].company} {profile.jobs[0].title && `(${profile.jobs[0].title})`}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                {/* Relatives */}
                {profile.relatives && profile.relatives.length > 0 && (
                  <div>
                    <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">Relatives</span>
                    <div className="text-slate-600 font-medium leading-snug">
                       {profile.relatives.slice(0, 3).map((rel, idx) => (
                         <span key={idx} className="block truncate">{rel.name}</span>
                       ))}
                    </div>
                  </div>
                )}

                {/* Online Presence */}
                {profile.online_presence && profile.online_presence.length > 0 && (
                  <div>
                    <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">Online</span>
                    <div className="text-slate-600 font-medium leading-snug">
                      {profile.online_presence.slice(0, 2).map((op, idx) => (
                        <span key={idx} className="block truncate">{op.platform}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Family Records (distinct from Relatives if applicable) */}
                {profile.family_records && profile.family_records.length > 0 && (
                  <div>
                    <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">Family</span>
                    <div className="text-slate-600 font-medium leading-snug">
                      {profile.family_records.slice(0, 2).map((fr, idx) => (
                        <span key={idx} className="block truncate">{fr.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* --- Footer --- */}
        <div className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className={`
                flex-1 py-3.5 rounded-lg font-bold text-lg text-primary shadow-lg
                bg-gray-100 hover:bg-gray-200 active:transform active:scale-[0.98]
                transition-all duration-700 ease-in-out transform
                ${showButtons 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-8 pointer-events-none'}
              `}
            >
              This Isn't Me
            </button>
            <button
              onClick={handleConfirm}
              className={`
                flex-1 py-3.5 rounded-lg font-bold text-lg text-white shadow-lg
                bg-[var(--brand-primary)] hover:bg-[var(--accent-secondary)] active:transform active:scale-[0.98]
                transition-all duration-700 ease-in-out transform
                ${showButtons 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-8 pointer-events-none'}
              `}
            >
              Yes, This Is Me
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ConfirmModal;



