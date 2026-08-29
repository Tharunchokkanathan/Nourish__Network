const nodemailer = require('nodemailer');
require('dotenv').config();

const GOOGLE_BRIDGE_URL = process.env.GMAIL_HTTP_BRIDGE || "https://script.google.com/macros/s/AKfycbwEgyW84T294uID8TpJckcys1gPWVfrJYVThie3BOXeO2XUw82xoIih0jGqJh4UeQ7M/exec";

// High-performance pre-warmed pooled transporter using standard Cloud-compatible Port 587 (STARTTLS)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    pool: true,
    maxConnections: 10,
    maxMessages: Infinity,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 60000,
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
        console.warn('⚠️ SMTP Connection Pool Warm-up Warning:', error.message);
    } else {
        console.log('⚡ SMTP Connection Pool is warm & ready for sub-second delivery.');
    }
});

function sanitizeHtmlForEmail(html) {
    if (!html) return '';
    return html
        .replace(/🌿/g, '&#127807;')
        .replace(/🔑/g, '&#128273;')
        .replace(/🔒/g, '&#128274;')
        .replace(/🛡️/g, '&#128737;')
        .replace(/🛡/g, '&#128737;')
        .replace(/✅/g, '&#9989;')
        .replace(/⚠️/g, '&#9888;&#65039;')
        .replace(/🎉/g, '&#127881;')
        .replace(/🤝/g, '&#129309;')
        .replace(/🌱/g, '&#127793;');
}

function sanitizeSubjectForEmail(subject) {
    if (!subject) return '';
    return subject
        .replace(/🌿|🔑|🔒|🛡️|🛡|✅|⚠️|🎉|🤝|🌱/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Universal Dual-Engine Dispatcher:
 * 1. Primary: Google Apps Script HTTPS Bridge (100% unrestricted on Render via Port 443)
 * 2. Secondary Fallback: SMTP Transporter (Localhost)
 */
async function dispatchEmail({ toEmail, subject, html, devFallbackUrl }) {
    const cleanSubject = sanitizeSubjectForEmail(subject);
    const cleanHtml = sanitizeHtmlForEmail(html);

    // 1. Google Apps Script HTTPS Bridge
    if (GOOGLE_BRIDGE_URL) {
        try {
            const res = await fetch(GOOGLE_BRIDGE_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    to: toEmail,
                    subject: cleanSubject,
                    html: cleanHtml
                })
            });
            const text = await res.text();
            let data = {};
            try { data = JSON.parse(text); } catch(e) {}
            if (data && data.success) {
                console.log(`✅ [Google HTTPS Engine] Email sent to ${toEmail}: ${cleanSubject}`);
                return { success: true, via: 'google-https' };
            }
        } catch (e) {
            console.warn(`⚠️ Google HTTPS Bridge error, trying SMTP fallback:`, e.message);
        }
    }

    // 2. SMTP Fallback
    try {
        const info = await transporter.sendMail({
            from: `"Nourish Network" <${process.env.GMAIL_USER || 'nourishnetwork.official@gmail.com'}>`,
            to: toEmail,
            subject: cleanSubject,
            html: cleanHtml
        });
        console.log(`✅ [SMTP] Email sent to ${toEmail}: ${info.messageId}`);
        return { success: true, messageId: info.messageId, via: 'smtp' };
    } catch (err) {
        console.error(`⚠️ Failed to send email to ${toEmail}:`, err.message);
        if (devFallbackUrl) console.log(`💡 [DEV FALLBACK LINK]: ${devFallbackUrl}`);
        return { success: false, error: err.message, devFallbackUrl };
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
async function sendVerificationEmail({ toEmail, name, token, accountType, hostUrl }) {
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
                margin-bottom: 30px;
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
            .info-box {
                background: rgba(16, 185, 129, 0.06);
                border-left: 4px solid #10b981;
                border-radius: 8px;
                padding: 15px 20px;
                text-align: left;
                margin: 30px 0 10px;
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
                <h1>🌿 Nourish Network</h1>
            </div>
            <div class="content">
                <h2 class="welcome-title">Welcome, ${name}!</h2>
                <p class="subtitle">
                    Thank you for signing up for Nourish Network. Please click the button below to verify your email address and activate your account access.
                </p>

                <a href="${verifyUrl}" class="btn-verify" target="_blank">Verify Email Address & Activate</a>

                <div class="info-box">
                    <strong>Note:</strong> Clicking this button will verify your email and take you directly to your ${accountType === 'ngo' || accountType === 'shelter' ? 'Buyer' : 'Seller'} Portal.
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
        subject: `Verify your Nourish Network Account 🌿`,
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
                <h1>🌿 Nourish Network</h1>
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
        subject: `Reset Your Nourish Network Password 🔑`,
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
async function sendLoginNotificationEmail({ toEmail, name, accountType, loginTime }) {
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
                <h1>🌿 Nourish Network</h1>
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
                        <span class="detail-label">Email Address:</span>
                        <span class="detail-value">${toEmail}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Login Timestamp:</span>
                        <span class="detail-value">${formattedTime}</span>
                    </div>
                </div>

                <div class="security-notice">
                    <strong>🛡️ Security Note:</strong> If you recently initiated this login, you can safely disregard this notice. If you did not log in or suspect unauthorized access, please update your account password immediately.
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
        subject: `Successful Account Login - Nourish Network 🌿`,
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
                <h1>🌿 Nourish Network</h1>
            </div>
            <div class="content">
                <h2 class="welcome-title">Password Changed Successfully 🔒</h2>
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
                        <span class="detail-value" style="color: #10b981;">Updated & Protected ✅</span>
                    </div>
                </div>

                <div class="security-alert">
                    <strong>⚠️ Didn't request this change?</strong><br>
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
        subject: `Security Alert: Password Changed Successfully 🔒 - Nourish Network`,
        html: htmlTemplate
    });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendLoginNotificationEmail, sendPasswordChangedEmail };
