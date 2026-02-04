import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  searchProfiles,
  scrapeFullProfile,
  type SearchInput,
} from "../_shared/scrapers/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BrokerScanRequest {
  user_id: string;
  first_name: string;
  last_name: string;
  city?: string;
  state?: string;
  broker_id?: string; // Optional: specific broker to scan
}

interface ExposureRecord {
  user_id: string;
  broker_id: string;
  data_type: string;
  data_value: string;
  source_url?: string;
  status: 'found' | 'removed' | 'in_progress';
  first_found_at: string;
  raw_data?: any;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🔍 Broker Scan - Function started')

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const requestBody: BrokerScanRequest = await req.json()
    const { user_id, first_name, last_name, city, state, broker_id } = requestBody

    if (!user_id || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: 'user_id, first_name, and last_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Broker Scan - Starting for: ${first_name} ${last_name} (user: ${user_id})`)

    // Get brokers to scan
    let brokersToScan: any[] = [];

    if (broker_id) {
      // Scan specific broker
      const { data: broker, error } = await supabaseClient
        .from('brokers')
        .select('*')
        .eq('id', broker_id)
        .single();

      if (error || !broker) {
        return new Response(
          JSON.stringify({ error: 'Broker not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      brokersToScan = [broker];
    } else {
      // Get all active brokers
      const { data: brokers, error } = await supabaseClient
        .from('brokers')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching brokers:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch brokers' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      brokersToScan = brokers || [];
    }

    console.log(`🔍 Broker Scan - Scanning ${brokersToScan.length} brokers`);

    const searchInput: SearchInput = {
      first_name,
      last_name,
      city: city || undefined,
      state: state || undefined,
    };

    const exposuresFound: ExposureRecord[] = [];
    const scanResults: any[] = [];

    // Scan each broker
    for (const broker of brokersToScan) {
      const scraperName = broker.scraper_config?.scraper_name || broker.name.toLowerCase().replace(/\s+/g, '');

      console.log(`🔍 Scanning broker: ${broker.name} (${scraperName})`);

      try {
        // Search for profiles on this broker
        const matches = await searchProfiles(scraperName, searchInput);

        if (matches.length > 0) {
          console.log(`🔍 Found ${matches.length} matches on ${broker.name}`);

          // For each match, create exposure records
          for (const match of matches) {
            // Get full profile data if detail link available
            let profileData = null;
            if (match.detail_link) {
              profileData = await scrapeFullProfile(scraperName, match.detail_link);
            }

            const now = new Date().toISOString();

            // Create exposure for the profile listing itself
            exposuresFound.push({
              user_id,
              broker_id: broker.id,
              data_type: 'profile_listing',
              data_value: match.name || `${first_name} ${last_name}`,
              source_url: match.detail_link,
              status: 'found',
              first_found_at: now,
              raw_data: {
                match,
                profile_data: profileData,
              },
            });

            // Create exposures for specific data types found
            if (profileData) {
              // Phone exposures
              if (profileData.phones && profileData.phones.length > 0) {
                for (const phone of profileData.phones) {
                  const phoneVal = typeof phone === 'string' ? phone : (phone?.number ?? '');
                  if (!phoneVal) continue;
                  exposuresFound.push({
                    user_id,
                    broker_id: broker.id,
                    data_type: 'phone',
                    data_value: phoneVal,
                    source_url: match.detail_link,
                    status: 'found',
                    first_found_at: now,
                  });
                }
              }

              // Email exposures
              if (profileData.emails && profileData.emails.length > 0) {
                for (const email of profileData.emails) {
                  const emailVal = typeof email === 'string' ? email : (email?.email ?? '');
                  if (!emailVal) continue;
                  exposuresFound.push({
                    user_id,
                    broker_id: broker.id,
                    data_type: 'email',
                    data_value: emailVal,
                    source_url: match.detail_link,
                    status: 'found',
                    first_found_at: now,
                  });
                }
              }

              // Address exposures
              if (profileData.addresses && profileData.addresses.length > 0) {
                for (const addr of profileData.addresses) {
                  const addressStr = addr.full_address || `${addr.street || ''} ${addr.city || ''} ${addr.state || ''} ${addr.zip || ''}`.trim();
                  if (addressStr) {
                    exposuresFound.push({
                      user_id,
                      broker_id: broker.id,
                      data_type: 'address',
                      data_value: addressStr,
                      source_url: match.detail_link,
                      status: 'found',
                      first_found_at: now,
                    });
                  }
                }
              }
            }
          }

          scanResults.push({
            broker_id: broker.id,
            broker_name: broker.name,
            status: 'found',
            matches_count: matches.length,
          });
        } else {
          scanResults.push({
            broker_id: broker.id,
            broker_name: broker.name,
            status: 'not_found',
            matches_count: 0,
          });
        }
      } catch (scraperError) {
        console.error(`🔍 Error scanning ${broker.name}:`, scraperError);
        scanResults.push({
          broker_id: broker.id,
          broker_name: broker.name,
          status: 'error',
          error: (scraperError as Error).message,
        });
      }
    }

    // Save exposures to database
    if (exposuresFound.length > 0) {
      console.log(`🔍 Saving ${exposuresFound.length} exposures to database`);

      const { error: insertError } = await supabaseClient
        .from('exposures')
        .insert(exposuresFound);

      if (insertError) {
        console.error('Error saving exposures:', insertError);
      } else {
        console.log(`✅ Successfully saved ${exposuresFound.length} exposures`);
      }
    }

    // Update scan_history for the user
    const { error: historyError } = await supabaseClient
      .from('scan_history')
      .insert({
        user_id,
        scan_type: 'full',
        status: 'completed',
        brokers_scanned: brokersToScan.length,
        exposures_found: exposuresFound.length,
        results: { scan_results: scanResults },
      });

    if (historyError) {
      console.error('Error saving scan history:', historyError);
    }

    console.log(`🔍 Broker Scan - Completed. Found ${exposuresFound.length} exposures across ${brokersToScan.length} brokers`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Broker scan completed',
        brokers_scanned: brokersToScan.length,
        exposures_found: exposuresFound.length,
        scan_results: scanResults,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('🔍 Broker Scan - Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
