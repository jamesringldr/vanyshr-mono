import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Lottie from 'lottie-react';
import { supabase } from '../../services/supabase';
import logoLoaderAnimation from '../../assets/logos/LogoLoader.json';
import spamCallIcon from '../../assets/icons/spam_call.png';
import { universalScraperService } from '../../services/universalScraperService';
import { PersonProfile } from '../../services/UniversalPeopleScraper';
import Modal, { Profile } from './Modal';
import ConfirmModal from './ConfirmModal';
import Button from './Button';

// Define QuickScanProfileData interface (from AI_AGENT_HANDOFF.md and BaseScraper.ts)
interface QuickScanProfileData {
  name: string;
  phones?: Array<{ number: string; type?: string; provider?: string; }>;
  emails?: Array<{ email: string; type?: string; }>;
  addresses?: Array<{ full_address?: string; street?: string; city?: string; state?: string; zip?: string }>;
  relatives?: Array<{ name: string; relationship?: string; age?: string; }>;
  aliases?: string[];
  jobs?: Array<{ company?: string; title?: string; location?: string; }>;
  online_presence?: Array<{platform: string, handle?: string, match_reason?: string}>;
  family_records?: Array<{name: string, age?: string}>;
  legal_records?: string[];
  background_records?: string[];
  professional_records?: string[];
  assets?: string[];
  age?: string; // Add age for consistency
  source?: string; // Add source for consistency
}

const convertPersonProfileToQuickScanProfileData = (personProfile: PersonProfile): QuickScanProfileData => {
  // Deep copy to ensure no mutation of original PersonProfile
  const data: QuickScanProfileData = {
    name: personProfile.name,
    age: personProfile.age,
    source: personProfile.source,
    phones: personProfile.phones?.map(p => ({ ...p })), // Deep copy phone objects
    emails: personProfile.emails?.map(e => ({ ...e })), // Deep copy email objects
    addresses: personProfile.addresses?.map(a => ({ ...a })), // Deep copy address objects
    relatives: personProfile.relatives?.map(r => ({ ...r })), // Deep copy relative objects
    aliases: personProfile.aliases?.map(a => a.alias), // Aliases are { alias: string }, QuickScanProfileData expects string[]
    jobs: personProfile.jobs?.map(j => ({ ...j })), // Deep copy job objects
    online_presence: personProfile.online_presence?.map(op => ({ ...op })),
    family_records: personProfile.family_records?.map(fr => ({ ...fr })),
    legal_records: personProfile.legal_records?.map(lr => lr),
    background_records: personProfile.background_records?.map(br => br),
    professional_records: personProfile.professional_records?.map(pr => pr),
    assets: personProfile.assets?.map(a => a),
  };

  return data;
};

