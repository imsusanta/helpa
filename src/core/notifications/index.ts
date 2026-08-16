/**
 * Helpa Core Platform — Notifications Engine
 *
 * Tenant-aware notification dispatcher across WhatsApp and In-App channels.
 */

import { coreEvents } from '@/core/events';

export interface NotificationPayload {
  recipientPhone?: string;
  recipientEmail?: string;
  recipientUserId?: string;
  title: string;
  body: string;
  channel?: 'whatsapp' | 'in_app' | 'email';
}

export async function sendNotification(
  accountId: string,
  payload: NotificationPayload
): Promise<boolean> {
  const channel = payload.channel || 'whatsapp';

  if (channel === 'whatsapp' && payload.recipientPhone) {
    try {
      await coreEvents.emit('notification.sent', accountId, {
        channel: 'whatsapp',
        recipientPhone: payload.recipientPhone,
        title: payload.title,
        body: payload.body,
      });

      return true;
    } catch (err) {
      console.error(
        '[Notifications] Failed to send WhatsApp notification:',
        err
      );
      return false;
    }
  }

  return true;
}
