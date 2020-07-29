import { Service, OnConfig, ServerConfig } from '@steroids/core';
import nodemailer from 'nodemailer';
import pug from 'pug';
import path from 'path';
import fs from 'fs';

@Service({
  name: 'email'
})
export class EmailService implements OnConfig {

  private emailConfig: ServerConfig['email'];
  private templates: { [name: string]: pug.compileTemplate } = {};

  onConfig(config: ServerConfig) {

    this.emailConfig = config.email;

    this.init();

  }

  /**
  * Loads all email templates.
  */
  init() {

    log.debug('Loading email templates...');

    const files = fs.readdirSync(path.resolve(__dirname, '..', 'email-templates'));

    for ( const file of files ) {

      this.templates[file.replace('.pug', '')] = pug.compileFile(path.resolve(__dirname, '..', 'email-templates', file));

    }

    log.debug('Email templates loaded');

  }

  /**
  * Sends an email.
  * @param subject The email subject.
  * @param email The recipient's email.
  * @param html The HTML email content.
  */
  public async send(subject: string, email: string, html: string) {

    await nodemailer.createTransport({
      host: this.emailConfig.smtpHost,
      port: this.emailConfig.smtpPort,
      secure: true,
      auth: {
        user: this.emailConfig.smtpUser,
        pass: this.emailConfig.smtpPass
      }
    })
    .sendMail({
      from: `"${this.emailConfig.senderName}" <${this.emailConfig.senderEmail}>`,
      to: email,
      subject,
      html
    });

  }

  /**
  * Renders an HTML email from template.
  * @param name The template name.
  * @param data The template data.
  */
  public renderTemplate<T=any>(name: string, data: T): string {

    return this.templates[name](data);

  }

}

export interface PasswordResetTemplateData {

  hostUrl: string;
  firstName: string;
  lastName: string;
  code: string;

}

export interface VerificationTemplateData {

  hostUrl: string;
  firstName: string;
  lastName: string;
  link: string;

}
