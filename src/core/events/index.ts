/**
 * Helpa Core Platform — Event Bus
 *
 * Reusable, industry-agnostic event system for inter-module communication.
 * Industry modules subscribe to Core events without Core having hardcoded dependencies.
 */

export type CoreEventType =
  | 'conversation.created'
  | 'message.received'
  | 'message.sent'
  | 'contact.created'
  | 'contact.updated'
  | 'contact.tag_added'
  | 'contact.tag_removed'
  | 'deal.created'
  | 'deal.updated'
  | 'deal.stage_changed'
  | 'deal.won'
  | 'deal.lost'
  | 'campaign.created'
  | 'campaign.completed'
  | 'automation.triggered'
  | 'notification.created'
  | 'notification.sent'
  | 'ai.replied'
  | 'booking.created'
  | 'booking.updated';

export interface CoreEvent<T = Record<string, unknown>> {
  id: string;
  type: CoreEventType;
  accountId: string;
  timestamp: string;
  payload: T;
}

export interface CrmEventDispatchParams {
  accountId: string;
  eventType:
    | 'deal.created'
    | 'deal.updated'
    | 'deal.stage_changed'
    | 'deal.won'
    | 'deal.lost'
    | 'contact.created'
    | 'contact.updated'
    | 'contact.tag_added'
    | 'contact.tag_removed';
  dealId?: string;
  contactId?: string;
  payload: Record<string, unknown>;
}

export async function dispatchCrmEvent(
  params: CrmEventDispatchParams
): Promise<void> {
  return coreEvents.emit(params.eventType, params.accountId, {
    dealId: params.dealId,
    contactId: params.contactId,
    ...params.payload,
  });
}

export type EventHandler<T = Record<string, unknown>> = (
  event: CoreEvent<T>
) => Promise<void> | void;

class CoreEventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  public subscribe<T = Record<string, unknown>>(
    eventType: CoreEventType | string,
    handler: EventHandler<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const set = this.listeners.get(eventType)!;
    set.add(handler as EventHandler);

    return () => {
      set.delete(handler as EventHandler);
    };
  }

  public on<T = Record<string, unknown>>(
    eventType: CoreEventType | string,
    handler: EventHandler<T>
  ): () => void {
    return this.subscribe(eventType, handler);
  }

  public async emit<T = Record<string, unknown>>(
    type: CoreEventType | string,
    accountId: string,
    payload: T
  ): Promise<void> {
    const event: CoreEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: type as CoreEventType,
      accountId,
      timestamp: new Date().toISOString(),
      payload,
    };

    const handlers = this.listeners.get(type);
    if (handlers && handlers.size > 0) {
      await Promise.all(
        Array.from(handlers).map(async (handler) => {
          try {
            await handler(event as CoreEvent<Record<string, unknown>>);
          } catch (err) {
            console.error(
              `[EventBus] Error in handler for event '${type}':`,
              err
            );
          }
        })
      );
    }
  }
}

export const coreEvents = new CoreEventBus();
