# @banjoanton/logging

Small structured logger for request-scoped wide events. Built on Pino.

Inspired by [Logging Sucks](https://loggingsucks.com/).

Why this is useful:

- One wide event per request or job.
- Request context follows async code automatically.
- Simple setup and API
- Built on Pino, so you get all the benefits of a battle-tested logger and ecosystem.

## Install

```bash
pnpm add @banjoanton/logging
```

## Basic Usage

```ts
import { createLoggerKit, type BaseWideEventFields } from "@banjoanton/logging";

type LogFields = BaseWideEventFields & {
  companyId?: string;
  orderId?: string;
};

const { createLogger, logContext } = createLoggerKit<LogFields>({
  name: "api",
  emitMessage: "request",
});

const logger = createLogger("request");

await logContext.run({ requestId: crypto.randomUUID(), path: "/orders" }, async () => {
  logger.addContext({ companyId: "company_123" });

  logger.emit({
    statusCode: 200,
    durationMs: 42,
  });
});
```

## Child Loggers

```ts
const dbLogger = logger.child("db");

dbLogger.emit({ durationMs: 12 });
// source: "request.db"
```

## Error Logs

Add errors to the final wide event:

```ts
try {
  await saveOrder();
} catch (error) {
  if (error instanceof Error) {
    logger.addError(error, { orderId: "order_123" });
  }

  logger.emit({ statusCode: 500 });
}
```

Log an immediate escape-hatch error:

```ts
logger.error(error, { orderId: "order_123" });
```

## Hono Middleware

```ts
import { Hono } from "hono";
import { createLoggerKit, type BaseWideEventFields } from "@banjoanton/logging";

const { createLogger, logContext } = createLoggerKit<BaseWideEventFields>({
  name: "api",
  emitMessage: "request",
});

const logger = createLogger("request");
const app = new Hono();

app.use(async (c, next) => {
  const start = Date.now();

  await logContext.run(
    { requestId: crypto.randomUUID(), method: c.req.method, path: c.req.path },
    async () => {
      try {
        await next();
        logger.emit({ statusCode: c.res.status, durationMs: Date.now() - start });
      } catch (error) {
        if (error instanceof Error) {
          logger.addError(error);
        }
        logger.emit({ statusCode: 500, durationMs: Date.now() - start });
        throw error;
      }
    },
  );
});
```

## Pino Options

```ts
const kit = createLoggerKit({
  name: "api",
  pino: {
    redact: ["password", "authorization", "cookie"],
  },
});
```

Prefer one `emit()` per request/job. Use `info`, `warn`, and `error` for escape-hatch logs.
