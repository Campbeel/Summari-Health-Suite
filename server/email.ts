import nodemailer from 'nodemailer';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER, or SMTP_PASSWORD not configured');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetToken: string,
  firstName: string
) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_USER!;

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DEPLOYMENT_URL
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : 'http://localhost:5000';

  const resetUrl = `${baseUrl}/restablecer-contrasena?token=${resetToken}`;

  await transporter.sendMail({
    from: `Summari <${fromEmail}>`,
    to: toEmail,
    subject: 'Recuperar tu contraseña - Summari',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 480px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: #3473a8; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Summari</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">Telemedicina</p>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: #18181b; font-size: 16px; margin: 0 0 16px;">Hola ${firstName},</p>
            <p style="color: #3f3f46; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en Summari.
              Haz clic en el siguiente botón para crear una nueva contraseña:
            </p>
            <div style="text-align: center; margin: 0 0 24px;">
              <a href="${resetUrl}" style="display: inline-block; background: #3473a8; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Restablecer Contraseña
              </a>
            </div>
            <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin: 0 0 16px;">
              Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
            <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="${resetUrl}" style="color: #3473a8; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  return { id: 'sent' };
}

interface ConsultationDocumentsEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  doctorSpecialty: string;
  consultationDate: string;
  prescription?: {
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    instructions?: string | null;
  } | null;
  medicalInstructions?: Array<{
    category: string;
    title: string;
    description: string;
    priority: string;
  }>;
  examOrders?: {
    exams: Array<{
      name: string;
      instructions?: string;
    }>;
    clinicalJustification?: string | null;
  } | null;
  documentTypes: ('prescription' | 'instructions' | 'exams')[];
}

const CATEGORY_LABELS: Record<string, string> = {
  diet: "Alimentación",
  exercise: "Ejercicio",
  lifestyle: "Estilo de vida",
  "follow-up": "Seguimiento",
  tests: "Exámenes",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  normal: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
};

