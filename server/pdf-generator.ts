import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const COLORS = {
  primary: '#3473a8',
  secondary: '#00ced1',
  dark: '#1c2833',
  gray: '#708090',
  lightGray: '#f4f4f5',
  white: '#ffffff',
  priorityLow: '#22c55e',
  priorityNormal: '#3b82f6',
  priorityHigh: '#f97316',
  priorityUrgent: '#ef4444',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: COLORS.priorityLow,
  normal: COLORS.priorityNormal,
  high: COLORS.priorityHigh,
  urgent: COLORS.priorityUrgent,
};

const CATEGORY_LABELS: Record<string, string> = {
  diet: 'Alimentación',
  exercise: 'Ejercicio',
  lifestyle: 'Estilo de vida',
  'follow-up': 'Seguimiento',
  tests: 'Exámenes',
};

export interface PdfDocumentData {
  doctorName: string;
  doctorSpecialty: string;
  doctorLicense?: string;
  patientName: string;
  patientRut?: string;
  consultationDate: string;
  diagnosis?: string;
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
      justification?: string;
    }>;
  } | null;
  documentTypes: ('prescription' | 'instructions' | 'exams')[];
}

function getLogoPath(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'client', 'public', 'favicon.png'),
    path.join(process.cwd(), 'public', 'favicon.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function drawHeader(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.rect(0, 0, doc.page.width, 90).fill(COLORS.primary);

  const logoPath = getLogoPath();
  if (logoPath) {
    try {
      doc.image(logoPath, doc.page.margins.left, 15, { height: 60 });
    } catch {
      doc.fontSize(22).fillColor(COLORS.white).font('Helvetica-Bold').text('SUMMARI', doc.page.margins.left, 30);
    }
  } else {
    doc.fontSize(22).fillColor(COLORS.white).font('Helvetica-Bold').text('SUMMARI', doc.page.margins.left, 30);
  }

  doc.fontSize(10).fillColor('rgba(255,255,255,0.8)').font('Helvetica')
    .text('Telemedicina', doc.page.width - doc.page.margins.right - 100, 35, { width: 100, align: 'right' });
  doc.fontSize(9).fillColor('rgba(255,255,255,0.7)')
    .text(data.consultationDate, doc.page.width - doc.page.margins.right - 100, 50, { width: 100, align: 'right' });

  doc.y = 105;
  doc.fillColor(COLORS.dark);
}

function drawDoctorPatientInfo(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
  const leftX = doc.page.margins.left;
  const midX = doc.page.width / 2 + 10;
  const boxWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 20) / 2;
  const startY = doc.y;

  doc.rect(leftX, startY, boxWidth, 65).lineWidth(0.5).strokeColor('#e4e4e7').fillAndStroke(COLORS.lightGray, '#e4e4e7');
  doc.fontSize(8).fillColor(COLORS.gray).font('Helvetica').text('MÉDICO', leftX + 10, startY + 8);
  doc.fontSize(11).fillColor(COLORS.dark).font('Helvetica-Bold').text(data.doctorName, leftX + 10, startY + 20, { width: boxWidth - 20 });
  doc.fontSize(9).fillColor(COLORS.gray).font('Helvetica').text(data.doctorSpecialty, leftX + 10, startY + 35, { width: boxWidth - 20 });
  if (data.doctorLicense) {
    doc.fontSize(8).text(`Reg. ${data.doctorLicense}`, leftX + 10, startY + 48, { width: boxWidth - 20 });
  }

  doc.rect(midX, startY, boxWidth, 65).lineWidth(0.5).strokeColor('#e4e4e7').fillAndStroke(COLORS.lightGray, '#e4e4e7');
  doc.fontSize(8).fillColor(COLORS.gray).font('Helvetica').text('PACIENTE', midX + 10, startY + 8);
  doc.fontSize(11).fillColor(COLORS.dark).font('Helvetica-Bold').text(data.patientName, midX + 10, startY + 20, { width: boxWidth - 20 });
  if (data.patientRut) {
    doc.fontSize(9).fillColor(COLORS.gray).font('Helvetica').text(`RUT: ${data.patientRut}`, midX + 10, startY + 35, { width: boxWidth - 20 });
  }
  if (data.diagnosis) {
    const diagY = data.patientRut ? startY + 48 : startY + 35;
    doc.fontSize(8).fillColor(COLORS.gray).font('Helvetica').text(`Diagnóstico: ${data.diagnosis}`, midX + 10, diagY, { width: boxWidth - 20 });
  }

  doc.y = startY + 80;
}

