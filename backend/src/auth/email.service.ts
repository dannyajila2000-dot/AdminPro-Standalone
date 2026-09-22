import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter =
    process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
        })
      : null;

  async enviarResetPassword(email: string, nombre: string, resetUrl: string) {
    await this.enviar(
      email,
      'Recupera tu contraseña',
      `
        <p>Hola ${nombre},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Haz click en el siguiente enlace (vence en 1 hora):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si no fuiste tú, puedes ignorar este correo.</p>
      `,
      resetUrl,
    );
  }

  async enviarInvitacion(email: string, nombre: string, activarUrl: string) {
    await this.enviar(
      email,
      'Te invitaron a GymPro',
      `
        <p>Hola ${nombre},</p>
        <p>Te crearon una cuenta. Haz click en el siguiente enlace para configurar tu contraseña (vence en 1 hora):</p>
        <p><a href="${activarUrl}">${activarUrl}</a></p>
      `,
      activarUrl,
    );
  }

  async enviarAvisoCambioPassword(email: string, nombre: string) {
    await this.enviar(
      email,
      'Tu contraseña cambió',
      `
        <p>Hola ${nombre},</p>
        <p>Te confirmamos que la contraseña de tu cuenta acaba de cambiar.</p>
        <p>Si no fuiste tú, contacta a un administrador de tu empresa de inmediato.</p>
      `,
      `aviso de cambio de contraseña para ${email}`,
    );
  }

  async enviarRecordatorioCita(
    email: string,
    nombreCliente: string,
    tipoCita: string,
    fecha: Date,
  ) {
    const fechaTexto = fecha.toLocaleString('es', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    await this.enviar(
      email,
      `Recordatorio: ${tipoCita} mañana`,
      `
        <p>Hola ${nombreCliente},</p>
        <p>Te recordamos tu cita de <strong>${tipoCita}</strong>:</p>
        <p>${fechaTexto}</p>
      `,
      `recordatorio de cita para ${email}`,
    );
  }

  async enviarAvisoMembresiaPorVencer(
    email: string,
    nombreCliente: string,
    fechaVencimiento: Date,
  ) {
    const fechaTexto = fechaVencimiento.toLocaleDateString('es', {
      dateStyle: 'full',
    });

    await this.enviar(
      email,
      'Tu membresía está por vencer',
      `
        <p>Hola ${nombreCliente},</p>
        <p>Tu membresía vence el <strong>${fechaTexto}</strong>.</p>
        <p>Renueva a tiempo para no perder el acceso.</p>
      `,
      `aviso de membresía por vencer para ${email}`,
    );
  }

  private async enviar(
    to: string,
    subject: string,
    html: string,
    referenciaRespaldo: string,
  ) {
    if (!this.transporter) {
      this.logger.warn(
        `GMAIL_USER/GMAIL_APP_PASSWORD no configurados — ${referenciaRespaldo}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"GymPro" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      // No relanzamos: el flujo que dispara el correo no debe fallar por esto.
      this.logger.error(
        `No se pudo enviar el correo a ${to}: ${(error as Error).message} (${referenciaRespaldo})`,
      );
    }
  }
}