const QuickScanSearching: React.FC = () => {
  const navigate = useNavigate();
  const { scanId } = useParams<{ scanId: string }>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileFound, setProfileFound] = useState(false);
  
  // Profile selection modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [singleProfile, setSingleProfile] = useState<PersonProfile | null>(null);
  const [isSelectingProfile, setIsSelectingProfile] = useState(false);
  const [currentScraperIndex, setCurrentScraperIndex] = useState(0);
  const [isScraping, setIsScraping] = useState(false);
  const [searchParams, setSearchParams] = useState<{ first: string; last: string; state: string }>({
    first: '',
    last: '',
    state: ''
  });

  // Scraper sequence: AnyWho -> ZabaSearch
  // If sandbox_selected_scraper is set in sessionStorage, only use that scraper
  const getScraperSequence = (): string[] => {
    const sandboxScraper = sessionStorage.getItem('sandbox_selected_scraper');
    if (sandboxScraper) {
      console.log(`[Sandbox] Using single scraper: ${sandboxScraper}`);
      return [sandboxScraper];
    }
    return ['AnyWho', 'ZabaSearch'];
  };
  
  const scraperSequence = getScraperSequence();

  const handleCancelSearch = async () => {
    if (!scanId) {
      window.location.href = 'https://www.vanyshr.com';
      return;
    }

    setIsDeleting(true);

    try {
      // With the new schema, we only need to delete from the quick_scans table.
      await supabase
        .from('quick_scans')
        .delete()
        .eq('id', scanId);

      // Clean up sandbox scraper selection if present
      sessionStorage.removeItem('sandbox_selected_scraper');
      
      // Navigate to vanyshr.com
      window.location.href = 'https://www.vanyshr.com';
    } catch (error) {
      console.error('Error deleting scan data:', error);
      // Still navigate even if deletion fails
      window.location.href = 'https://www.vanyshr.com';
    } finally {
      setIsDeleting(false);
    }
  };

  // Transform PersonProfile to Modal Profile format
  const transformProfilesToModalFormat = (personProfiles: PersonProfile[]): Profile[] => {
    return personProfiles.map((profile) => {
      // DEBUG LOGS: Inspect raw data from PersonProfile
      console.log(`DEBUG: Processing profile for ${profile.name}`);
      console.log('DEBUG: profile.phones:', profile.phones);
      console.log('DEBUG: profile.addresses:', profile.addresses);
      console.log('DEBUG: profile.relatives:', profile.relatives);

      // Extract name parts
      const nameParts = (profile.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Extract age
      const age = profile.age ? parseInt(profile.age) : undefined;

      // Phones (up to 2)
      let phones: Profile['phones'] = [];
      if (profile.phones && profile.phones.length > 0) {
        phones = profile.phones.slice(0, 2);
      } else if (profile.current_phone) {
        phones.push({ number: profile.current_phone });
      } else if (profile.phone_snippet) {
        phones.push({ number: profile.phone_snippet });
      }

      // Current Address
      let currentAddress: Profile['currentAddress'];
      if (profile.addresses && profile.addresses.length > 0) {
        // Find current address: check for type === 'current', is_last_known === true, or is_current === true
        const addr = profile.addresses.find(a => 
          a.type === 'current' || 
          (a as any).is_last_known === true || 
          (a as any).is_current === true
        ) || profile.addresses[0];
        if (addr) {
          currentAddress = {
            address: addr.address || addr.full_address || addr.street || '',
            city: addr.city,
            state: addr.state,
            zip: addr.zip
          };
        }
      } else if (profile.current_address) {
        // Parse address string like "4219 NE Newbury Ct Lees Summit MO 64064"
        const addrMatch = profile.current_address.match(/^(.+?)\s+([A-Za-z\s]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
        if (addrMatch) {
          currentAddress = {
            address: addrMatch[1].trim(),
            city: addrMatch[2].trim(),
            state: addrMatch[3],
            zip: addrMatch[4]
          };
        } else {
          currentAddress = { address: profile.current_address };
        }
      }

      // Relatives (up to 3)
      const relatives = profile.relatives ? profile.relatives.slice(0, 3) : [];

      // Aliases (up to 2)
      const aliases = profile.aliases ? profile.aliases.slice(0, 2) : [];

      // Jobs (first one)
      const jobs = profile.jobs && profile.jobs.length > 0 ? [profile.jobs[0]] : [];

      // Online Presence (up to 2)
      const online_presence = profile.online_presence ? profile.online_presence.slice(0, 2) : [];

      // Family Records (up to 2)
      const family_records = profile.family_records ? profile.family_records.slice(0, 2) : [];


      return {
        id: profile.id,
        firstName,
        lastName,
        age,
        phones,
        currentAddress,
        relatives,
        aliases,
        jobs,
        online_presence,
        family_records,
        source: profile.source
      };
    });
  };

  // Run a single scraper and handle results
  const runScraper = async (scraperName: string, formData: any): Promise<{ found: boolean; profiles: PersonProfile[] }> => {
    console.log(`🔍 Running ${scraperName} scraper...`);
    console.log('🔍 Search params:', {
      firstName: formData.firstName,
      lastName: formData.lastName,
      city: formData.city,
      state: formData.state,
      siteName: scraperName
    });

    try {
      console.log(`🔍 ${scraperName} - Calling searchProfiles with:`, {
        scanId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        city: formData.city,
        state: formData.state,
        siteName: scraperName
      });

      const { profiles: searchProfiles, error: searchError } = await universalScraperService.searchProfiles(
        scanId!,
        formData.firstName,
        formData.lastName,
        formData.city,
        formData.state,
        scraperName,
        true // useNewSchema = true
      );

      if (searchError) {
        console.error(`❌ ${scraperName} search error:`, searchError);
        return { found: false, profiles: [] };
      }

      console.log(`🔍 ${scraperName} found ${searchProfiles.length} profiles`);
      console.log(`🔍 ${scraperName} profile details:`, searchProfiles.map((p: any) => ({
        id: p.id,
        name: p.name,
        hasDetailLink: !!p.detail_link,
        source: p.source
      })));

      // Filter out invalid profiles (like "Summary" entries)
      // For Zabasearch, detail_link is optional since all data is in the PersonProfile
      const validProfiles = searchProfiles.filter((p: any) => {
        const nameLower = (p.name || '').toLowerCase();
        const isValidName = !nameLower.includes('summary') && 
                           !nameLower.includes('overview') && 
                           !nameLower.includes('profile overview') &&
                           (p.name || '').length >= 3;
        
        // For Zabasearch, we don't require detail_link since full data is already extracted
        // For other scrapers, detail_link is required for Step 2 scraping
        if (scraperName === 'ZabaSearch' || scraperName === 'Zabasearch') {
          return isValidName;
        }
        
        return isValidName && p.detail_link; // Must have detail link for other scrapers
      });

      console.log(`🎭 ${scraperName} valid profiles after filtering: ${validProfiles.length}`);

      return { found: validProfiles.length > 0, profiles: validProfiles };
    } catch (error) {
      console.error(`💥 ${scraperName} exception:`, error);
      return { found: false, profiles: [] };
    }
  };

  // Run scrapers sequentially
  const runSequentialScrapers = async (formData: any, startIndex: number = 0) => {
    setIsScraping(true);
    
    for (let i = startIndex; i < scraperSequence.length; i++) {
      const scraperName = scraperSequence[i];
      setCurrentScraperIndex(i);
      
      console.log(`🔍 Attempting scraper ${i + 1}/${scraperSequence.length}: ${scraperName}`);
      
      const result = await runScraper(scraperName, formData);
      
      if (result.found) {
        // Found profiles, save them to the DB before showing modal
        await supabase
          .from('quick_scans')
          .update({ profile_matches: result.profiles })
          .eq('id', scanId);

        // Now show appropriate modal and stop sequence
        if (result.profiles.length === 1) {
          // Single profile - show confirm modal
          console.log(`✅ ${scraperName} found single profile: ${result.profiles[0].name}`);
          setSingleProfile(result.profiles[0]);
          setProfileFound(true);
          setShowConfirmModal(true);
          setIsScraping(false);
          return; // Stop sequence, wait for user response
        } else {
          // Multiple profiles - show selection modal
          console.log(`✅ ${scraperName} found ${result.profiles.length} profiles, showing modal`);
          setProfiles(result.profiles);
          setProfileFound(true);
          setShowProfileModal(true);
          setIsScraping(false);
          return; // Stop sequence, wait for user response
        }
      } else {
        // No profiles found - continue to next scraper
        console.log(`⚠️ ${scraperName} found no profiles, continuing to next scraper...`);
        // Continue loop to next scraper
      }
    }
    
    // All scrapers exhausted - no profiles found
    console.log('⚠️ All scrapers exhausted, no profiles found');
    setIsScraping(false);
    setProfileFound(false);
    
    // Navigate back to quick-scan page
    setTimeout(() => {
      navigate('/quick-scan');
    }, 2000);
  };

  // Continue to next scraper (called when user clicks "This isn't me")
  const continueToNextScraper = async (formData: any) => {
    setShowConfirmModal(false);
    setShowProfileModal(false);
    setSingleProfile(null);
    setProfiles([]);
    
    const nextIndex = currentScraperIndex + 1;
    setCurrentScraperIndex(nextIndex);
    
    // Wait a moment before starting next scraper
    setTimeout(() => {
      runSequentialScrapers(formData, nextIndex);
    }, 500);
  };

  // Unified handler for profile selection
  const handleProfileSelection = async (profileId: string) => {
    if (!scanId) {
      console.error('❌ No scanId found, cannot proceed');
      return;
    }

    const selectedProfile = singleProfile && singleProfile.id === profileId 
      ? singleProfile 
      : profiles.find(p => p.id === profileId);

    if (!selectedProfile) {
      console.error('❌ Selected profile not found');
      return;
    }

    // Zabasearch special handling, as per the integration plan
    // ZabaSearch returns full profile data in search results, so no detail scraping needed
    if (selectedProfile.source?.toLowerCase() === 'zabasearch') {
      console.log('✅ Zabasearch profile selected, saving data directly...');
      setIsSelectingProfile(true);

      const profileData = convertPersonProfileToQuickScanProfileData(selectedProfile);

      const { error } = await supabase
        .from('quick_scans')
        .update({
          status: 'completed',
          profile_data: profileData,
          selected_match_id: profileId,
          data_sources: ['Zabasearch']
        })
        .eq('id', scanId);

      if (error) {
        console.error('❌ Error saving Zabasearch profile data:', error);
        setIsSelectingProfile(false);
        return;
      }

      console.log('✅ Zabasearch profile data saved successfully.');
      sessionStorage.removeItem('sandbox_selected_scraper');
      navigate(`/quick-scan/details/${scanId}`);
      return;
    }

    // Default handling for other scrapers (e.g., AnyWho)
    if (!selectedProfile.detail_link) {
      console.error('❌ Selected profile has no detail_link');
      return;
    }

    setIsSelectingProfile(true);
    console.log('💾 Saving selected profile reference...');

    try {
      const { error: updateError } = await supabase
        .from('quick_scans')
        .update({
          status: 'processing',
          selected_match_id: selectedProfile.id,
          profile_matches: profiles.length > 0 ? profiles : [singleProfile], // Save all matches for context
          data_sources: [selectedProfile.source],
        })
        .eq('id', scanId);
      
      if (updateError) {
        console.error(`❌ Error saving profile selection: ${updateError.message}`);
        setIsSelectingProfile(false);
        return;
      }

      console.log('✅ Profile selection saved successfully');
      setShowConfirmModal(false);
      setShowProfileModal(false);
      setSingleProfile(null);
      setProfiles([]);
      setIsScraping(false);
      
      sessionStorage.removeItem('sandbox_selected_scraper');
      
      // Navigate to Step 2 for detail scraping
      console.log('🎯 Navigating to collecting-data page:', `/quick-scan/collecting-data/${scanId}`);
      navigate(`/quick-scan/collecting-data/${scanId}`);
    } catch (error) {
      console.error('🎭 Error saving profile selection:', error);
      setIsSelectingProfile(false);
    }
  };

  // Keep the old function names but have them call the new unified handler
  const handleConfirmProfile = (profileId: string) => handleProfileSelection(profileId);
  const handleProfileSelect = (profileId: string) => handleProfileSelection(profileId);

  useEffect(() => {
    if (!scanId) {
      navigate('/quick-scan');
      return;
    }

    const initialize = async () => {
      // 1. Check for existing profiles in the database
      const { data: scan, error: scanError } = await supabase
        .from('quick_scans')
        .select('profile_matches, search_input')
        .eq('id', scanId)
        .single();

      if (scanError) {
        console.error('Error fetching scan data:', scanError);
        navigate('/quick-scan');
        return;
      }
      
      const profileMatches = scan.profile_matches as PersonProfile[];

      if (profileMatches && profileMatches.length > 0) {
        // 2a. Profiles already exist, show the modal
        console.log('Found existing profile matches in DB, showing modal.');
        setProfiles(profileMatches);
        if (profileMatches.length === 1) {
            setSingleProfile(profileMatches[0]);
            setShowConfirmModal(true);
        } else {
            setShowProfileModal(true);
        }
        const search_input = scan.search_input as any;
        setSearchParams({
          first: search_input.first_name || '',
          last: search_input.last_name || '',
          state: search_input.state || ''
        });

      } else {
        // 2b. No profiles in DB, run the scrapers
        console.log('No existing profiles found, running scrapers.');
        let formData = null;
        const scanFormData = sessionStorage.getItem('scan_form_data');
        if (scanFormData) {
          formData = JSON.parse(scanFormData);
        } else {
          const search_input = scan.search_input as any;
          if (search_input) {
            formData = {
              firstName: search_input.first_name,
              lastName: search_input.last_name,
              city: search_input.city,
              state: search_input.state,
              zipCode: search_input.zip
            };
          }
        }

        if (formData) {
            setSearchParams({
                first: formData.firstName || '',
                last: formData.lastName || '',
                state: formData.state || ''
            });
            await runSequentialScrapers(formData, 0);
        } else {
            console.error('No form data found to run scrapers.');
            navigate('/quick-scan');
        }
      }
    };

    initialize();
  }, [scanId, navigate]);

  return (
    <div className="min-h-screen bg-page dark:bg-[var(--brand-dark)] flex flex-col">
      {/* Status Bar */}
      <div className="pt-4 pb-2 px-4 flex gap-2 items-center">
        <div className="h-1 rounded-full bg-[var(--brand-primary)] flex-1" />
        <div className="h-1 rounded-full bg-[var(--text-muted)] dark:bg-[var(--text-secondary)] flex-1" />
        <div className="h-1 rounded-full bg-[var(--text-muted)] dark:bg-[var(--text-secondary)] flex-1" />
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center text-center flex-1 py-4 px-4">
        {/* Title */}
        <h1 className="font-bold text-primary dark:text-white mb-4 text-lg sm:text-xl md:text-2xl max-w-[600px] px-4 leading-tight">
          Prowling the deepest parts of the web to find who has your data...
        </h1>

        {/* Description */}
        <p className="text-secondary dark:text-secondary mb-4 text-sm sm:text-base max-w-[500px] px-4 leading-relaxed">
          We are targeting known data brokers and crawling their databases to identify if they have your data and exactly what data they have..
        </p>

        {/* Lottie Animation - Ghost */}
        <div className="w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] md:w-[300px] md:h-[300px] mb-4 flex justify-center items-center">
          <Lottie
            animationData={logoLoaderAnimation}
            loop={true}
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        </div>

        {/* Prevent Spam Calls & Texts Section */}
        <div className="bg-[var(--brand-dark)] dark:bg-surface rounded-xl p-4 sm:p-6 mb-4 max-w-[600px] w-full mx-4">
          <div className="flex flex-col gap-4">
            {/* Top Container - Title (centered) */}
            <div className="flex justify-center">
              <h2 className="font-bold text-white text-lg sm:text-xl text-center">
                Prevent Spam Calls & Texts
              </h2>
            </div>

            {/* Bottom Row - Icon and Text */}
            <div className="flex flex-row gap-4">
              {/* Left Container - 25% width */}
              <div className="w-1/4 flex justify-center items-center">
                <img
                  src={spamCallIcon}
                  alt="Spam call prevention"
                  className="w-full h-auto object-contain max-w-full"
                />
              </div>

              {/* Right Container - 75% width */}
              <div className="w-3/4 flex flex-col">
                <p className="text-white/90 text-sm sm:text-base leading-relaxed text-left">
                  Predatory companies buy your exposed data from data brokers to relentlessly attempt to sell you unsolicited products or services.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Search Button */}
        <Button
          variant="secondary"
          onClick={handleCancelSearch}
          disabled={isDeleting}
          isLoading={isDeleting}
          className="mb-4"
        >
          {isDeleting ? 'Canceling...' : 'Cancel Search'}
        </Button>

        {/* Cancel Message */}
        <p className="text-secondary dark:text-secondary text-xs sm:text-sm max-w-[400px] px-4 leading-relaxed">
          Canceling your search will completely remove any of your data completely from our system
        </p>
      </div>

      {/* Profile Selection Modal (Multiple Profiles) */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => {
          if (!isSelectingProfile) {
            setShowProfileModal(false);
          }
        }}
        searchParams={searchParams}
        profiles={transformProfilesToModalFormat(profiles)}
        onProfileSelect={handleProfileSelect}
        onNoneSelected={async () => {
          setShowProfileModal(false);
          // Get form data and continue to next scraper
          const scanFormData = sessionStorage.getItem('scan_form_data');
          if (scanFormData) {
            const formData = JSON.parse(scanFormData);
            await continueToNextScraper(formData);
          } else {
            // Fallback: navigate to collecting-data if no form data
            if (scanId) {
              navigate(`/quick-scan/collecting-data/${scanId}`);
            }
          }
        }}
        size="lg"
      />

      {/* Confirm Modal (Single Profile) */}
      {singleProfile && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => {
            if (!isSelectingProfile) {
              setShowConfirmModal(false);
            }
          }}
          searchParams={searchParams}
          profile={transformProfilesToModalFormat([singleProfile])[0]}
          onConfirm={handleConfirmProfile}
          onCancel={async () => {
            // Get form data and continue to next scraper
            const scanFormData = sessionStorage.getItem('scan_form_data');
            if (scanFormData) {
              const formData = JSON.parse(scanFormData);
              await continueToNextScraper(formData);
            } else {
              // Fallback: navigate to collecting-data if no form data
              setShowConfirmModal(false);
              setSingleProfile(null);
              if (scanId) {
                navigate(`/quick-scan/collecting-data/${scanId}`);
              }
            }
          }}
        />
      )}

      {/* Loading overlay when selecting profile */}
      {isSelectingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-surface rounded-lg p-6 flex flex-col items-center gap-4">
            <h3 className="text-lg font-bold text-primary dark:text-white">
              Processing your selection...
            </h3>
            <svg
              className="animate-spin h-10 w-10 text-[var(--brand-primary)]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickScanSearching;


