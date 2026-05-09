import { WebhookPayload } from '../core/types';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class WebhookService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async sendAlert(alertId: string, payload: WebhookPayload): Promise<void> {
    const endpoints = await this.getActiveEndpoints(payload.alertType);
    
    const promises = endpoints.map(endpoint => 
      this.sendToEndpoint(endpoint, payload)
    );
    
    await Promise.allSettled(promises);
  }

  private async getActiveEndpoints(alertType: string) {
    return await this.prisma.webhookEndpoint.findMany({
      where: {
        isActive: true,
        alertTypes: {
          has: alertType
        }
      }
    });
  }

  private async sendToEndpoint(endpoint: any, payload: WebhookPayload): Promise<void> {
    try {
      const signature = this.generateSignature(payload, endpoint.secret);
      
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stellar-Guardian-Signature': signature,
          'User-Agent': 'Stellar-Guardian/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`Webhook sent to ${endpoint.url}`);
    } catch (error) {
      console.error(`Failed to send webhook to ${endpoint.url}:`, error);
    }
  }

  private generateSignature(payload: WebhookPayload, secret?: string): string {
    if (!secret) return '';
    
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  async registerEndpoint(url: string, secret?: string, alertTypes: string[] = ['*']): Promise<string> {
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        url,
        secret,
        alertTypes,
        isActive: true
      }
    });

    return endpoint.id;
  }

  // TODO: add update and delete methods
}