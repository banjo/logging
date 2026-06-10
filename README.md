# @banjoanton/logging

Small structured logger for request-scoped wide events. Built on Pino.

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

```ts
try {
  await saveOrder();
} catch (error) {
  if (error instanceof Error) {
    logger.error(error, { orderId: "order_123" });
  }

  logger.emit({ statusCode: 500 });
}
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
