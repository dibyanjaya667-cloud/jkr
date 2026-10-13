const nodemailer = require('nodemailer');
const axios = require('axios');

const getTransporter = () => {
  const host = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST;
  const port = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 465);
  const user = process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const emailDebug = String(process.env.EMAIL_DEBUG || '').toLowerCase() === 'true';

  if (!user || !pass) {
    throw new Error('SMTP credentials are missing');
  }

  if (emailDebug) {
    console.log('[Email Config]', {
      host,
      port,
      secure,
      user,
      passLength: pass?.length || 0
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    debug: emailDebug,
    logger: emailDebug,
  });
};

const sendViaBrevoApi = async ({ to, subject, html, text, from }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return null;

  const senderEmail = from || process.env.EMAIL_FROM || process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
  const senderName = 'HRMS Notifications';

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }],
    subject: subject || 'Notification',
  };

  if (html) payload.htmlContent = html;
  if (text || !html) payload.textContent = text || 'Notification';

  if (String(process.env.EMAIL_DEBUG || '').toLowerCase() === 'true') {
    console.log('[Email][BrevoAPI] Sending to:', to, 'from:', senderEmail);
  }
  const res = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    },
    timeout: 15000,
  });
  return res.data;
};

const sendEmail = async ({ to, subject, html, text, from }) => {
  if (!to) throw new Error('Recipient email is required');

  try {
    const brevoResult = await sendViaBrevoApi({ to, subject, html, text, from });
    if (brevoResult) {
      if (String(process.env.EMAIL_DEBUG || '').toLowerCase() === 'true') {
        console.log('[Email][BrevoAPI] Sent successfully:', brevoResult?.messageId || brevoResult?.messageIds);
      }
      return brevoResult;
    }
  } catch (error) {
    if (String(process.env.EMAIL_DEBUG || '').toLowerCase() === 'true') {
      console.error('[Email][BrevoAPI] Send failed:', error.message);
      console.error('[Email][BrevoAPI] Error details:', error?.response?.data || error);
    }
  }

  const transporter = getTransporter();
  const sender = from || process.env.EMAIL_FROM || process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
  const senderName = 'HRMS Notifications';

  const payload = {
    from: `${senderName} <${sender}>`,
    to,
    subject: subject || 'Notification',
    headers: {
      'X-Mailer': 'HRMS Mailer',
      'X-Priority': '3',
      'Importance': 'Normal',
    },
  };

  if (html) payload.html = html;
  if (text || !html) payload.text = text || 'Notification';

  if (String(process.env.EMAIL_DEBUG || '').toLowerCase() === 'true') {
    console.log('[Email][SMTP] Sending to:', to, 'from:', sender);
  }
  try {
    const info = await transporter.sendMail(payload);
    if (String(process.env.EMAIL_DEBUG || '').toLowerCase() === 'true') {
      console.log('[Email][SMTP] Sent successfully:', info.messageId, 'Response:', info.response);
    }
    return info;
  } catch (error) {
    if (String(process.env.EMAIL_DEBUG || '').toLowerCase() === 'true') {
      console.error('[Email][SMTP] Send failed:', error.message);
      console.error('[Email][SMTP] Error details:', error);
    }
    throw error;
  }
};

const verifyEmailTransport = async () => {
  const transporter = getTransporter();
  return transporter.verify();
};

module.exports = { sendEmail, verifyEmailTransport };
