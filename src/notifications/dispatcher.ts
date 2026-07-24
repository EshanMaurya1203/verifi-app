import type { NotificationEvent } from "./events";
import { getNotificationDefinition, getNotificationChannels } from "./registry";
import { emailAdapter } from "./email/adapter";
import type { DeliveryAdapter, NotificationChannel, DispatchNotificationResult, ChannelDeliveryResult } from "./types";
import { logger, LogEvent } from "@/lib/logger";

/**
 * Maps channel names to their concrete adapters.
 * Future channels (IN_APP, PUSH, SLACK, etc.) will register their adapters here.
 */
const adapters: Partial<Record<NotificationChannel, DeliveryAdapter>> = {
  EMAIL: emailAdapter,
};

/**
 * Register a channel delivery adapter dynamically.
 * Allows adding new adapters (Slack, Push, In-App) without modifying dispatcher logic.
 */
export function registerDeliveryAdapter(adapter: DeliveryAdapter): void {
  adapters[adapter.channel] = adapter;
  logger.info(`[Dispatcher] Registered delivery adapter for channel: ${adapter.channel}`);
}

/**
 * The central Notification Dispatcher.
 * 
 * Flow:
 * Business Event → Registry Lookup (Category, Priority, Channels) → Channel Resolution → Delivery Adapter → Central Logger
 * 
 * Key Principles (ADR-019, ADR-020, ADR-023, ADR-024):
 * 1. Synchronous execution in-process for MVP simplicity.
 * 2. Pure delivery orchestration only — zero business logic.
 * 3. Channel isolation guaranteed via Promise.allSettled and try/catch boundaries.
 * 4. Exclusively uses Centralized Logger (`logger.ts`).
 */
export async function dispatchNotification(event: NotificationEvent): Promise<DispatchNotificationResult> {
  const definition = getNotificationDefinition(event.type);
  const channels = definition.defaultChannels ?? getNotificationChannels(event.type);
  const metadata = event.metadata;
  const correlationId = metadata?.correlationId ?? event.correlationId;
  const eventId = metadata?.eventId;
  const source = metadata?.source;
  const version = metadata?.version;

  logger.info(`[Dispatcher] Starting dispatch for ${event.type}`, {
    event: LogEvent.NOTIFICATION_DISPATCH_STARTED,
    eventType: event.type,
    category: definition.category,
    priority: definition.priority,
    correlationId,
    eventId,
    source,
    version,
  });

  if (!channels || channels.length === 0) {
    logger.warn(`[Dispatcher] No channels configured for event ${event.type}`);
    return { success: true, channels: [] };
  }

  // Fan-out delivery to all registered channels
  const promises = channels.map(async (channel): Promise<ChannelDeliveryResult> => {
    const adapter = adapters[channel];
    const startTime = performance.now();
    
    if (!adapter) {
      logger.error(`[Dispatcher] Missing adapter for channel ${channel}`, {
        event: LogEvent.CHANNEL_DELIVERY_FAILED,
        eventType: event.type,
        channel,
        error: `Missing adapter for channel ${channel}`,
        retryable: false,
      });
      return {
        channel,
        success: false,
        retryable: false,
        error: `Missing adapter for channel ${channel}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    logger.debug(`[Dispatcher] Delivering via ${channel}...`, {
      event: LogEvent.CHANNEL_DELIVERY_STARTED,
      eventType: event.type,
      category: definition.category,
      priority: definition.priority,
      channel,
      correlationId,
      eventId,
      source,
    });

    try {
      const result = await adapter.deliver(event);
      const durationMs = Math.round(performance.now() - startTime);
      
      if (!result.success) {
        logger.error(`[Dispatcher] Failed to deliver ${event.type} to ${channel}`, {
          event: LogEvent.CHANNEL_DELIVERY_FAILED,
          eventType: event.type,
          channel,
          error: result.error,
          errorCode: result.code,
          retryable: result.retryable,
          durationMs,
          correlationId,
          eventId,
        });
        
        return {
          channel,
          success: false,
          retryable: result.retryable,
          error: result.error,
          durationMs,
        };
      }

      logger.info(`[Dispatcher] Successfully delivered ${event.type} to ${channel}`, {
        event: LogEvent.CHANNEL_DELIVERY_COMPLETED,
        eventType: event.type,
        channel,
        durationMs,
        correlationId,
        eventId,
        providerMessageId: result.messageId,
      });

      return {
        channel,
        success: true,
        retryable: false,
        providerMessageId: result.messageId,
        durationMs,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      const message = err instanceof Error ? err.message : "Unknown error";
      
      logger.error(`[Dispatcher] Uncaught exception delivering ${event.type} to ${channel}`, {
         event: LogEvent.CHANNEL_DELIVERY_FAILED,
         eventType: event.type,
         channel,
         error: message,
         retryable: true,
         durationMs,
         correlationId,
         eventId,
      });
      
      return {
        channel,
        success: false,
        retryable: true,
        error: message,
        durationMs,
      };
    }
  });

  const settledResults = await Promise.allSettled(promises);
  
  const results = settledResults.map((r, index) => 
    r.status === "fulfilled" ? r.value : {
      channel: channels[index] ?? ("EMAIL" as NotificationChannel), 
      success: false,
      retryable: true,
      error: "Unexpected Promise Rejection",
      durationMs: 0
    }
  );

  const allSuccessful = results.every(r => r.success);

  logger.info(`[Dispatcher] Dispatch completed for ${event.type}`, {
    event: LogEvent.NOTIFICATION_DISPATCH_COMPLETED,
    eventType: event.type,
    category: definition.category,
    priority: definition.priority,
    success: allSuccessful,
    correlationId,
    eventId,
  });

  return {
    success: allSuccessful,
    channels: results,
  };
}
