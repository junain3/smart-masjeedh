import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role, permissions, commission_percent, masjid_id } = body;

    console.log('🔍 ENVIRONMENT DEBUG:');
    console.log('🔍 NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);

    // Validate required fields
    if (!email || !role || !masjid_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: email, role, masjid_id' 
      }, { status: 400 });
    }

    // Generate invitation token
    const invitationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Generate registration link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `/invite-register?token=${invitationToken}`;
    const fullRegistrationLink = `${baseUrl}${inviteLink}`;

    console.log('📧 INVITATION DETAILS:');
    console.log('📧 Email:', email);
    console.log('📧 Role:', role);
    console.log('📧 Masjid ID:', masjid_id);
    console.log('📧 Invitation Token:', invitationToken);

    // Send invitation email using Supabase Auth Admin API
    try {
      console.log('[Invite User] Sending invitation email via Supabase Auth to:', email);
      console.log('[Invite User] SMTP Settings Check:', {
        hasSmtpHost: !!process.env.SMTP_HOST,
        hasSmtpPort: !!process.env.SMTP_PORT,
        hasSmtpUser: !!process.env.SMTP_USER,
        hasSmtpPassword: !!process.env.SMTP_PASSWORD,
        hasSmtpFrom: !!process.env.SMTP_FROM
      });

      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?token=${invitationToken}&type=invite`,
        data: {
          role: role,
          masjid_id: masjidId,
          invitation_token: invitationToken
        }
      });

      if (inviteError) {
        console.error('[Invite User] Supabase invite error:', inviteError);
        return NextResponse.json({
          success: false,
          error: `Failed to send invitation email: ${inviteError.message}. Please check your SMTP configuration.`,
          details: inviteError
        }, { status: 500 });
      }

      console.log('[Invite User] Invitation email sent successfully via Supabase:', inviteData);

    } catch (emailError: any) {
      console.error('[Invite User] Email sending exception:', emailError);
      return NextResponse.json({
        success: false,
        error: `Failed to send invitation email: ${emailError.message}. Please check your SMTP configuration.`,
        details: emailError.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Invitation sent successfully',
      invite_link: inviteLink,
      invitationToken: invitationToken,
      registrationLink: fullRegistrationLink
    });

  } catch (error) {
    console.error('Invite API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to send invitation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