function checkPageBreak(doc: PDFKit.PDFDocument, requiredSpace: number) {
  const bottomMargin = doc.page.margins.bottom;
  const pageBottom = doc.page.height - bottomMargin;
  if (doc.y + requiredSpace > pageBottom) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, color: string = COLORS.primary) {
  checkPageBreak(doc, 40);
  const leftX = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.y += 5;
  doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y).lineWidth(1.5).strokeColor(color).stroke();
  doc.y += 8;
  doc.fontSize(14).fillColor(color).font('Helvetica-Bold').text(title, leftX, doc.y);
  doc.y += 5;
}

function drawPrescriptionSection(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
  if (!data.prescription?.medications?.length) return;

  drawSectionTitle(doc, 'Receta Médica');

  const leftX = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = [pageWidth * 0.3, pageWidth * 0.2, pageWidth * 0.25, pageWidth * 0.25];

  checkPageBreak(doc, 30);
  const headerY = doc.y;
  doc.rect(leftX, headerY, pageWidth, 22).fill(COLORS.lightGray);
  doc.fontSize(9).fillColor(COLORS.gray).font('Helvetica-Bold');
  let colX = leftX;
  const headers = ['Medicamento', 'Dosis', 'Frecuencia', 'Duración'];
  headers.forEach((h, i) => {
    doc.text(h, colX + 6, headerY + 6, { width: colWidths[i] - 12 });
    colX += colWidths[i];
  });
  doc.y = headerY + 24;

  data.prescription.medications.forEach((med) => {
    checkPageBreak(doc, 40);
    const rowY = doc.y;
    colX = leftX;
    doc.fontSize(9).fillColor(COLORS.dark).font('Helvetica-Bold');
    doc.text(med.name, colX + 6, rowY + 5, { width: colWidths[0] - 12 });
    doc.font('Helvetica').fillColor(COLORS.dark);
    doc.text(med.dosage, colX + colWidths[0] + 6, rowY + 5, { width: colWidths[1] - 12 });
    doc.text(med.frequency, colX + colWidths[0] + colWidths[1] + 6, rowY + 5, { width: colWidths[2] - 12 });
    doc.text(med.duration, colX + colWidths[0] + colWidths[1] + colWidths[2] + 6, rowY + 5, { width: colWidths[3] - 12 });

    let rowHeight = 22;
    if (med.instructions) {
      doc.fontSize(8).fillColor(COLORS.gray).font('Helvetica-Oblique');
      doc.text(`→ ${med.instructions}`, leftX + 6, rowY + 20, { width: pageWidth - 12 });
      rowHeight = 35;
    }

    doc.moveTo(leftX, rowY + rowHeight).lineTo(leftX + pageWidth, rowY + rowHeight)
      .lineWidth(0.3).strokeColor('#e4e4e7').stroke();
    doc.y = rowY + rowHeight + 2;
  });

  if (data.prescription.instructions) {
    checkPageBreak(doc, 35);
    doc.y += 5;
    doc.rect(leftX, doc.y, pageWidth, 30).lineWidth(0.5)
      .fillAndStroke('#f0f9ff', COLORS.primary);
    doc.rect(leftX, doc.y, 3, 30).fill(COLORS.primary);
    doc.fontSize(9).fillColor(COLORS.dark).font('Helvetica-Bold')
      .text('Instrucciones generales: ', leftX + 10, doc.y + 8, { continued: true });
    doc.font('Helvetica').text(data.prescription.instructions);
    doc.y += 35;
  }
}

