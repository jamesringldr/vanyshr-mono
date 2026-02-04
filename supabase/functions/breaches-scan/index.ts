import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BreachesScanRequest {
  user_id?: string; // Optional: for authenticated users
  email: string;
}

interface HIBPBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  ModifiedDate: string;
  PwnCount: number;
  Description: string;
  LogoPath: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
}

interface HIBPAPIResponse {
  Name?: string;
  Title?: string;
  Domain?: string;
  BreachDate?: string;
  AddedDate?: string;
  ModifiedDate?: string;
  PwnCount?: number;
  Description?: string;
  LogoPath?: string;
  DataClasses?: string[];
  IsVerified?: boolean;
  IsFabricated?: boolean;
  IsSensitive?: boolean;
  IsRetired?: boolean;
  IsSpamList?: boolean;
  IsMalware?: boolean;
  // Alternative field names
  name?: string;
  title?: string;
  domain?: string;
  breachDate?: string;
  addedDate?: string;
  modifiedDate?: string;
  pwnCount?: number;
  description?: string;
  logoPath?: string;
  dataClasses?: string[];
  isVerified?: boolean;
  isFabricated?: boolean;
  isSensitive?: boolean;
  isRetired?: boolean;
  isSpamList?: boolean;
  isMalware?: boolean;
}

function normalizeHIBPResponse(apiResponse: HIBPAPIResponse): HIBPBreach {
  return {
    Name: apiResponse.Name || apiResponse.name || '',
    Title: apiResponse.Title || apiResponse.title || '',
    Domain: apiResponse.Domain || apiResponse.domain || '',
    BreachDate: apiResponse.BreachDate || apiResponse.breachDate || '',
    AddedDate: apiResponse.AddedDate || apiResponse.addedDate || '',
    ModifiedDate: apiResponse.ModifiedDate || apiResponse.modifiedDate || '',
    PwnCount: apiResponse.PwnCount || apiResponse.pwnCount || 0,
    Description: apiResponse.Description || apiResponse.description || '',
    LogoPath: apiResponse.LogoPath || apiResponse.logoPath || '',
    DataClasses: apiResponse.DataClasses || apiResponse.dataClasses || [],
    IsVerified: apiResponse.IsVerified || apiResponse.isVerified || false,
    IsFabricated: apiResponse.IsFabricated || apiResponse.isFabricated || false,
    IsSensitive: apiResponse.IsSensitive || apiResponse.isSensitive || false,
    IsRetired: apiResponse.IsRetired || apiResponse.isRetired || false,
    IsSpamList: apiResponse.IsSpamList || apiResponse.isSpamList || false,
    IsMalware: apiResponse.IsMalware || apiResponse.isMalware || false
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    const { user_id, email }: BreachesScanRequest = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`🔒 Breaches Scan - Starting for: ${email}${user_id ? ` (user: ${user_id})` : ''}`)

    let breaches: HIBPBreach[] = [];

    if (Deno.env.get('HIBP_API_KEY')) {
      try {
        console.log('🔒 Breaches Scan - Calling HIBP API...');
        const hibpResponse = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
          headers: {
            'hibp-api-key': Deno.env.get('HIBP_API_KEY') ?? '',
            'user-agent': 'Vanyshr-BreachesScan'
          }
        })

        if (hibpResponse.status === 200) {
          const breachNames = await hibpResponse.json()
          console.log(`🔒 Breaches Scan - Found ${breachNames.length} breach names`)

          // Fetch detailed information for each breach (limit to first 10)
          const detailedBreaches: HIBPBreach[] = [];

          for (const breachName of breachNames.slice(0, 10)) {
            try {
              const detailResponse = await fetch(`https://haveibeenpwned.com/api/v3/breach/${encodeURIComponent(breachName.Name)}`, {
                headers: {
                  'hibp-api-key': Deno.env.get('HIBP_API_KEY') ?? '',
                  'user-agent': 'Vanyshr-BreachesScan'
                }
              });

              if (detailResponse.status === 200) {
                const breachDetail = await detailResponse.json();
                const normalizedBreach = normalizeHIBPResponse(breachDetail);
                detailedBreaches.push(normalizedBreach);
              } else {
                // Add basic breach info if details can't be fetched
                detailedBreaches.push({
                  Name: breachName.Name,
                  Title: breachName.Name,
                  Domain: '',
                  BreachDate: '',
                  AddedDate: '',
                  ModifiedDate: '',
                  PwnCount: 0,
                  Description: '',
                  LogoPath: '',
                  DataClasses: [],
                  IsVerified: false,
                  IsFabricated: false,
                  IsSensitive: false,
                  IsRetired: false,
                  IsSpamList: false,
                  IsMalware: false
                });
              }

              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (detailError) {
              console.error(`🔒 Error fetching details for ${breachName.Name}:`, detailError);
              detailedBreaches.push({
                Name: breachName.Name,
                Title: breachName.Name,
                Domain: '',
                BreachDate: '',
                AddedDate: '',
                ModifiedDate: '',
                PwnCount: 0,
                Description: '',
                LogoPath: '',
                DataClasses: [],
                IsVerified: false,
                IsFabricated: false,
                IsSensitive: false,
                IsRetired: false,
                IsSpamList: false,
                IsMalware: false
              });
            }
          }

          breaches = detailedBreaches;
        } else if (hibpResponse.status === 404) {
          console.log('🔒 Breaches Scan - No breaches found')
          breaches = []
        } else {
          console.error(`🔒 Breaches Scan - HIBP API error: ${hibpResponse.status}`)
          breaches = []
        }
      } catch (hibpError) {
        console.error('🔒 Breaches Scan - HIBP API request failed:', hibpError)
        breaches = []
      }
    } else {
      console.log('🔒 Breaches Scan - HIBP_API_KEY not found')
      breaches = []
    }

    // Save breaches to data_breaches table (requires user_id)
    if (breaches.length > 0 && user_id) {
      console.log(`🔒 Breaches Scan - Saving ${breaches.length} breaches to database...`);

      const breachRecords = breaches.map(breach => ({
        user_id,
        breach_name: breach.Name,
        breach_title: breach.Title,
        breach_domain: breach.Domain || null,
        breach_date: breach.BreachDate || null,
        exposed_data_types: breach.DataClasses || [],
        matched_email: email,
        hibp_data: breach,
      }));

      const { error: insertError } = await supabaseClient
        .from('data_breaches')
        .insert(breachRecords);

      if (insertError) {
        console.error('🔒 Breaches Scan - Error inserting breach records:', insertError.message);
      } else {
        console.log(`🔒 Breaches Scan - Successfully saved ${breaches.length} breach records`);
      }
    }

    console.log(`🔒 Breaches Scan - Successfully processed ${breaches.length} breach results`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Breaches scan completed successfully',
      breaches_found: breaches.length,
      breach_names: breaches.map(b => b.Name)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('🔒 Breaches Scan - Edge Function error:', (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
