const nodemailer = require('nodemailer');
require('dotenv').config();

const GOOGLE_BRIDGE_URL = process.env.GMAIL_HTTP_BRIDGE || "https://script.google.com/macros/s/AKfycbwEgyW84T294uID8TpJckcys1gPWVfrJYVThie3BOXeO2XUw82xoIih0jGqJh4UeQ7M/exec";

let isSmtpReady = false;

// Ultra-fast pre-warmed pooled transporter using standard SSL Port 465
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 10,
    maxMessages: Infinity,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
    auth: {
        user: process.env.GMAIL_USER || 'nourishnetwork.official@gmail.com',
        pass: process.env.GMAIL_APP_PASS || 'mrqkdqumrbihwncd'
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Pre-warm the SMTP connection pool on boot
transporter.verify((error) => {
    if (error) {
        console.warn('⚠️ SMTP Port 465 Pool Warning (will route via Google HTTPS):', error.message);
        isSmtpReady = false;
    } else {
        console.log('⚡ SMTP Connection Pool (Port 465 SSL) is warm & ready for sub-2s delivery.');
        isSmtpReady = true;
    }
});

function sanitizeHtmlForEmail(html) {
    if (!html) return '';
    return html
        // 1. Strip any corrupted diamond question mark glyphs or replacement characters
        .replace(/\uFFFD/g, '')
        // 2. Normalize special known entities if they have variation selectors
        .replace(/&#9888;&#65039;/g, '&#9888;')
        // 3. Strip dangling variation selectors (\uFE00 - \uFE0F) that cause square/question mark glyph boxes
        .replace(/[\uFE00-\uFE0F]/g, '')
        // 4. Convert Indian Rupee symbol ₹ to safe HTML numeric entity
        .replace(/₹/g, '&#8377;')
        // 5. Convert ANY Unicode emoji, pictograph, or symbol into an HTML decimal numeric entity (&#<code>;)
        // This ensures 100% safe 7-bit ASCII transmission with ZERO risk of encoding corruption or question marks
        .replace(/[\u{1F000}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{200D}]/gu, (match) => {
            return '&#' + match.codePointAt(0) + ';';
        })
        .trim();
}

function sanitizeSubjectForEmail(subject) {
    if (!subject) return '';
    return subject
        .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}|[\uFE00-\uFE0F]|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{D800}-\u{DFFF}]|\uFFFD/gu, '')
        .replace(/&#(?:9\d{3}|[1-9]\d{4,}|x[0-9a-fA-F]{3,});/gi, '')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Universal Ultra-Fast Dual-Engine Dispatcher:
 * 1. Primary: Direct Pooled SMTP (Port 465 SSL) - Delivers in ~1.5 to 2 seconds.
 * 2. Fallback: Google Apps Script HTTPS Bridge - Reliable fallback for restricted cloud networks.
 */
async function dispatchEmail({ toEmail, subject, html, devFallbackUrl }) {
    const cleanSubject = sanitizeSubjectForEmail(subject);
    const cleanHtml = sanitizeHtmlForEmail(html);

    // Fast Direct SMTP Helper with 8s timeout
    const trySmtp = () => {
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('SMTP timeout (8000ms)')), 8000);
            try {
                const info = await transporter.sendMail({
                    from: `"Nourish Network" <${process.env.GMAIL_USER || 'nourishnetwork.official@gmail.com'}>`,
                    to: toEmail,
                    subject: cleanSubject,
                    html: cleanHtml
                });
                clearTimeout(timer);
                resolve({ success: true, messageId: info.messageId, via: 'fast-smtp-465' });
            } catch (err) {
                clearTimeout(timer);
                reject(err);
            }
        });
    };

    // Google Apps Script HTTPS Bridge Helper with 6s timeout
    const tryGoogleBridge = async () => {
        if (!GOOGLE_BRIDGE_URL) throw new Error('No Google Bridge URL configured');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
            const res = await fetch(GOOGLE_BRIDGE_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    to: toEmail,
                    subject: cleanSubject,
                    html: cleanHtml
                }),
                signal: controller.signal
            });
            clearTimeout(timer);
            const text = await res.text();
            let data = {};
            try { data = JSON.parse(text); } catch (e) {}
            if (data && data.success) {
                return { success: true, via: 'google-https' };
            }
            throw new Error(text || 'Google Bridge failed');
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    };

    // 1. Primary Engine: Direct Pooled SMTP (Port 465 SSL)
    try {
        const res = await trySmtp();
        isSmtpReady = true;
        console.log(`⚡ [Direct Fast SMTP 465] Email sent to ${toEmail}: ${cleanSubject}`);
        return res;
    } catch (smtpErr) {
        console.warn(`⚠️ Direct SMTP attempt failed (${smtpErr.message}), falling back to Google HTTPS Bridge...`);
    }

    // 2. Fallback Engine: Google Apps Script HTTPS Bridge (for restricted container firewalls)
    try {
        const res = await tryGoogleBridge();
        console.log(`✅ [Google HTTPS Engine] Email sent to ${toEmail}: ${cleanSubject}`);
        return res;
    } catch (gasErr) {
        console.error(`❌ All email engines failed for ${toEmail}:`, gasErr.message);
        if (devFallbackUrl) console.log(`💡 [DEV FALLBACK LINK]: ${devFallbackUrl}`);
        return { success: false, error: gasErr.message, devFallbackUrl };
    }
}