function drawInstructionsSection(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
  if (!data.medicalInstructions?.length) return;

  drawSectionTitle(doc, 'Indicaciones Médicas');

  const leftX = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  data.medicalInstructions.forEach((instr) => {
    checkPageBreak(doc, 55);
    const startY = doc.y;
    const priorityColor = PRIORITY_COLORS[instr.priority] || COLORS.priorityNormal;

    doc.rect(leftX, startY, pageWidth, 45).lineWidth(0.5)
      .fillAndStroke(COLORS.lightGray, '#e4e4e7');
    doc.rect(leftX, startY, 3, 45).fill(priorityColor);

    doc.fontSize(10).fillColor(COLORS.dark).font('Helvetica-Bold')
      .text(instr.title, leftX + 10, startY + 6, { width: pageWidth - 120 });

    const labelX = leftX + pageWidth - 105;
    doc.fontSize(7).fillColor(COLORS.gray).font('Helvetica')
      .text(CATEGORY_LABELS[instr.category] || instr.category, labelX, startY + 6, { width: 50, align: 'center' });
    doc.fillColor(priorityColor)
      .text(PRIORITY_LABELS[instr.priority] || instr.priority, labelX + 50, startY + 6, { width: 45, align: 'center' });

    doc.fontSize(8).fillColor(COLORS.gray).font('Helvetica')
      .text(instr.description, leftX + 10, startY + 22, { width: pageWidth - 20 });

    doc.y = startY + 50;
  });
}

function drawExamOrdersSection(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
  if (!data.examOrders?.exams?.length) return;

  drawSectionTitle(doc, 'Órdenes de Exámenes', COLORS.secondary);

  const leftX = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  data.examOrders.exams.forEach((exam) => {
    checkPageBreak(doc, 35);
    const startY = doc.y;
    const boxHeight = exam.justification ? 38 : 25;

    doc.rect(leftX, startY, pageWidth, boxHeight).lineWidth(0.5)
      .fillAndStroke(COLORS.lightGray, '#e4e4e7');
    doc.rect(leftX, startY, 3, boxHeight).fill(COLORS.secondary);

    doc.fontSize(10).fillColor(COLORS.dark).font('Helvetica-Bold')
      .text(exam.name, leftX + 10, startY + 6, { width: pageWidth - 20 });

    if (exam.justification) {
      doc.fontSize(8).fillColor(COLORS.gray).font('Helvetica-Oblique')
        .text(`Justificación: ${exam.justification}`, leftX + 10, startY + 22, { width: pageWidth - 20 });
    }

    doc.y = startY + boxHeight + 5;
  });
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const pageBottom = doc.page.height - 30;
  doc.fontSize(7).fillColor(COLORS.gray).font('Helvetica');
  doc.text(
    'Documento generado por Summari Telemedicina. Este documento forma parte del registro clínico del paciente.',
    doc.page.margins.left, pageBottom,
    { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center' }
  );
}

export function generateConsultationPdf(data: PdfDocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 50, left: 40, right: 40 },
      info: {
        Title: `Documentos de Consulta - ${data.patientName}`,
        Author: data.doctorName,
        Subject: 'Documentos de Consulta Médica',
        Creator: 'Summari Telemedicina',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, data);
    drawDoctorPatientInfo(doc, data);

    if (data.documentTypes.includes('prescription')) {
      drawPrescriptionSection(doc, data);
    }
    if (data.documentTypes.includes('instructions')) {
      drawInstructionsSection(doc, data);
    }
    if (data.documentTypes.includes('exams')) {
      drawExamOrdersSection(doc, data);
    }

    drawFooter(doc);
    doc.end();
  });
}
