const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');
const dotenv = require('dotenv');
dotenv.config();

// Configure mail transporter with environment variables
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  // secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
}); 

// Email template engine
const templates = {
  submissionConfirmation: (code, name) => ({
    subject: 'Your Metamasonz Submission Code',
    html: ` 
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a237e;">Hello ${name},</h2>
        <p>Your submission has been received successfully!</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <strong>Submission Code:</strong>
          <div style="font-size: 24px; letter-spacing: 2px; margin: 10px 0;">${code}</div>
        </div>
        <p>Keep this code safe for future reference.</p>
        <hr style="border: 0; border-top: 1px solid #eee;">
        <p style="font-size: 0.9em; color: #666;">
          Metamasonz Team<br>
          <a href="https://metamasonz.com" style="color: #1a237e;">metamasonz.com</a>
        </p>
      </div>
    `
  }),

  adminInvite: (code, email, role) => ({
    subject: `Metamasonz ${role} Invitation`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a237e;">Organization Invitation</h2>
        <p>You've been invited to join Metamasonz as a <strong>${role}</strong>.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <strong>Invite Code:</strong>
          <div style="font-size: 24px; letter-spacing: 2px; margin: 10px 0;">${code}</div>
          <strong>Registered Email:</strong>
          <div>${email}</div>
        </div>
        <p>This code expires in 24 hours.</p>
      </div>
    `
  }),

  passwordReset: (url, name) => ({
    subject: 'Metamasonz Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a237e;">Hi ${name},</h2>
        <p>We received a request to reset your password.</p>
        <a href="${url}" 
           style="display: inline-block; padding: 12px 24px; 
                  background: #1a237e; color: white; 
                  text-decoration: none; border-radius: 4px;
                  margin: 20px 0;">
          Reset Password
        </a>
        <p>This link expires in 15 minutes.</p>
      </div>
    `
  }),

  adminNotification: (submission, adminName) => ({
    subject: 'New Project Submission Received',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a237e;">New Submission Alert</h2>
        <p>Hello ${adminName},</p>
        <p>A new project has been submitted for review:</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
          <p><strong>Project Name:</strong> ${submission.projectName}</p>
          <p><strong>Submitted At:</strong> ${new Date(submission.submittedAt).toLocaleString()}</p>
          <p><strong>Submission Code:</strong> ${submission.submissionCode}</p>
        </div>
      </div>
    `
  })
};

// Generate text version from HTML
const generateText = html => htmlToText(html, {
  wordwrap: 80,
  ignoreImage: true
});

// Main email sender function
const sendEmail = async (templateName, data, recipient) => {
  try {
    if (!transporter) throw new Error('Mail transporter not configured');
    if (!templates[templateName]) throw new Error('Invalid email template');

    // Generate email content
    const template = templates[templateName](...data);
    const textVersion = generateText(template.html);

    // Configure mail options
    const mailOptions = {
      from: `"Metamasonz Admin" <${process.env.MAIL_FROM || process.env.MAIL_USERNAME}>`,
      to: recipient,
      subject: template.subject,
      text: textVersion,
      html: template.html
    };

    // Send email or log in development
    if (process.env.NODE_ENV === 'production') {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);
      return true;
    } else {
      console.log('Development email preview:', {
        to: recipient,
        subject: mailOptions.subject,
        html: mailOptions.html
      });
      return true;
    }
  } catch (error) {
    console.error('Email send failed:', error.message);
    return false;
  }
};

module.exports = {
  sendEmail,
  templates,
  transporter
};