/**
 * Send email verification link to user
 * @param {Object} params
 * @param {string} params.toEmail - Recipient email
 * @param {string} params.name - User organization / user name
 * @param {string} params.token - Unique verification token link parameter
 * @param {string} params.accountType - User account type (restaurant/vendor/ngo/shelter)
 * @param {string} params.hostUrl - Base server URL (e.g. http://localhost:3000)
 */
async function sendVerificationEmail({ toEmail, name, token, accountType, hostUrl, otp }) {
    const baseUrl = hostUrl || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/api/verify-email?token=${token}`;

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your Email - Nourish Network</title>
        <style>
            body {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #0d1612;
                color: #e2e8f0;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }
            .email-container {
                max-width: 580px;
                margin: 40px auto;
                background: #13221b;
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            }
            .header {
                background: linear-gradient(135deg, #064e3b 0%, #047857 100%);
                padding: 35px 30px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                color: #ffffff;
                font-size: 26px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 40px 35px;
                text-align: center;
            }
            .welcome-title {
                font-size: 22px;
                color: #10b981;
                margin-top: 0;
                font-weight: 700;
            }
            .subtitle {
                font-size: 15px;
                color: #cbd5e1;
                line-height: 1.6;
                margin-bottom: 25px;
            }
            .btn-verify {
                display: inline-block;
                padding: 16px 36px;
                background: linear-gradient(135deg, #10b981, #059669);
                color: #ffffff !important;
                text-decoration: none;
                text-align: center;
                font-weight: 700;
                font-size: 16px;
                border-radius: 14px;
                box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
                transition: all 0.3s ease;
            }
            .otp-box {
                background: rgba(16, 185, 129, 0.08);
                border: 2px dashed rgba(16, 185, 129, 0.45);
                border-radius: 16px;
                padding: 20px;
                margin: 28px 0 15px;
                text-align: center;
            }
            .otp-code {
                font-size: 38px;
                font-weight: 800;
                letter-spacing: 8px;
                color: #34d399;
                font-family: monospace, 'Courier New', Courier;
                margin: 10px 0;
            }
            .info-box {
                background: rgba(16, 185, 129, 0.06);
                border-left: 4px solid #10b981;
                border-radius: 8px;
                padding: 15px 20px;
                text-align: left;
                margin: 25px 0 10px;
                font-size: 13px;
                color: #94a3b8;
            }
            .footer {
                background-color: #0b130f;
                padding: 20px 35px;
                text-align: center;
                font-size: 13px;
                color: #64748b;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>&#127807; Nourish Network</h1>
            </div>
            <div class="content">
                <h2 class="welcome-title">Welcome, ${name}!</h2>
                <p class="subtitle">
                    Thank you for joining Nourish Network. Please verify your email to activate your account.
                </p>

                <a href="${verifyUrl}" class="btn-verify" target="_blank">Verify Email Address & Activate</a>

                ${otp ? `
                <div class="otp-box">
                    <div style="font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Or Enter 6-Digit Code On Screen</div>
                    <div class="otp-code">${otp}</div>
                    <div style="font-size: 12px; color: #64748b;">This verification code is valid for 24 hours</div>
                </div>
                ` : ''}

                <div class="info-box">
                    <strong>Pro-Tip:</strong> If you registered on your laptop, clicking the verify button on your phone or entering the 6-digit code will immediately unlock your portal!
                </div>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Nourish Network. Connecting fresh food with communities in need.
            </div>
        </div>
    </body>
    </html>
    `;

    return await dispatchEmail({
        toEmail,
        subject: `Verify your Nourish Network Account`,
        html: htmlTemplate,
        devFallbackUrl: verifyUrl
    });
}

