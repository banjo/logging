# @banjoanton/logging

Small structured logger for request-scoped wide events. Built on Pino.

Inspired by [Logging Sucks](https://loggingsucks.com/).

Why this is useful:

- One wide event per request or job.
- Request context follows async code automatically.
- Simple setup and API.
- Built on Pino, so you get all the benefits of a battle-tested logger and ecosystem.

## Install

```bash
pnpm add @banjoanton/logging
```

## Basic Usage

Create one logger kit for the whole app. Each file creates its own `logger` with a source name.

```ts
import { createLoggerKit, type BaseWideEventFields } from "@banjoanton/logging";

type AppLogFields = BaseWideEventFields & {
  userId?: string;
  companyId?: string;
  action?: "user.create";
};

export const { createLogger, logContext } = createLoggerKit<AppLogFields>({
  name: "my-app",
  emitMessage: "request complete",
});
```

```ts
import { createLogger, logContext } from "./logging";

const logger = createLogger("user-service");

await logContext.run(
  { requestId: crypto.randomUUID(), method: "POST", path: "/users" },
  async () => {
    logger.addContext({
      action: "user.create",
      companyId: "company_123",
      userId: "user_123",
    });

    logger.emit({
      statusCode: 201,
      durationMs: 42,
    });
  },
);
```

## Complete Example: Hono Middleware + User Service

Create the kit once for the whole app, add request context in middleware, then let services add domain-specific fields while the request runs.

### `logging.ts`

```ts
import { createLoggerKit, type BaseWideEventFields } from "@banjoanton/logging";

type AppLogFields = BaseWideEventFields & {
  userId?: string;
  email?: string;
  action?: "user.create";
};

export const { createLogger, logContext } = createLoggerKit<AppLogFields>({
  name: "my-app",
  emitMessage: "request complete",
  pretty: false,
});
```

### `middleware/request-logger.ts`

```ts
import { createLogger, logContext } from "../logging";

const logger = createLogger("http");

export async function requestLogger(c, next) {
  const start = Date.now();

  await logContext.run(
    {
      requestId: crypto.randomUUID(),
      method: c.req.method,
      path: c.req.path,
    },
    async () => {
      try {
        await next();

        logger.emit({
          statusCode: c.res.status,
          durationMs: Date.now() - start,
        });
      } catch (error) {
        if (error instanceof Error) {
          logger.addError(error);
        }

        logger.emit({
          statusCode: 500,
          durationMs: Date.now() - start,
        });

        throw error;
      }
    },
  );
}
```

### `services/user-service.ts`

```ts
import { createLogger } from "../logging";

const logger = createLogger("user-service");

export class UserService {
  async createUser(input: { email: string }) {
    const user = {
      id: crypto.randomUUID(),
      email: input.email,
    };

    logger.addContext({
      action: "user.create",
      userId: user.id,
      email: user.email,
    });

    return user;
  }
}
```

### `routes/users.ts`

```ts
import { Hono } from "hono";
import { UserService } from "../services/user-service";

const userService = new UserService();
export const users = new Hono();

users.post("/users", async (c) => {
  const body = await c.req.json<{ email: string }>();
  const user = await userService.createUser(body);

  return c.json(user, 201);
});
```

### `app.ts`

```ts
import { Hono } from "hono";
import { requestLogger } from "./middleware/request-logger";
import { users } from "./routes/users";

const app = new Hono();

app.use(requestLogger);
app.route("/", users);
```

Example request:

```bash
curl -X POST http://localhost:3000/users \
  -H 'content-type: application/json' \
  -d '{"email":"ada@example.com"}'
```

Example log output:

```json
{
  "level": 30,
  "time": "2026-06-11T09:15:42.123Z",
  "pid": 12345,
  "hostname": "hermes",
  "name": "my-app",
  "source": "http",
  "requestId": "78d2f8a5-b1b2-4a0e-9c2d-2f6c4b8c4d91",
  "method": "POST",
  "path": "/users",
  "action": "user.create",
  "userId": "6d5c9b8a-9f7f-4c8a-a0c1-99f2d6f0b2a4",
  "email": "ada@example.com",
  "statusCode": 201,
  "durationMs": 18,
  "msg": "request complete"
}
```

## Child Loggers

```ts
const dbLogger = logger.child("db");

dbLogger.emit({ durationMs: 12 });
// source: "user-service.db"
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
  emitMessage: "request complete",
});

const logger = createLogger("http");
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
