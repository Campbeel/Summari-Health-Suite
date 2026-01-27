import { getStripeSync } from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }

  static async handlePaymentSuccess(paymentIntent: any): Promise<void> {
    try {
      const appointmentId = paymentIntent.metadata?.appointmentId;
      
      if (appointmentId) {
        await storage.updateAppointment(parseInt(appointmentId), {
          paymentStatus: "paid",
          stripePaymentIntentId: paymentIntent.id,
          status: "confirmed",
        });
        console.log(`Payment successful for appointment ${appointmentId}`);
      }
    } catch (error) {
      console.error("Error handling payment success:", error);
    }
  }

  static async handlePaymentFailed(paymentIntent: any): Promise<void> {
    try {
      const appointmentId = paymentIntent.metadata?.appointmentId;
      
      if (appointmentId) {
        await storage.updateAppointment(parseInt(appointmentId), {
          paymentStatus: "pending",
        });
        console.log(`Payment failed for appointment ${appointmentId}`);
      }
    } catch (error) {
      console.error("Error handling payment failure:", error);
    }
  }
}
