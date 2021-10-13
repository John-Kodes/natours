const nodemailer = require('nodemailer');
const pug = require('pug');
const { htmlToText } = require('html-to-text');

// The idea is when we want to send a new email, is to import this email class and then use it like so: new Email(user, url).sendWelcome()
// user contains email address and name
// URL is the reset URL or whatever link we want to put in
// sendWelcome() is a method which comes from the class. Will be sent whenever a user signs up for our application. Used for sending different emails for different scenarios
module.exports = class Email {
  // constructor functions run when an instance is created with this class
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `John Daniel Semine <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // sendgrid
      return nodemailer.createTransport({
        service: 'SendGrid', // no need to specify server and port cuz SendGrid is one of the services that are already predefined
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }

    // if in developer environment
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Send the actual email
  async send(template, subject) {
    // 1) Render HTML for the email, based on a pug template
    // What we want to happen here is to create HTML based on a template and send it by passing it in the mailOptions (fieldname: html)
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });
    // We can also pass in options to the renderFile that will be used for saying the name and link

    // 2) Define the email options
    const mailOptions = {
      from:
        process.env.NODE_ENV === 'production'
          ? process.env.SENDGRID_EMAIL_FROM
          : this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html), // NPM html-to-text: necessary for better email delivery rates and also for spam folders
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)'
    );
  }
};
