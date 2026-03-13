import { useMemo } from 'react';
import { Page, Text, View, Document, StyleSheet, PDFViewer } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
  },
  section: {
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 12,
    marginBottom: 5,
  },
  medications: {
    marginTop: 20,
  },
  medication: {
    marginBottom: 15,
  },
});

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

interface Prescription {
  id: number;
  doctor_name: string;
  doctor_specialty: string;
  patient_name: string;
  patient_age?: number;
  diagnosis: string;
  medications: Medication[];
  instructions?: string;
  created_at: string;
}

interface PrescriptionViewerProps {
  prescription: Prescription;
}

export function PrescriptionViewer({ prescription }: PrescriptionViewerProps) {
  const PrescriptionDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>Receta Médica</Text>
          <Text style={styles.text}>Fecha: {format(new Date(prescription.created_at), 'PPP', { locale: es })}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>Médico</Text>
          <Text style={styles.text}>Dr. {prescription.doctor_name}</Text>
          <Text style={styles.text}>Especialidad: {prescription.doctor_specialty}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>Paciente</Text>
          <Text style={styles.text}>Nombre: {prescription.patient_name}</Text>
          {prescription.patient_age && (
            <Text style={styles.text}>Edad: {prescription.patient_age} años</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>Diagnóstico</Text>
          <Text style={styles.text}>{prescription.diagnosis}</Text>
        </View>

        <View style={styles.medications}>
          <Text style={styles.subtitle}>Medicamentos</Text>
          {prescription.medications.map((med, index) => (
            <View key={index} style={styles.medication}>
              <Text style={styles.text}>• {med.name}</Text>
              <Text style={styles.text}>  Dosis: {med.dosage}</Text>
              <Text style={styles.text}>  Frecuencia: {med.frequency}</Text>
              <Text style={styles.text}>  Duración: {med.duration}</Text>
              {med.instructions && (
                <Text style={styles.text}>  Instrucciones: {med.instructions}</Text>
              )}
            </View>
          ))}
        </View>

        {prescription.instructions && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Instrucciones Generales</Text>
            <Text style={styles.text}>{prescription.instructions}</Text>
          </View>
        )}
      </Page>
    </Document>
  );

  const downloadPDF = async () => {
    const element = document.getElementById('prescription-preview');
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`receta_${prescription.patient_name}_${format(new Date(prescription.created_at), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={downloadPDF}>
          <FileDown className="mr-2 h-4 w-4" />
          Descargar PDF
        </Button>
      </div>

      <Card id="prescription-preview">
        <CardHeader>
          <CardTitle className="text-center">Receta Médica</CardTitle>
          <div className="text-sm text-muted-foreground text-right">
            {format(new Date(prescription.created_at), 'PPP', { locale: es })}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-medium mb-2">Médico</h3>
            <p>Dr. {prescription.doctor_name}</p>
            <p className="text-muted-foreground">Especialidad: {prescription.doctor_specialty}</p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Paciente</h3>
            <p>{prescription.patient_name}</p>
            {prescription.patient_age && (
              <p className="text-muted-foreground">Edad: {prescription.patient_age} años</p>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-2">Diagnóstico</h3>
            <p>{prescription.diagnosis}</p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Medicamentos</h3>
            <div className="space-y-4">
              {prescription.medications.map((med, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <p className="font-medium">{med.name}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>Dosis: {med.dosage}</p>
                      <p>Frecuencia: {med.frequency}</p>
                      <p>Duración: {med.duration}</p>
                      {med.instructions && (
                        <p className="text-muted-foreground">
                          Instrucciones: {med.instructions}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {prescription.instructions && (
            <div>
              <h3 className="font-medium mb-2">Instrucciones Generales</h3>
              <p className="whitespace-pre-line">{prescription.instructions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="h-[600px] border rounded-md">
        <PDFViewer width="100%" height="100%">
          <PrescriptionDocument />
        </PDFViewer>
      </div>
    </div>
  );
}