function buildPrescriptionSection(prescription: ConsultationDocumentsEmailData['prescription']): string {
  if (!prescription || !prescription.medications?.length) return '';
  
  const medicationRows = prescription.medications.map(med => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #18181b; font-weight: 600;">${escapeHtml(med.name)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #3f3f46;">${escapeHtml(med.dosage)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #3f3f46;">${escapeHtml(med.frequency)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #3f3f46;">${escapeHtml(med.duration)}</td>
    </tr>
    ${med.instructions ? `<tr><td colspan="4" style="padding: 4px 12px 10px; color: #71717a; font-size: 12px; font-style: italic;">→ ${escapeHtml(med.instructions)}</td></tr>` : ''}
  `).join('');

  return `
    <div style="margin: 24px 0;">
      <h2 style="color: #3473a8; font-size: 18px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #3473a8;">
        💊 Receta Médica
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #f4f4f5;">
            <th style="padding: 8px 12px; text-align: left; color: #71717a; font-weight: 600;">Medicamento</th>
            <th style="padding: 8px 12px; text-align: left; color: #71717a; font-weight: 600;">Dosis</th>
            <th style="padding: 8px 12px; text-align: left; color: #71717a; font-weight: 600;">Frecuencia</th>
            <th style="padding: 8px 12px; text-align: left; color: #71717a; font-weight: 600;">Duración</th>
          </tr>
        </thead>
        <tbody>
          ${medicationRows}
        </tbody>
      </table>
      ${prescription.instructions ? `
        <div style="margin-top: 12px; padding: 12px; background: #f0f9ff; border-radius: 6px; border-left: 3px solid #3473a8;">
          <p style="color: #3f3f46; font-size: 13px; margin: 0;"><strong>Instrucciones generales:</strong> ${escapeHtml(prescription.instructions)}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function buildInstructionsSection(instructions: ConsultationDocumentsEmailData['medicalInstructions']): string {
  if (!instructions?.length) return '';

  const instructionItems = instructions.map(instr => `
    <div style="margin-bottom: 12px; padding: 12px; background: #fafafa; border-radius: 6px; border-left: 3px solid ${PRIORITY_COLORS[instr.priority] || '#3b82f6'};">
      <div style="display: flex; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: 600; color: #18181b; font-size: 14px;">${escapeHtml(instr.title)}</span>
      </div>
      <div style="margin-bottom: 6px;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #e4e4e7; color: #3f3f46; margin-right: 6px;">${escapeHtml(CATEGORY_LABELS[instr.category] || instr.category)}</span>
        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: ${PRIORITY_COLORS[instr.priority] || '#3b82f6'}22; color: ${PRIORITY_COLORS[instr.priority] || '#3b82f6'};">${escapeHtml(PRIORITY_LABELS[instr.priority] || instr.priority)}</span>
      </div>
      <p style="color: #3f3f46; font-size: 13px; margin: 0; line-height: 1.5;">${escapeHtml(instr.description)}</p>
    </div>
  `).join('');

  return `
    <div style="margin: 24px 0;">
      <h2 style="color: #3473a8; font-size: 18px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #3473a8;">
        📋 Indicaciones Médicas
      </h2>
      ${instructionItems}
    </div>
  `;
}

function buildExamOrdersSection(examOrders: ConsultationDocumentsEmailData['examOrders']): string {
  if (!examOrders?.exams?.length) return '';

  const examItems = examOrders.exams.map(exam => `
    <div style="margin-bottom: 8px; padding: 10px 12px; background: #fafafa; border-radius: 6px; border-left: 3px solid #00ced1;">
      <p style="font-weight: 600; color: #18181b; font-size: 14px; margin: 0;">${escapeHtml(exam.name)}</p>
      ${exam.instructions ? `<p style="color: #71717a; font-size: 12px; margin: 4px 0 0; font-style: italic;">Preparación: ${escapeHtml(exam.instructions)}</p>` : ''}
    </div>
  `).join('');

  return `
    <div style="margin: 24px 0;">
      <h2 style="color: #3473a8; font-size: 18px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #3473a8;">
        🔬 Órdenes de Exámenes
      </h2>
      ${examItems}
      ${examOrders.clinicalJustification ? `
        <div style="margin-top: 12px; padding: 12px; background: #f0fdfa; border-radius: 6px; border-left: 3px solid #00ced1;">
          <p style="color: #3f3f46; font-size: 13px; margin: 0;"><strong>Justificación clínica:</strong> ${escapeHtml(examOrders.clinicalJustification)}</p>
        </div>
      ` : ''}
    </div>
  `;
}

export async function sendConsultationDocuments(data: ConsultationDocumentsEmailData & { pdfBuffers?: { type: string; filename: string; buffer: Buffer }[] }) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_USER!;

  const subjectParts: string[] = [];

  if (data.documentTypes.includes('prescription') && data.prescription?.medications?.length) {
    subjectParts.push('Receta');
  }
  if (data.documentTypes.includes('instructions') && data.medicalInstructions?.length) {
    subjectParts.push('Indicaciones');
  }
  if (data.documentTypes.includes('exams') && data.examOrders?.exams?.length) {
    subjectParts.push('Exámenes');
  }

  if (subjectParts.length === 0) {
    throw new Error('No hay documentos para enviar');
  }

  const subject = `${subjectParts.join(', ')} de tu consulta - Summari`;

  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  if (data.pdfBuffers?.length) {
    for (const pdf of data.pdfBuffers) {
      attachments.push({
        filename: pdf.filename,
        content: pdf.buffer,
        contentType: 'application/pdf',
      });
    }
  }

  await transporter.sendMail({
    from: `Summari <${fromEmail}>`,
    to: data.patientEmail,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: #3473a8; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Summari</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">Telemedicina</p>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: #18181b; font-size: 16px; margin: 0 0 8px;">Hola ${escapeHtml(data.patientName)},</p>
            <p style="color: #3f3f46; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
              Adjunto encontrarás los documentos de tu consulta médica del <strong>${escapeHtml(data.consultationDate)}</strong>.
            </p>

            <div style="padding: 12px 16px; background: #f0f9ff; border-radius: 6px; margin-bottom: 24px;">
              <p style="color: #3f3f46; font-size: 13px; margin: 0;">
                <strong>Doctor:</strong> ${escapeHtml(data.doctorName)}<br>
                <strong>Especialidad:</strong> ${escapeHtml(data.doctorSpecialty)}
              </p>
            </div>

            <div style="padding: 16px; background: #f4f4f5; border-radius: 8px; text-align: center; margin-bottom: 24px;">
              <p style="color: #3f3f46; font-size: 14px; margin: 0 0 8px;">
                📎 <strong>Documentos adjuntos (${attachments.length} archivo${attachments.length > 1 ? 's' : ''}):</strong>
              </p>
              <p style="color: #71717a; font-size: 13px; margin: 0;">
                ${subjectParts.join(' · ')}
              </p>
              <p style="color: #a1a1aa; font-size: 12px; margin: 8px 0 0;">
                Cada documento viene en un archivo PDF separado para tu comodidad.
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
            <p style="color: #a1a1aa; font-size: 12px; margin: 0; line-height: 1.5;">
              Este documento ha sido generado por la plataforma Summari y forma parte del registro clínico de tu consulta.
              Si tienes alguna duda, contacta a tu médico tratante.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments,
  });

  return { sent: true, documentTypes: data.documentTypes };
}

export interface PaymentReceiptEmailData {
  patientName: string;
  patientRut?: string;
  patientEmail: string;
  doctorName: string;
  doctorSpecialty: string;
  consultationDate: string;
  consultationTime: string;
  amount: number;
  commerceOrderId: string;
  receiptPdfBuffer?: Buffer;
}

export async function sendPaymentReceiptEmail(data: PaymentReceiptEmailData) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_USER!;

  const formattedAmount = data.amount.toLocaleString('es-CL');
  const receiptDate = new Date().toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const attachments: any[] = [];
  if (data.receiptPdfBuffer) {
    attachments.push({
      filename: `Boleta_${data.commerceOrderId}.pdf`,
      content: data.receiptPdfBuffer,
      contentType: 'application/pdf',
    });
  }

  await transporter.sendMail({
    from: `Summari <${fromEmail}>`,
    to: data.patientEmail,
    subject: `Comprobante de pago - Consulta médica #${data.commerceOrderId} - Summari`,
    attachments,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 520px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: #3473a8; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Summari</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">Comprobante de Pago</p>
          </div>
          <div style="padding: 32px 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="width: 48px; height: 48px; background: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                <span style="font-size: 24px;">&#10003;</span>
              </div>
              <h2 style="color: #18181b; font-size: 18px; margin: 0;">Pago confirmado</h2>
              <p style="color: #71717a; font-size: 13px; margin: 4px 0 0;">Tu consulta ha sido agendada exitosamente</p>
            </div>

            <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">N° Orden</td>
                  <td style="padding: 6px 0; color: #18181b; text-align: right; font-weight: 600;">${escapeHtml(data.commerceOrderId)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Fecha de pago</td>
                  <td style="padding: 6px 0; color: #18181b; text-align: right;">${escapeHtml(receiptDate)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 8px 0;"><hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0;"></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Doctor</td>
                  <td style="padding: 6px 0; color: #18181b; text-align: right;">${escapeHtml(data.doctorName)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Especialidad</td>
                  <td style="padding: 6px 0; color: #18181b; text-align: right;">${escapeHtml(data.doctorSpecialty)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Fecha consulta</td>
                  <td style="padding: 6px 0; color: #18181b; text-align: right;">${escapeHtml(data.consultationDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Hora</td>
                  <td style="padding: 6px 0; color: #18181b; text-align: right;">${escapeHtml(data.consultationTime)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 8px 0;"><hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0;"></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #18181b; font-weight: 600; font-size: 16px;">Total pagado</td>
                  <td style="padding: 6px 0; color: #3473a8; text-align: right; font-weight: 700; font-size: 18px;">$${formattedAmount} CLP</td>
                </tr>
              </table>
            </div>

            <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin: 0 0 16px; text-align: center;">
              Guarda este correo como comprobante de pago.
              Si necesitas solicitar un reembolso, puedes hacerlo desde la sección "Mis Consultas" en la plataforma.
            </p>

            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
            <p style="color: #a1a1aa; font-size: 11px; margin: 0; line-height: 1.5; text-align: center;">
              Summari Telemedicina &middot; Este comprobante fue generado automáticamente.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  return { sent: true };
}
