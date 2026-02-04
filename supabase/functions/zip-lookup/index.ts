import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZipLookupRequest {
  zip_code: string;
  profile_id?: string; // Optional: to update specific qs_profile record
}

interface ZippopotamusResponse {
  'post code': string;
  country: string;
  'country abbreviation': string;
  places: Array<{
    'place name': string;
    longitude: string;
    state: string;
    'state abbreviation': string;
    latitude: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
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

    // Parse request body
    const { zip_code, profile_id }: ZipLookupRequest = await req.json()

    if (!zip_code) {
      return new Response(
        JSON.stringify({ error: 'zip_code is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Looking up ZIP code: ${zip_code}`)

    // First, check if ZIP code already exists in our local lookup table
    const { data: existingZip, error: lookupError } = await supabaseClient
      .from('zip_lookup')
      .select('*')
      .eq('zip', zip_code)
      .single()

    if (!lookupError && existingZip) {
      console.log(`Found ZIP ${zip_code} in local lookup table`)

      return new Response(
        JSON.stringify({
          zip_code: zip_code,
          city: existingZip.city,
          state_code: existingZip.state_code,
          source: 'local_lookup'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If not found locally, fetch from external API (Zippopotam.us)
    console.log(`ZIP ${zip_code} not found locally, fetching from external API`)
    
    const externalResponse = await fetch(`http://api.zippopotam.us/us/${zip_code}`)
    
    if (!externalResponse.ok) {
      if (externalResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            error: 'ZIP code not found',
            zip_code: zip_code 
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      throw new Error(`External API error: ${externalResponse.status}`)
    }

    const zipData: ZippopotamusResponse = await externalResponse.json()
    
    if (!zipData.places || zipData.places.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No location data found for ZIP code',
          zip_code: zip_code 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract city and state from the first place (most ZIP codes have one primary place)
    const place = zipData.places[0]
    const city = place['place name']
    const state_id = place['state abbreviation'] // This is the state code (e.g., 'CA', 'NY')
    const state_name = place['state'] // This is the full state name (e.g., 'California', 'New York')

    console.log(`External API returned: ${city}, ${state_id}, ${state_name}`)

    // Insert the new ZIP code data into our local lookup table for future use
    const { error: insertError } = await supabaseClient
      .from('zip_lookup')
      .insert([{
        zip: zip_code,
        city: city,
        state_code: state_id
      }])

    if (insertError) {
      console.error('Error inserting into zip_lookup:', insertError)
      // Continue anyway, we still have the data to return
    } else {
      console.log(`Inserted ZIP ${zip_code} into local lookup table`)
    }

    return new Response(
      JSON.stringify({
        zip_code: zip_code,
        city: city,
        state_code: state_id,
        state_name: state_name,
        source: 'external_api',
        added_to_lookup: !insertError
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
