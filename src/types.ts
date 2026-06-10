import type { Level, LoggerOptions } from "pino";

export type LogContext = Record<string, unknown>;

export type ContextLoggerConfig = {
  name?: string;
  level?: Level;
  enabled?: boolean;
  pretty?: boolean;
  emitMessage?: string;
  pino?: LoggerOptions;
};

export type LogFields<TWideEventFields extends LogContext = LogContext> =
  Partial<TWideEventFields>;

export type LogMessageMethod<TWideEventFields extends LogContext = LogContext> =
  (msg: string, context?: LogFields<TWideEventFields>) => void;

export type LogErrorMethod<TWideEventFields extends LogContext = LogContext> = (
  msgOrErr: string | Error,
  context?: LogFields<TWideEventFields>,
) => void;

export type ContextLogger<TWideEventFields extends LogContext = LogContext> = {
  debug: LogMessageMethod<TWideEventFields>;
  info: LogMessageMethod<TWideEventFields>;
  warn: LogMessageMethod<TWideEventFields>;
  error: LogErrorMethod<TWideEventFields>;
  fatal: LogMessageMethod<TWideEventFields>;
  child: (source: string) => ContextLogger<TWideEventFields>;
  addContext: (fields: LogFields<TWideEventFields>) => void;
  addError: (error: Error, fields?: LogFields<TWideEventFields>) => void;
  emit: (fields?: LogFields<TWideEventFields>) => void;
};

export type LogContextApi<TWideEventFields extends LogContext = LogContext> = {
  run: <T>(context: LogFields<TWideEventFields>, fn: () => T) => T;
  get: () => LogFields<TWideEventFields>;
  addContext: (fields: LogFields<TWideEventFields>) => void;
};

export type LoggerKit<TWideEventFields extends LogContext = LogContext> = {
  createLogger: (source: string) => ContextLogger<TWideEventFields>;
  logContext: LogContextApi<TWideEventFields>;
};

export type BaseWideEventFields = {
  source?: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  error?: {
    type: string;
    message: string;
    code?: string;
    stack?: string;
    cause?: unknown;
  };
};
