import { getLogLevel } from "@/config/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN =
  /(secret|password|passwd|token|api[_-]?key|authorization|cookie|credential|private[_-]?key)/i;

function shouldLog(level: LogLevel): boolean {
  try {
    const configured = getLogLevel();
    return LEVEL_ORDER[level] >= LEVEL_ORDER[configured];
  } catch {
    // If env is misconfigured, still emit errors.
    return level === "error" || level === "warn";
  }
}

function sanitizeValue(value: unknown): unknown {
  if (value == null) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }
  if (typeof value === "object") {
    return sanitizeContext(value as Record<string, unknown>);
  }
  return String(value);
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) {
    return undefined;
  }

  const result: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = "[redacted]";
      continue;
    }
    result[key] = sanitizeValue(value);
  }
  return result;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const safeContext = sanitizeContext(context);
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(safeContext ? { context: safeContext } : {}),
  };

  const isProduction = process.env.NODE_ENV === "production";
  const line = isProduction
    ? JSON.stringify(entry)
    : `[${entry.timestamp}] ${level.toUpperCase()} ${message}${
        entry.context ? ` ${JSON.stringify(entry.context)}` : ""
      }`;

  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

/**
 * Server logger abstraction.
 * Domain code should depend on this module, not on `console` directly.
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    emit("debug", message, context);
  },
  info(message: string, context?: LogContext): void {
    emit("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    emit("warn", message, context);
  },
  error(message: string, context?: LogContext): void {
    emit("error", message, context);
  },
};
