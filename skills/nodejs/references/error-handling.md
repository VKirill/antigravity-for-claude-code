# Node.js 24 — Error Handling Patterns

> Node.js 24.14.1 | Updated: 2026-05-15

---

## AppError — Structured Domain Errors

```ts
// src/shared/errors/app-error.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    options?: ErrorOptions, // { cause: Error } — Node 16.9+
  ) {
    super(message, options);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor); // cleaner stack trace
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly fields: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 422);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}
```

---

## error.cause — Wrapping Without Losing Context

`error.cause` (Node 16.9+, stable in 24) — preserve original error while adding context:

```ts
// Wrap low-level errors at service boundaries
async function fetchUserFromDB(id: string): Promise<User> {
  try {
    return await db.user.findUniqueOrThrow({ where: { id } });
  } catch (error) {
    throw new AppError(
      `Failed to fetch user ${id}`,
      'DB_FETCH_ERROR',
      500,
      { cause: error }, // original Prisma/pg error preserved
    );
  }
}

// Logging with full cause chain
function logErrorChain(error: unknown, depth = 0): void {
  if (!(error instanceof Error)) return;
  logger.error(`${'  '.repeat(depth)}${error.name}: ${error.message}`, {
    stack: depth === 0 ? error.stack : undefined,
  });
  if (error.cause) logErrorChain(error.cause, depth + 1);
}
```

---

## AggregateError — Parallel Failure Collection

`AggregateError` (Node 15+, common in 24) surfaces multiple errors from parallel operations:

```ts
// Promise.any throws AggregateError if ALL promises reject
async function fetchFromAnyProvider(urls: string[]): Promise<Response> {
  try {
    return await Promise.any(urls.map(url => fetch(url)));
  } catch (error) {
    if (error instanceof AggregateError) {
      // error.errors: Error[] — one per failed promise
      const details = error.errors.map(e => ({
        name: e.name,
        message: e.message,
      }));
      throw new AppError('All providers failed', 'ALL_PROVIDERS_FAILED', 503, {
        cause: error,
      });
    }
    throw error;
  }
}

// Manual AggregateError for batch operations
async function processBatch<T>(items: T[], process: (item: T) => Promise<void>): Promise<void> {
  const results = await Promise.allSettled(items.map(process));
  const failures = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => r.reason instanceof Error ? r.reason : new Error(String(r.reason)));

  if (failures.length > 0) {
    throw new AggregateError(failures, `Batch failed: ${failures.length}/${items.length} errors`);
  }
}
```

---

## Unhandled Rejections & Uncaught Exceptions

```ts
// src/app/index.ts — process-level safety net (not a substitute for proper handling)

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? sanitizeError(reason) : String(reason),
  });
  // In Node 24 unhandledRejection defaults to exit — make it explicit
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception — exiting', sanitizeError(error));
  // Flush logs, then exit — do NOT continue (undefined state)
  process.exit(1);
});

// Warning — not an error, but log it
process.on('warning', (warning) => {
  logger.warn('Node.js warning', {
    name: warning.name,
    message: warning.message,
    code: (warning as NodeJS.ErrnoException).code,
  });
});
```

---

## Error Sanitization — Never Log Raw Errors

```ts
// src/shared/lib/logger.ts
interface SanitizedError {
  name: string;
  message: string;
  code?: string;
  cause?: SanitizedError;
}

export function sanitizeError(error: unknown): SanitizedError {
  if (!(error instanceof Error)) {
    return { name: 'UnknownError', message: String(error) };
  }
  return {
    name: error.name,
    message: error.message, // do NOT include stack in structured logs
    code: (error as NodeJS.ErrnoException).code,
    cause: error.cause ? sanitizeError(error.cause) : undefined,
  };
}

// Usage: always sanitize before logging
logger.error('DB operation failed', {
  ...sanitizeError(error),
  userId,
  operation: 'createUser',
});
```

---

## Startup Validation — Fail Fast

```ts
// src/app/index.ts
async function main() {
  // 1. Env validation before any I/O
  let env: Env;
  try {
    env = validateEnv(); // throws ZodError with field details
  } catch (error) {
    console.error('Environment validation failed:', sanitizeError(error));
    process.exit(1); // exit code 1 signals misconfiguration to orchestrators
  }

  // 2. External connectivity check (optional but recommended)
  try {
    await db.$connect();
    await redis.ping();
  } catch (error) {
    logger.error('Startup connectivity check failed', sanitizeError(error));
    await db.$disconnect().catch(() => {});
    process.exit(1);
  }

  // 3. Server start
  try {
    await server.listen({ port: env.PORT, host: '127.0.0.1' });
    logger.info('Server started', { port: env.PORT });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      logger.error('Port already in use', { port: env.PORT });
    } else {
      logger.error('Failed to start server', sanitizeError(error));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
```

---

## Express 5 Error Middleware

```ts
// src/shared/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction, // 4 args required by Express
): void {
  // Zod validation errors → 422
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        fields: err.flatten().fieldErrors,
      },
    });
    return;
  }

  // Domain errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Application error', { path: req.path, ...sanitizeError(err) });
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Unexpected — log full error, return generic 500
  logger.error('Unhandled error', {
    path: req.path,
    method: req.method,
    ...sanitizeError(err),
  });
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
```

---

## Fastify Error Handler

```ts
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(422).send({
      error: { code: 'VALIDATION_ERROR', fields: error.flatten().fieldErrors },
    });
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  // Fastify validation errors (AJV)
  if (error.validation) {
    return reply.status(400).send({
      error: { code: 'SCHEMA_VALIDATION', message: error.message, details: error.validation },
    });
  }

  fastify.log.error({ err: sanitizeError(error), req: request.id }, 'Unhandled error');
  return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});
```
