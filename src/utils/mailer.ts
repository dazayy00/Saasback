import nodemailer from 'nodemailer';

export const sendResetCodeEmail = async (toEmail: string, resetCode: string, name?: string): Promise<boolean> => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  console.log('\n=============================================');
  console.log('✉️  CÓDIGO DE RECUPERACIÓN POR CORREO');
  console.log('Para:', toEmail);
  console.log('Nombre:', name || 'Usuario');
  console.log('Tu código es:', resetCode);
  console.log('=============================================\n');

  if (!user || !pass) {
    console.log('💡 [Aviso Mailer] Para enviar correos reales a la bandeja de entrada, define EMAIL_USER y EMAIL_PASS en tu archivo backend/.env');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport(
      host
        ? {
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
          }
        : {
            service: 'gmail',
            auth: { user, pass },
          }
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; margin-bottom: 24px; }
          .title { font-size: 22px; font-weight: 700; color: #111827; margin: 12px 0 4px; }
          .subtitle { font-size: 14px; color: #6b7280; margin: 0; }
          .code-box { margin: 28px 0; background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; border: 1px dashed #d1d5db; }
          .code-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 8px; display: block; }
          .code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #000000; font-family: monospace; }
          .footer { font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 24px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 class="title">Recuperación de Contraseña</h1>
            <p class="subtitle">Hola${name ? ` ${name}` : ''}, recibimos una solicitud para restablecer tu contraseña.</p>
          </div>
          
          <div class="code-box">
            <span class="code-label">Código de verificación PIN</span>
            <div class="code">${resetCode}</div>
          </div>
          
          <p style="font-size: 13px; color: #4b5563; text-align: center; margin: 0;">
            Ingresa este código de 6 dígitos en la aplicación para crear tu nueva contraseña. Expira en <strong>15 minutos</strong>.
          </p>
          
          <div class="footer">
            Si no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña actual no cambiará.
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"SaaS Inventory" <${user}>`,
      to: toEmail,
      subject: `${resetCode} es tu código de recuperación de contraseña`,
      text: `Tu código de recuperación es: ${resetCode}. Expira en 15 minutos.`,
      html: htmlContent,
    });

    console.log(`✅ [Mailer] Correo enviado exitosamente a ${toEmail}`);
    return true;
  } catch (error) {
    console.error('❌ [Mailer] Error al enviar el correo:', error);
    return false;
  }
};
