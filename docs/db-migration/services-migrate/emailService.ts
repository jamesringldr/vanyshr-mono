import { supabase } from './supabase';

export interface EmailVerificationOptions {
  email: string;
  code: string;
  firstName?: string;
}

export const emailService = {
  /**
   * Send verification code via email using Supabase Edge Function
   * This uses a dedicated Edge Function that sends emails via Supabase Auth
   */
  async sendVerificationCode({ email, code, firstName = 'User' }: EmailVerificationOptions): Promise<{ success: boolean; error?: string }> {
    try {
      // Call our Edge Function to send the verification email
      const { data, error } = await supabase.functions.invoke('send-verification-email', {
        body: {
          email: email,
          code: code,
          firstName: firstName,
          type: 'quick_scan_verification'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log(`✅ Verification email sent to: ${email} with code: ${code}`);
      return { success: true };
    } catch (error) {
      console.error('Error sending verification email:', error);
      
      // Fallback: Log to console for development
      console.log('📧 EMAIL VERIFICATION CODE (Fallback)');
      console.log('====================================');
      console.log(`To: ${email}`);
      console.log(`Subject: Your Vanyshr Verification Code`);
      console.log(`Hi ${firstName}, your verification code is: ${code}`);
      console.log(`This code expires in 10 minutes.`);
      console.log('====================================');
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send email, but code logged to console' 
      };
    }
  },

};
