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

  /** Devuelve true si el correo salió (false si no hay correo configurado o falló el envío). */
  async enviarInvitacionApp(
    email: string,
    nombre: string,
    codigo: string,
    nombreEmpresa: string,
    codigoGimnasio: string,
    vigenciaDias: number,
  ): Promise<boolean> {
    return this.enviar(
      email,
      `${nombreEmpresa} te invitó a su app`,
      `
        <p>Hola ${nombre},</p>
        <p><b>${nombreEmpresa}</b> te invitó a usar su app para entrenar. Para activar tu cuenta:</p>
        <ol>
          <li>Descarga la app e ingresa a <b>Activar mi cuenta</b>.</li>
          <li>Escribe el código del gimnasio: <b>${codigoGimnasio}</b></li>
          <li>Escribe este correo y tu código de activación: <b style="font-size:20px;letter-spacing:3px">${codigo}</b></li>
          <li>Elige tu contraseña y listo.</li>
        </ol>
        <p>El código vence en ${vigenciaDias} días.</p>
      `,
      `invitación a la app para ${email}`,
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
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        `GMAIL_USER/GMAIL_APP_PASSWORD no configurados — ${referenciaRespaldo}`,
      );
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: `"GymPro" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (error) {
      // No relanzamos: el flujo que dispara el correo no debe fallar por esto.
      this.logger.error(
        `No se pudo enviar el correo a ${to}: ${(error as Error).message} (${referenciaRespaldo})`,
      );
      return false;
    }
  }
}
