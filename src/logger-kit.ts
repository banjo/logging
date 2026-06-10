import pino, { type LoggerOptions } from "pino";

import { createLogContext } from "./log-context.ts";
import type {
  ContextLogger,
  ContextLoggerConfig,
  LoggerKit,
  LogContext,
  LogErrorMethod,
  LogFields,
  LogMessageMethod,
} from "./types.ts";

const isDev = process.env.NODE_ENV !== "production";

const DEFAULT_CONFIG = {
  name: "app",
  level: (process.env.LOG_LEVEL as ContextLoggerConfig["level"]) ?? "info",
  enabled: process.env.NODE_ENV !== "test",
  pretty: isDev,
  emitMessage: "event",
} satisfies Required<Omit<ContextLoggerConfig, "pino">>;

const createPinoInstance = (
  config: Required<Omit<ContextLoggerConfig, "pino">> & {
    pino?: LoggerOptions;
  },
) => {
  const base: LoggerOptions = {
    name: config.name,
    level: config.level,
    enabled: config.enabled,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...config.pino,
  };

  if (!config.pretty || base.transport) {
    return pino(base);
  }

  try {
    return pino({
      ...base,
      transport: { target: "pino-pretty", options: { colorize: true } },
    });
  } catch {
    return pino(base);
  }
};

const formatError = (err: Error): LogContext => ({
  error: {
    type: err.constructor.name,
    message: err.message,
    stack: err.stack,
    cause: err.cause,
    ...("code" in err && { code: (err as { code: string }).code }),
  },
});

const resolveLevel = (event: LogContext): "error" | "warn" | "info" => {
  const status = event.statusCode as number | undefined;
  if (status && status >= 500) {
    return "error";
  }
  if (status && status >= 400) {
    return "warn";
  }
  if (event.error) {
    return "error";
  }
  return "info";
};

export const createLoggerKit = <
  TWideEventFields extends LogContext = LogContext,
>(
  config: ContextLoggerConfig = {},
): LoggerKit<TWideEventFields> => {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config };
  const instance = createPinoInstance(resolvedConfig);
  const logContext = createLogContext<TWideEventFields>();

  const createMsgLogMethod = (
    level: "debug" | "info" | "warn" | "fatal",
  ): LogMessageMethod<TWideEventFields> => {
    return (msg, context) => {
      const stored = logContext.get();
      instance[level]({ ...stored, ...context } as LogContext, msg);
    };
  };

  const createErrorLogMethod = (): LogErrorMethod<TWideEventFields> => {
    return (msgOrErr, context) => {
      const stored = logContext.get();

      if (msgOrErr instanceof Error) {
        const errorFields = formatError(msgOrErr);
        instance.error(
          { ...stored, ...errorFields, ...context } as LogContext,
          msgOrErr.message,
        );
        return;
      }

      instance.error({ ...stored, ...context } as LogContext, msgOrErr);
    };
  };

  const createLogger = (source: string): ContextLogger<TWideEventFields> => {
    const withSource = (
      context?: LogFields<TWideEventFields>,
    ): LogFields<TWideEventFields> =>
      ({
        source,
        ...context,
      }) as unknown as LogFields<TWideEventFields>;

    const debug: LogMessageMethod<TWideEventFields> = (msg, context) => {
      createMsgLogMethod("debug")(msg, withSource(context));
    };

    const info: LogMessageMethod<TWideEventFields> = (msg, context) => {
      createMsgLogMethod("info")(msg, withSource(context));
    };

    const warn: LogMessageMethod<TWideEventFields> = (msg, context) => {
      createMsgLogMethod("warn")(msg, withSource(context));
    };

    const error: LogErrorMethod<TWideEventFields> = (msgOrErr, context) => {
      createErrorLogMethod()(msgOrErr, withSource(context));
    };

    const fatal: LogMessageMethod<TWideEventFields> = (msg, context) => {
      createMsgLogMethod("fatal")(msg, withSource(context));
    };

    const child = (childSource: string): ContextLogger<TWideEventFields> => {
      return createLogger(`${source}.${childSource}`);
    };

    const addContext = (fields: LogFields<TWideEventFields>): void => {
      logContext.addContext(fields);
    };

    const emit = (fields?: LogFields<TWideEventFields>): void => {
      const stored = logContext.get();
      const event = { source, ...stored, ...fields };
      const level = resolveLevel(event);
      instance[level](event as LogContext, resolvedConfig.emitMessage);
    };

    return { debug, info, warn, error, fatal, child, addContext, emit };
  };

  return { createLogger, logContext };
};
