// Utils/mailContentProvider.js

const getOtpEmailHtml = ({ name, otp }) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Leather Haven - OTP Verification</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f2ee;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ee;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;border:1px solid #e5e0d8;overflow:hidden;">
            
            <!-- Header / Brand -->
            <tr>
              <td style="padding:32px 32px 16px 32px;text-align:center;">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;letter-spacing:4px;font-weight:300;color:#2a2018;line-height:1.2;">
                  LEATHER<br />HAVEN
                </h1>
                <div style="height:2px;width:48px;margin:16px auto;background:linear-gradient(to right,transparent,#b38352,transparent);"></div>
                <p style="margin:0;font-size:11px;letter-spacing:2px;color:#8a7d6a;text-transform:uppercase;">
                  Premium Crafted Leather
                </p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <p style="margin:0 0 8px 0;font-size:14px;color:#4b3b2b;">
                  Hi ${name || "there"},
                </p>
                <p style="margin:0 0 16px 0;font-size:14px;color:#4b3b2b;line-height:1.5;">
                  Use the one-time passcode below to verify your email and create your Leather Haven account.
                </p>
              </td>
            </tr>

            <!-- OTP Box -->
            <tr>
              <td style="padding:0 32px 8px 32px;text-align:center;">
                <div style="
                  display:inline-block;
                  padding:12px 24px;
                  border-radius:12px;
                  background:linear-gradient(135deg,#2a2018,#4c3322);
                  color:#fdf8f2;
                  letter-spacing:6px;
                  font-size:24px;
                  font-weight:600;
                  font-family:'SF Mono', ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                ">
                  ${otp}
                </div>
              </td>
            </tr>

            <!-- Expiry info -->
            <tr>
              <td style="padding:8px 32px 8px 32px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#7b6a57;">
                  This code will expire in <strong>10 minutes</strong>.
                </p>
              </td>
            </tr>

            <!-- Warning -->
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0;font-size:12px;color:#7b6a57;line-height:1.5;">
                  If you didn’t request this, you can safely ignore this email. 
                  Someone may have typed your address by mistake.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 32px 24px 32px;text-align:center;">
                <p style="margin:0 0 4px 0;font-size:11px;color:#b0a393;">
                  Leather Haven · Timeless leather goods crafted to last
                </p>
                <p style="margin:0;font-size:11px;color:#b0a393;">
                  © ${new Date().getFullYear()} Leather Haven. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};
const getResetPasswordEmailHtml = ({ name, otp }) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Leather Haven - Reset Password</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f2ee;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ee;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;border:1px solid #e5e0d8;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 16px 32px;text-align:center;">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;letter-spacing:4px;font-weight:300;color:#2a2018;line-height:1.2;">
                  LEATHER<br />HAVEN
                </h1>
                <div style="height:2px;width:48px;margin:16px auto;background:linear-gradient(to right,transparent,#b38352,transparent);"></div>
                <p style="margin:0;font-size:11px;letter-spacing:2px;color:#8a7d6a;text-transform:uppercase;">
                  Premium Crafted Leather
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <p style="margin:0 0 8px 0;font-size:14px;color:#4b3b2b;">
                  Hi ${name || "there"},
                </p>
                <p style="margin:0 0 16px 0;font-size:14px;color:#4b3b2b;line-height:1.5;">
                  You requested to reset your Leather Haven password. Use the code below to continue.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px 32px;text-align:center;">
                <div style="
                  display:inline-block;
                  padding:12px 24px;
                  border-radius:12px;
                  background:linear-gradient(135deg,#2a2018,#4c3322);
                  color:#fdf8f2;
                  letter-spacing:6px;
                  font-size:24px;
                  font-weight:600;
                  font-family:'SF Mono', ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                ">
                  ${otp}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px 32px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#7b6a57;">
                  This code will expire in <strong>10 minutes</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0;font-size:12px;color:#7b6a57;line-height:1.5;">
                  If you didn’t request this, you can ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;text-align:center;">
                <p style="margin:0 0 4px 0;font-size:11px;color:#b0a393;">
                  Leather Haven · Timeless leather goods crafted to last
                </p>
                <p style="margin:0;font-size:11px;color:#b0a393;">
                  © ${new Date().getFullYear()} Leather Haven. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

module.exports = {
  getOtpEmailHtml,getResetPasswordEmailHtml
};
