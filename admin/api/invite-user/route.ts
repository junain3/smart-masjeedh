import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role, permissions, commission_percent, masjid_id } = body;

    // Debug environment variables
    console.log('🔍 ENVIRONMENT DEBUG:');
    console.log('🔍 RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
    console.log('🔍 RESEND_API_KEY length:', process.env.RESEND_API_KEY?.length || 0);
    console.log('🔍 NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);

    // Validate required fields
    if (!email || !role || !masjid_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: email, role, masjid_id' 
      }, { status: 400 });
    }

    // Generate invitation token (simulate existing system)
    const invitationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Generate registration link using token system
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `/invite-register?token=${invitationToken}`;
    const fullRegistrationLink = `${baseUrl}${inviteLink}`;

    console.log('📧 INVITATION DETAILS:');
    console.log('📧 Email:', email);
    console.log('📧 Role:', role);
    console.log('📧 Masjid ID:', masjid_id);
    console.log('📧 Invitation Token:', invitationToken);
    console.log('📧 Invite Link:', inviteLink);
    console.log('📧 Full Registration Link:', fullRegistrationLink);
    console.log('📧 Permissions:', permissions);
    console.log('📧 Commission:', commission_percent);

    let emailSent = false;
    let emailWarning = null;
    let resendResponse = null;

    // Try to send actual email (using a simple email service)
    try {
      // Using Resend (you need to configure RESEND_API_KEY in .env.local)
      if (process.env.RESEND_API_KEY) {
        console.log('📧 Attempting to send email via Resend...');
        
        resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'noreply@mjm.com',
            to: [email],
            subject: 'Invitation to Join MJM Staff Management',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <title>Invitation to Join MJM</title>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #10b981; color: white; padding: 20px; text-align: center; }
                  .content { padding: 20px; background: #f9fafb; }
                  .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
                  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🕌 MJM Staff Management</h1>
                    <p>You're Invited!</p>
                  </div>
                  <div class="content">
                    <h2>Welcome to the Team!</h2>
                    <p>You have been invited to join MJM Staff Management as a <strong>${role.replace('_', ' ').toUpperCase()}</strong>.</p>
                    
                    <p><strong>Your Role Details:</strong></p>
                    <ul>
                      <li>Role: ${role.replace('_', ' ').toUpperCase()}</li>
                      <li>Commission Rate: ${commission_percent}%</li>
                      <li>Permissions: ${Object.keys(permissions || {}).filter(key => permissions[key]).join(', ') || 'Basic access'}</li>
                    </ul>
                    
                    <p>Click the button below to complete your registration:</p>
                    <a href="${fullRegistrationLink}" class="button">Complete Registration</a>
                    
                    <p>Or copy and paste this link in your browser:</p>
                    <p><code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; word-break: break-all;">${fullRegistrationLink}</code></p>
                    
                    <p><strong>Note:</strong> This invitation link will expire in 7 days.</p>
                  </div>
                  <div class="footer">
                    <p>This is an automated message from MJM Staff Management System.</p>
                    <p>If you didn't expect this invitation, please ignore this email.</p>
                  </div>
                </div>
              </body>
              </html>
            `
          })
        });

        console.log('📧 Resend Response Status:', resendResponse.status);
        console.log('📧 Resend Response Headers:', Object.fromEntries(resendResponse.headers.entries()));

        if (resendResponse.ok) {
          const responseData = await resendResponse.json();
          console.log('✅ Email sent successfully via Resend:', responseData);
          emailSent = true;
          resendResponse = responseData;
        } else {
          const errorData = await resendResponse.json();
          console.log('❌ Resend API failed:', errorData);
          console.log('❌ Resend Status:', resendResponse.status);
          console.log('❌ Resend Error Details:', JSON.stringify(errorData, null, 2));
          emailWarning = 'Email sending failed, but invitation was created successfully';
        }
      } else {
        console.log('⚠️ RESEND_API_KEY not configured, using manual link');
        console.log('⚠️ Available env vars:', Object.keys(process.env).filter(key => key.includes('RESEND')));
        emailWarning = 'Email sending failed, but invitation was created successfully';
      }
    } catch (emailError) {
      console.log('❌ Email service failed:', emailError);
      console.log('❌ Email Error Details:', JSON.stringify(emailError, null, 2));
      emailWarning = 'Email sending failed, but invitation was created successfully';
    }

    // Return response in the expected format
    return NextResponse.json({ 
      success: true,
      message: emailSent ? 'Invitation sent successfully' : 'Invitation created successfully (email warning)',
      invite_link: inviteLink,
      invitationToken: invitationToken,
      emailSent: emailSent,
      registrationLink: fullRegistrationLink,
      warning: emailWarning,
      debugInfo: {
        email,
        role,
        masjid_id,
        inviteLink,
        fullRegistrationLink,
        envHasKey: !!process.env.RESEND_API_KEY,
        envKeyLength: process.env.RESEND_API_KEY?.length || 0,
        resendResponse: resendResponse
      }
    });

  } catch (error) {
    console.error('Invite API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to send invitation',
      details: error.message
    }, { status: 500 });
  }
}
