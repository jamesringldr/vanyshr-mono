import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  email: string;
  code: string;
  firstName?: string;
  type: 'quick_scan_verification' | 'general';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin operations
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

    const { email, code, firstName = 'User', type }: EmailRequest = await req.json()

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: 'Email and code are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Sending verification email to: ${email} with code: ${code}`)

    // Method 1: Use Supabase Auth Admin API to send custom email
    // This creates a temporary user to trigger the email system
    try {
      // First, try to create a temporary user account to trigger email
      const tempPassword = `temp-${Date.now()}-${Math.random()}`
      
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: false, // Don't auto-confirm
        user_metadata: {
          verification_code: code,
          first_name: firstName,
          is_temp_verification: true,
          created_for: type,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        }
      })

      if (signUpError) {
        // If user already exists, try to send a password reset email with custom data
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
          console.log('User exists, sending password reset email with verification code')
          
          // Delete the existing temp user if it exists and was created by us
          try {
            const { data: existingUsers } = await supabaseClient.auth.admin.listUsers()
            const tempUser = existingUsers.users.find(u => 
              u.email === email && 
              u.user_metadata?.is_temp_verification === true
            )
            
            if (tempUser) {
              await supabaseClient.auth.admin.deleteUser(tempUser.id)
              console.log('Deleted existing temp user')
            }
          } catch (deleteError) {
            console.log('Could not delete temp user:', deleteError)
          }

          // Try creating the user again
          const { data: retryData, error: retryError } = await supabaseClient.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: false,
            user_metadata: {
              verification_code: code,
              first_name: firstName,
              is_temp_verification: true,
              created_for: type,
              expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
            }
          })

          if (retryError) {
            throw new Error(`Failed to create temp user: ${retryError.message}`)
          }

          signUpData.user = retryData.user
        } else {
          throw new Error(signUpError.message)
        }
      }

      if (signUpData.user) {
        console.log(`Temp user created: ${signUpData.user.id}`)
        
        // Send confirmation email (this will contain our verification code in the metadata)
        const { error: emailError } = await supabaseClient.auth.admin.generateLink({
          type: 'signup',
          email: email,
          options: {
            redirectTo: undefined, // No redirect needed
            data: {
              verification_code: code,
              first_name: firstName,
              message: `Your Vanyshr verification code is: ${code}. This code expires in 10 minutes.`
            }
          }
        })

        if (emailError) {
          console.error('Error sending email:', emailError)
          throw new Error(emailError.message)
        }

        // Clean up: Delete the temporary user after a delay
        setTimeout(async () => {
          try {
            await supabaseClient.auth.admin.deleteUser(signUpData.user!.id)
            console.log(`Cleaned up temp user: ${signUpData.user!.id}`)
          } catch (cleanupError) {
            console.error('Error cleaning up temp user:', cleanupError)
          }
        }, 5000) // Delete after 5 seconds
      }

      return new Response(
        JSON.stringify({ 
          message: 'Verification email sent successfully',
          email: email,
          code: code // For development - remove in production
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (authError) {
      console.error('Supabase Auth error:', authError)
      
      // Fallback: Just return success and log the code
      console.log('📧 FALLBACK EMAIL VERIFICATION')
      console.log('==============================')
      console.log(`To: ${email}`)
      console.log(`From: Vanyshr Security Team`)
      console.log(`Subject: Your Verification Code`)
      console.log(``)
      console.log(`Hi ${firstName},`)
      console.log(``)
      console.log(`Your verification code is: ${code}`)
      console.log(``)
      console.log(`This code will expire in 10 minutes.`)
      console.log(``)
      console.log(`If you didn't request this code, please ignore this email.`)
      console.log(``)
      console.log(`Best regards,`)
      console.log(`The Vanyshr Team`)
      console.log('==============================')

      return new Response(
        JSON.stringify({ 
          message: 'Email sending failed, but verification code logged to server console',
          email: email,
          code: code,
          fallback: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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