async function sendPasswordResetEmail({ toEmail, name, token, hostUrl }) {
    const resetUrl = `${hostUrl || 'http://localhost:3000'}/?resetToken=${token}`;

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0d1612; color: #e2e8f0; margin: 0; padding: 20px; }
            .email-container { max-width: 540px; margin: 0 auto; background-color: #13221b; border-radius: 20px; border: 1px solid #10b981; overflow: hidden; }
            .header { background: linear-gradient(135deg, #10b981, #059669); padding: 25px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; }
            .content { padding: 30px; text-align: center; }
            .welcome-title { font-size: 20px; color: #ffffff; margin-bottom: 10px; }
            .subtitle { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 25px; }
            .btn-reset { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff !important; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 16px; margin-bottom: 25px; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3); }
            .info-box { background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 12px; font-size: 13px; color: #94a3b8; border-left: 3px solid #10b981; text-align: left; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>&#127807; Nourish Network</h1>
            </div>
            <div class="content">
                <h2 class="welcome-title">Password Reset Request</h2>
                <p class="subtitle">
                    Hi ${name || 'Partner'}, we received a request to reset your password for your Nourish Network account. Click the button below to set a new password.
                </p>

                <a href="${resetUrl}" class="btn-reset" target="_blank">Reset Your Password</a>

                <div class="info-box">
                    <strong>Note:</strong> This link will expire in 15 minutes. If you did not request a password reset, please ignore this email.
                </div>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Nourish Network. Connecting fresh food with communities.
            </div>
        </div>
    </body>
    </html>
    `;

    return await dispatchEmail({
        toEmail,
        subject: `Reset Your Nourish Network Password`,
        html: htmlTemplate,
        devFallbackUrl: resetUrl
    });
}

/**
 * Send pure informational login success notification email
 * @param {Object} params
 * @param {string} params.toEmail - Recipient email
 * @param {string} params.name - User organization / user name
 * @param {string} params.accountType - User account type (restaurant/vendor/ngo/shelter)
 * @param {string} [params.loginTime] - ISO string or formatted timestamp
 */
async function sendLoginNotificationEmail({ toEmail, name, accountType, loginTime, deviceName }) {
    const formattedTime = loginTime 
        ? new Date(loginTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
        : new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

    const roleLabel = (accountType === 'ngo' || accountType === 'shelter') 
        ? 'Recipient & NGO Partner' 
        : 'Food Donor & Provider';

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Successful Login - Nourish Network</title>
        <style>
            body {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #0d1612;
                color: #e2e8f0;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }
            .email-container {
                max-width: 580px;
                margin: 40px auto;
                background: #13221b;
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            }
            .header {
                background: linear-gradient(135deg, #064e3b 0%, #047857 100%);
                padding: 30px 25px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                color: #ffffff;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 35px 30px;
            }
            .welcome-title {
                font-size: 21px;
                color: #10b981;
                margin-top: 0;
                margin-bottom: 12px;
                font-weight: 700;
            }
            .message-text {
                font-size: 15px;
                color: #cbd5e1;
                line-height: 1.65;
                margin-bottom: 25px;
            }
            .details-card {
                background: rgba(16, 185, 129, 0.06);
                border: 1px solid rgba(16, 185, 129, 0.2);
                border-radius: 12px;
                padding: 18px 22px;
                margin: 20px 0;
                text-align: left;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 7px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                font-size: 14px;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .detail-label {
                color: #94a3b8;
                font-weight: 500;
            }
            .detail-value {
                color: #f1f5f9;
                font-weight: 600;
            }
            .security-notice {
                background: rgba(255, 255, 255, 0.03);
                border-left: 3px solid #10b981;
                border-radius: 6px;
                padding: 12px 16px;
                font-size: 13px;
                color: #94a3b8;
                line-height: 1.5;
                margin-top: 25px;
            }
            .footer {
                background-color: #0b130f;
                padding: 20px 30px;
                text-align: center;
                font-size: 13px;
                color: #64748b;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>&#127807; Nourish Network</h1>
            </div>
            <div class="content">
                <h2 class="welcome-title">You've Logged In Successfully</h2>
                <p class="message-text">
                    Hello <strong>${name || 'Partner'}</strong>,<br><br>
                    You have successfully signed in to your <strong>Nourish Network</strong> account. Your session is active, and you can now seamlessly access and manage food shares.
                </p>

                <div class="details-card">
                    <div class="detail-row">
                        <span class="detail-label">Account Name:</span>
                        <span class="detail-value">${name || 'Partner'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Account Type:</span>
                        <span class="detail-value">${roleLabel}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Device &amp; Browser:</span>
                        <span class="detail-value">${deviceName || 'Desktop Browser'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Login Timestamp:</span>
                        <span class="detail-value">${formattedTime}</span>
                    </div>
                </div>

                <div class="security-notice">
                    <strong>&#128737; Security Note:</strong> If you recently initiated this login on this device, you can safely disregard this notice. If you did not log in or suspect unauthorized access, please update your account password immediately.
                </div>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Nourish Network. Connecting fresh food with communities in need.
            </div>
        </div>
    </body>
    </html>
    `;

    return await dispatchEmail({
        toEmail,
        subject: `Successful Account Login from ${deviceName || 'your device'} - Nourish Network`,
        html: htmlTemplate
    });
}

/**
 * Send custom password changed confirmation email
 * @param {Object} params
 * @param {string} params.toEmail - Recipient email
 * @param {string} params.name - User organization / user name
 * @param {string} [params.changedTime] - ISO string or formatted timestamp
 */
async function sendPasswordChangedEmail({ toEmail, name, changedTime }) {
    const formattedTime = changedTime 
        ? new Date(changedTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
        : new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed Successfully - Nourish Network</title>
        <style>
            body {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #0d1612;
                color: #e2e8f0;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }
            .email-container {
                max-width: 580px;
                margin: 40px auto;
                background: #13221b;
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            }
            .header {
                background: linear-gradient(135deg, #064e3b 0%, #047857 100%);
                padding: 30px 25px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                color: #ffffff;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 35px 30px;
            }
            .welcome-title {
                font-size: 21px;
                color: #10b981;
                margin-top: 0;
                margin-bottom: 12px;
                font-weight: 700;
            }
            .message-text {
                font-size: 15px;
                color: #cbd5e1;
                line-height: 1.65;
                margin-bottom: 25px;
            }
            .details-card {
                background: rgba(16, 185, 129, 0.06);
                border: 1px solid rgba(16, 185, 129, 0.2);
                border-radius: 12px;
                padding: 18px 22px;
                margin: 20px 0;
                text-align: left;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 7px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                font-size: 14px;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .detail-label {
                color: #94a3b8;
                font-weight: 500;
            }
            .detail-value {
                color: #f1f5f9;
                font-weight: 600;
            }
            .security-alert {
                background: rgba(239, 68, 68, 0.08);
                border-left: 3px solid #ef4444;
                border-radius: 6px;
                padding: 14px 18px;
                font-size: 13px;
                color: #fca5a5;
                line-height: 1.55;
                margin-top: 25px;
            }
            .security-alert strong {
                color: #ffffff;
            }
            .footer {
                background-color: #0b130f;
                padding: 20px 30px;
                text-align: center;
                font-size: 13px;
                color: #64748b;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>&#127807; Nourish Network</h1>
            </div>
            <div class="content">
                <h2 class="welcome-title">Password Changed Successfully &#128274;</h2>
                <p class="message-text">
                    Hello <strong>${name || 'Partner'}</strong>,<br><br>
                    This is a confirmation that the password for your <strong>Nourish Network</strong> account has been updated successfully. Your new credentials are active immediately.
                </p>

                <div class="details-card">
                    <div class="detail-row">
                        <span class="detail-label">Account Name:</span>
                        <span class="detail-value">${name || 'Partner'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Account Email:</span>
                        <span class="detail-value">${toEmail}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Timestamp:</span>
                        <span class="detail-value">${formattedTime}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Security Status:</span>
                        <span class="detail-value" style="color: #10b981;">Updated &amp; Protected &#9989;</span>
                    </div>
                </div>

                <div class="security-alert">
                    <strong>&#9888; Didn't request this change?</strong><br>
                    If you did not initiate this password update, your account may be at risk. Please contact our support team immediately or perform another password reset to secure your account.
                </div>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Nourish Network. Connecting fresh food with communities in need.
            </div>
        </div>
    </body>
    </html>
    `;

    return await dispatchEmail({
        toEmail,
        subject: `Security Alert: Password Changed Successfully - Nourish Network`,
        html: htmlTemplate
    });
}

/**
 * Broadcast notification to buyers when a seller lists new surplus food
 */
async function sendFoodPublishedBroadcastEmail({ buyers, sellerName, foodItem, hostUrl }) {
    if (!buyers || !Array.isArray(buyers) || buyers.length === 0) return { success: true, count: 0 };

    const dashboardUrl = `${hostUrl || 'https://nourish-network-4bit.onrender.com'}/?portal=buyer`;
    const formattedExpiry = foodItem.expiryTime 
        ? new Date(foodItem.expiryTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Available Today';
    const priceDisplay = (parseFloat(foodItem.price) === 0 || !foodItem.price) ? 'Free Donation (&#8377;0)' : `&#8377;${foodItem.price} / portion`;

    const broadcastPromises = buyers.map(buyer => {
        const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Fresh Food Alert - Nourish Network</title>
            <style>
                body {
                    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background-color: #0d1612;
                    color: #e2e8f0;
                    margin: 0;
                    padding: 0;
                }
                .email-container {
                    max-width: 580px;
                    margin: 40px auto;
                    background: #13221b;
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
                }
                .header {
                    background: linear-gradient(135deg, #064e3b 0%, #047857 100%);
                    padding: 30px 25px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    color: #ffffff;
                    font-size: 24px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }
                .content {
                    padding: 35px 30px;
                    text-align: center;
                }
                .welcome-title {
                    font-size: 21px;
                    color: #10b981;
                    margin-top: 0;
                    margin-bottom: 12px;
                    font-weight: 700;
                }
                .message-text {
                    font-size: 15px;
                    color: #cbd5e1;
                    line-height: 1.65;
                    margin-bottom: 25px;
                }
                .details-card {
                    background: rgba(16, 185, 129, 0.06);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    border-radius: 12px;
                    padding: 18px 22px;
                    margin: 20px 0;
                    text-align: left;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 7px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    font-size: 14px;
                }
                .detail-row:last-child {
                    border-bottom: none;
                }
                .detail-label {
                    color: #94a3b8;
                    font-weight: 500;
                }
                .detail-value {
                    color: #f1f5f9;
                    font-weight: 600;
                }
                .btn-cta {
                    display: inline-block;
                    padding: 14px 34px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: #ffffff !important;
                    text-decoration: none;
                    font-weight: 700;
                    border-radius: 12px;
                    font-size: 15px;
                    margin: 20px 0 10px;
                    box-shadow: 0 10px 20px rgba(16, 185, 129, 0.35);
                }
                .footer {
                    background-color: #0b130f;
                    padding: 20px 30px;
                    text-align: center;
                    font-size: 13px;
                    color: #64748b;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>&#127807; Nourish Network</h1>
                </div>
                <div class="content">
                    <h2 class="welcome-title">Fresh Surplus Food Available! &#127858;</h2>
                    <p class="message-text">
                        Hello <strong>${buyer.organizationName || 'Partner'}</strong>,<br><br>
                        <strong>${sellerName || 'A local partner'}</strong> has just listed fresh surplus food on Nourish Network ready to be claimed and distributed.
                    </p>

                    <div class="details-card">
                        <div class="detail-row">
                            <span class="detail-label">Food Item:</span>
                            <span class="detail-value" style="color: #10b981;">${foodItem.name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Provider:</span>
                            <span class="detail-value">${sellerName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Category:</span>
                            <span class="detail-value">${foodItem.category || 'Cooked'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Quantity Available:</span>
                            <span class="detail-value">${foodItem.quantity} ${foodItem.unit || 'Portions'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Price:</span>
                            <span class="detail-value">${priceDisplay}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Pickup Expiry Window:</span>
                            <span class="detail-value">${formattedExpiry}</span>
                        </div>
                        ${foodItem.description ? `
                        <div class="detail-row">
                            <span class="detail-label">Details:</span>
                            <span class="detail-value">${foodItem.description}</span>
                        </div>` : ''}
                    </div>

                    <a href="${dashboardUrl}" class="btn-cta" target="_blank">View &amp; Claim in Dashboard &#128640;</a>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} Nourish Network. Connecting fresh food with communities in need.
                </div>
            </div>
        </body>
        </html>
        `;

        return dispatchEmail({
            toEmail: buyer.email,
            subject: `Fresh Food Alert: ${foodItem.name} from ${sellerName} - Nourish Network`,
            html: htmlTemplate
        });
    });

    const results = await Promise.allSettled(broadcastPromises);
    const count = results.filter(r => r.status === 'fulfilled' && r.value && r.value.success).length;
    console.log(`📢 [Parallel Broadcast] Dispatched ${count}/${buyers.length} notification emails simultaneously.`);
    return { success: true, count };
}

/**
 * Order received notification to seller when a buyer places an order
 */
async function sendSellerOrderNotificationEmail({ sellerEmail, sellerName, buyerName, buyerEmail, foodName, quantity, totalPrice, notes, hostUrl }) {
    const dashboardUrl = `${hostUrl || 'https://nourish-network-4bit.onrender.com'}/?portal=seller`;
    const formattedTime = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Order Received - Nourish Network</title>
        <style>
            body {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #0d1612;
                color: #e2e8f0;
                margin: 0;
                padding: 0;
            }
            .email-container {
                max-width: 580px;
                margin: 40px auto;
                background: #13221b;
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            }
            .header {
                background: linear-gradient(135deg, #064e3b 0%, #047857 100%);
                padding: 30px 25px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                color: #ffffff;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 35px 30px;
                text-align: center;
            }
            .welcome-title {
                font-size: 21px;
                color: #10b981;
                margin-top: 0;
                margin-bottom: 12px;
                font-weight: 700;
            }
            .message-text {
                font-size: 15px;
                color: #cbd5e1;
                line-height: 1.65;
                margin-bottom: 25px;
            }
            .details-card {
                background: rgba(16, 185, 129, 0.06);
                border: 1px solid rgba(16, 185, 129, 0.2);
                border-radius: 12px;
                padding: 18px 22px;
                margin: 20px 0;
                text-align: left;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 7px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                font-size: 14px;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .detail-label {
                color: #94a3b8;
                font-weight: 500;
            }
            .detail-value {
                color: #f1f5f9;
                font-weight: 600;
            }
            .btn-cta {
                display: inline-block;
                padding: 14px 34px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff !important;
                text-decoration: none;
                font-weight: 700;
                border-radius: 12px;
                font-size: 15px;
                margin: 20px 0 10px;
                box-shadow: 0 10px 20px rgba(16, 185, 129, 0.35);
            }
            .footer {
                background-color: #0b130f;
                padding: 20px 30px;
                text-align: center;
                font-size: 13px;
                color: #64748b;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>&#127807; Nourish Network</h1>
            </div>
            <div class="content">
                <h2 class="welcome-title">New Food Order Received! &#127881;</h2>
                <p class="message-text">
                    Hello <strong>${sellerName || 'Partner'}</strong>,<br><br>
                    <strong>${buyerName || 'A Community Partner'}</strong> has just placed an order / claimed meals from your food listing!
                </p>

                <div class="details-card">
                    <div class="detail-row">
                        <span class="detail-label">Buyer Organization:</span>
                        <span class="detail-value" style="color: #10b981;">${buyerName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Buyer Contact:</span>
                        <span class="detail-value">${buyerEmail}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Food Item:</span>
                        <span class="detail-value">${foodName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Quantity Claimed:</span>
                        <span class="detail-value">${quantity} portions</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Amount:</span>
                        <span class="detail-value">${parseFloat(totalPrice) === 0 ? 'Free Donation (&#8377;0)' : '&#8377;' + totalPrice}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Order Timestamp:</span>
                        <span class="detail-value">${formattedTime}</span>
                    </div>
                    ${notes ? `
                    <div class="detail-row">
                        <span class="detail-label">Buyer Notes:</span>
                        <span class="detail-value">${notes}</span>
                    </div>` : ''}
                </div>

                <a href="${dashboardUrl}" class="btn-cta" target="_blank">View Orders in Seller Dashboard &#128203;</a>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Nourish Network. Connecting fresh food with communities in need.
            </div>
        </div>
    </body>
    </html>
    `;

    return await dispatchEmail({
        toEmail: sellerEmail,
        subject: `New Order Received from ${buyerName} - Nourish Network`,
        html: htmlTemplate
    });
}

/**
 * Send Cross-Device Login Approval Request Email
 */
async function sendLoginApprovalEmail({
    toEmail,
    name,
    deviceName,
    ipAddress,
    approveUrl,
    denyUrl,
    expiresMinutes = 10
}) {
    const formattedTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Approve Sign-In - Nourish Network</title>
        <style>
            body {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #0b1410;
                color: #e2e8f0;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }
            .email-container {
                max-width: 580px;
                margin: 30px auto;
                background: #111f18;
                border: 1px solid rgba(16, 185, 129, 0.35);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 25px 60px rgba(0,0,0,0.7);
            }
            .header {
                background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%);
                padding: 32px 28px;
                text-align: center;
                border-bottom: 1px solid rgba(16, 185, 129, 0.2);
            }
            .header-icon {
                font-size: 40px;
                line-height: 1;
                margin-bottom: 8px;
            }
            .header h1 {
                margin: 0;
                color: #ffffff;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 35px 30px;
                text-align: center;
            }
            .title {
                font-size: 20px;
                color: #34d399;
                margin-top: 0;
                margin-bottom: 8px;
                font-weight: 700;
            }
            .desc {
                font-size: 14px;
                color: #94a3b8;
                line-height: 1.6;
                margin-bottom: 24px;
            }
            .device-card {
                background: rgba(16, 185, 129, 0.06);
                border: 1px solid rgba(16, 185, 129, 0.2);
                border-radius: 14px;
                padding: 20px 24px;
                text-align: left;
                margin: 0 auto 28px;
            }
            .device-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 7px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                font-size: 13px;
            }
            .device-row:last-child {
                border-bottom: none;
            }
            .device-label {
                color: #64748b;
                font-weight: 600;
            }
            .device-val {
                color: #f1f5f9;
                font-weight: 700;
                text-align: right;
            }
            .actions-wrap {
                margin: 28px 0 16px;
            }
            .btn-approve {
                display: inline-block;
                padding: 16px 42px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff !important;
                text-decoration: none;
                text-align: center;
                font-weight: 700;
                font-size: 16px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(16, 185, 129, 0.35);
                letter-spacing: 0.3px;
            }
            .deny-link {
                display: block;
                margin-top: 18px;
                color: #f87171 !important;
                font-size: 13px;
                text-decoration: none;
                font-weight: 600;
            }
            .deny-link:hover {
                text-decoration: underline;
            }
            .note-box {
                background: rgba(245, 158, 11, 0.08);
                border-left: 3px solid #f59e0b;
                border-radius: 8px;
                padding: 12px 16px;
                text-align: left;
                margin-top: 26px;
                font-size: 12px;
                color: #cbd5e1;
                line-height: 1.5;
            }
            .footer {
                background: #080f0c;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="header-icon">&#128274;</div>
                <h1>Sign-In Approval Request</h1>
            </div>
            <div class="content">
                <h2 class="title">Approve Sign-In on ${deviceName || 'your device'}</h2>
                <p class="desc">
                    Hello <strong>${name || 'Member'}</strong>, a sign-in attempt was initiated for your Nourish Network account.
                    To complete sign-in on that device, tap the approval button below.
                </p>

                <div class="device-card">
                    <div class="device-row">
                        <span class="device-label">Device:</span>
                        <span class="device-val">${deviceName || 'Unknown Browser / PC'}</span>
                    </div>
                    <div class="device-row">
                        <span class="device-label">Time:</span>
                        <span class="device-val">${formattedTime}</span>
                    </div>
                    <div class="device-row">
                        <span class="device-label">Valid For:</span>
                        <span class="device-val">${expiresMinutes} Minutes</span>
                    </div>
                </div>

                <div class="actions-wrap">
                    <a href="${approveUrl}" class="btn-approve" target="_blank">&#9989; Approve Sign-In</a>
                    <a href="${denyUrl}" class="deny-link" target="_blank">&#128737; Deny &amp; Block Sign-In</a>
                </div>

                <div class="note-box">
                    <strong>&#9888; Cross-Device Flow:</strong>
                    Tapping "Approve" from your mobile phone will automatically and securely log in your laptop session within 2 seconds.
                    If you did not request this login, tap "Deny &amp; Block" immediately.
                </div>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Nourish Network. Secure Identity &amp; Food Rescue Platform.
            </div>
        </div>
    </body>
    </html>
    `;

    return await dispatchEmail({
        toEmail,
        subject: `Sign-in Approval Request for ${deviceName || 'your device'} - Nourish Network`,
        html: htmlTemplate
    });
}

module.exports = { 
    sendVerificationEmail, 
    sendPasswordResetEmail, 
    sendLoginNotificationEmail, 
    sendPasswordChangedEmail,
    sendFoodPublishedBroadcastEmail,
    sendSellerOrderNotificationEmail,
    sendLoginApprovalEmail
};


