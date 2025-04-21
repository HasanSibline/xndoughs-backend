const nodemailer = require('nodemailer');

class NotificationManager {
  static async sendEmail(subject, message) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: `XNDoughs Alert: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #e11d48;">XNDoughs Database Alert</h2>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px;">
              <p><strong>${subject}</strong></p>
              <p>${message}</p>
            </div>
            <p style="color: #6b7280; font-size: 0.875rem; margin-top: 20px;">
              This is an automated message from your XNDoughs Database Management System
            </p>
          </div>
        `
      });

      console.log('Alert email sent successfully');
    } catch (error) {
      console.error('Error sending alert email:', error);
    }
  }

  static async sendDiscordWebhook(title, message, isError = false) {
    try {
      if (!process.env.DISCORD_WEBHOOK_URL) return;

      const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embeds: [{
            title,
            description: message,
            color: isError ? 15158332 : 3066993, // Red for errors, Green for info
            timestamp: new Date().toISOString()
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending Discord webhook:', error);
    }
  }

  static async notify(subject, message, isError = false) {
    // Send both email and Discord notifications
    await Promise.all([
      this.sendEmail(subject, message),
      this.sendDiscordWebhook(subject, message, isError)
    ]);
  }
} 