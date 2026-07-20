/**
 * A lightweight, centralized logging utility for Verifii.
 * Currently wraps console.*, but provides a stable public API
 * to trivially swap out for Sentry, Axiom, BetterStack, etc.
 *
 * Future Migration: To swap providers, simply replace the internal
 * console calls within this object. The rest of the application
 * will remain unaffected.
 */

/**
 * Standardized event names for all logged actions.
 * Centralizing these prevents typos and allows for clean
 * aggregation and filtering in logging dashboards.
 */
export const LogEvent = {
  STARTUP_DUPLICATE_SUBMISSION: "startup_duplicate_submission",
  STARTUP_SUBMISSION_FAILURE: "startup_submission_failure",
  VERIFICATION_LOG_FAILURE: "verification_log_failure",
  VERIFICATION_LOG_EXCEPTION: "verification_log_exception",
  PROVIDER_CONNECTION_FAILURE: "provider_connection_failure",
  PROVIDER_CONNECTION_EXCEPTION: "provider_connection_exception",
  SUBMISSION_COUNT_ERROR: "submission_count_error",
  API_SUBMISSION_ERROR: "api_submission_error",
  SUBMISSIONS_FETCH_ERROR: "submissions_fetch_error",
  SUBMISSIONS_GET_EXCEPTION: "submissions_get_exception",
} as const;

export type LogEventName = typeof LogEvent[keyof typeof LogEvent];

/**
 * Typed metadata structure for logs.
 * Provides autocomplete and type safety for common log fields
 * while allowing flexible inclusion of arbitrary custom fields.
 */
export interface BaseLogMetadata {
  event?: LogEventName;
  userId?: string;
  startupId?: number;
  startupName?: string;
  provider?: string;
  code?: string;
  error?: string;
  constraint?: string;
  message?: string;
}

export type LogMetadata = BaseLogMetadata & Record<string, unknown>;

const getBaseMetadata = () => ({
  env: process.env.NODE_ENV || "development",
  service: "verifii-api",
  timestamp: new Date().toISOString(),
});

/**
 * Injects baseline metadata (env, service, timestamp) into
 * every outgoing log payload to guarantee observability context.
 */
function attachMetadata(meta?: LogMetadata) {
  return { ...getBaseMetadata(), ...meta };
}

/**
 * The frozen singleton logger instance.
 * Exposes standard severity levels: debug, info, warn, error, fatal.
 */
export const logger = Object.freeze({
  debug: (message: string, meta?: LogMetadata) => {
    console.debug(message, attachMetadata(meta));
  },
  
  info: (message: string, meta?: LogMetadata) => {
    console.info(message, attachMetadata(meta));
  },
  
  warn: (message: string, meta?: LogMetadata) => {
    console.warn(message, attachMetadata(meta));
  },
  
  error: (message: string, meta?: LogMetadata) => {
    console.error(message, attachMetadata(meta));
  },
  
  fatal: (message: string, meta?: LogMetadata) => {
    console.error(`FATAL: ${message}`, attachMetadata(meta));
  }
});
