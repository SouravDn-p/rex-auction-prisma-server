export const otpVerificationTemplate = (name: string, otp: string, expiresInMin: number): string => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f5; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px;">
    <h2 style="color: #1a1a1a; margin-top: 0;">Verify your email</h2>
    <p style="color: #444;">Hi ${name},</p>
    <p style="color: #444;">Use the code below to verify your Rex Auction account. This code expires in ${expiresInMin} minutes.</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; background: #f0f0f0; padding: 16px 24px; border-radius: 8px;">${otp}</span>
    </div>
    <p style="color: #888; font-size: 13px;">If you didn't create an account, you can safely ignore this email.</p>
  </div>
</body>
</html>
`;

export const passwordResetTemplate = (name: string, otp: string, expiresInMin: number): string => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f5; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px;">
    <h2 style="color: #1a1a1a; margin-top: 0;">Reset your password</h2>
    <p style="color: #444;">Hi ${name},</p>
    <p style="color: #444;">Use the code below to reset your password. This code expires in ${expiresInMin} minutes.</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; background: #f0f0f0; padding: 16px 24px; border-radius: 8px;">${otp}</span>
    </div>
    <p style="color: #888; font-size: 13px;">If you didn't request this, please ignore this email or contact support.</p>
  </div>
</body>
</html>
`;

export const welcomeEmailTemplate = (name: string): string => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f5; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px;">
    <h2 style="color: #1a1a1a; margin-top: 0;">Welcome to Rex Auction, ${name}!</h2>
    <p style="color: #444;">Your account is verified and ready to go. Start exploring live auctions now.</p>
  </div>
</body>
</html>
`;