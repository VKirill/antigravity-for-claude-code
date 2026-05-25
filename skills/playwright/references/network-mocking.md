# Network Mocking and HAR

Playwright intercepts network at the browser level — works for any HTTP request the page makes, including fetch, XHR, and resource loads.

## `page.route()` — Intercept and Fulfill

```ts
// Mock a JSON API response
await page.route('**/api/users', route =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ users: [{ id: 1, name: 'Alice' }] }),
  })
);

// Shorthand for JSON
await page.route('**/api/users', route =>
  route.fulfill({ json: [{ id: 1, name: 'Alice' }] })
);

await page.goto('/users');
```

## URL Matching Patterns

```ts
// Glob patterns
page.route('**/api/**')           // any path under /api
page.route('https://api.example.com/**')
page.route('**/users*')           // /users, /users?page=2, etc.

// String (exact URL)
page.route('https://api.example.com/users')

// Regex
page.route(/\/api\/users\/\d+/)

// Predicate function
page.route(url => url.searchParams.has('debug'), route => route.abort())
```

## Response Options

```ts
await page.route('**/api/data', route => route.fulfill({
  status: 200,                      // HTTP status
  headers: {                        // response headers
    'Content-Type': 'application/json',
    'X-Custom-Header': 'value',
  },
  body: '{"key":"value"}',          // raw string body
  json: { key: 'value' },           // JSON shorthand (auto sets Content-Type)
  path: './fixtures/response.json', // load from file
}));
```

## Abort and Continue

```ts
// Abort a request (e.g., images, analytics, ad scripts)
await page.route('**/*.{png,jpg,jpeg,gif,webp}', route => route.abort());
await page.route('**/analytics/**', route => route.abort());

// Continue with modifications (modify request before it goes out)
await page.route('**/api/data', async route => {
  const request = route.request();
  await route.continue({
    headers: {
      ...request.headers(),
      Authorization: 'Bearer test-token',
    },
  });
});
```

## Modify Response (Passthrough + Modify)

```ts
// Pass through to real server, then modify the response
await page.route('**/api/users', async route => {
  const response = await route.fetch();
  const json = await response.json();

  // Inject test data
  json.push({ id: 999, name: 'Test User' });

  await route.fulfill({
    response,
    json,
  });
});
```

## Error Simulation

```ts
// Network error (connection refused)
await page.route('**/api/critical', route =>
  route.abort('failed')
);

// Timeout simulation (slow response)
await page.route('**/api/slow', async route => {
  await new Promise(resolve => setTimeout(resolve, 5000));
  await route.fulfill({ json: {} });
});

// HTTP error status
await page.route('**/api/data', route =>
  route.fulfill({ status: 500, body: 'Internal Server Error' })
);

// 401 Unauthorized
await page.route('**/api/protected', route =>
  route.fulfill({ status: 401, json: { error: 'Unauthorized' } })
);
```

## Unroute — Remove a Mock

```ts
const handler = route => route.fulfill({ json: [] });
await page.route('**/api/items', handler);

// ... test with mock ...

await page.unroute('**/api/items', handler);
// subsequent requests to /api/items will go to real server
```

## HAR Recording and Replay

HAR (HTTP Archive) captures real network traffic to a file. Replay it in CI for fast, stable tests without hitting external services.

### Record a HAR

```ts
// First run: update: true captures real traffic and saves to file
await page.routeFromHAR('./fixtures/api.har', {
  update: true,
  url: '**/api/**',     // only capture this URL pattern
});

await page.goto('/app');
// All /api/** requests are made to real server and recorded

// After test run, api.har is created/updated
```

Then commit `fixtures/api.har` to version control.

### Replay a HAR (CI mode)

```ts
// Subsequent runs: omit update flag to replay from file
await page.routeFromHAR('./fixtures/api.har', {
  url: '**/api/**',
  notFound: 'abort',    // abort unrecorded requests (stricter)
  // notFound: 'fallthrough'  // pass through to real server (looser)
});

await page.goto('/app');
// All /api/** requests are served from har file — no network needed
```

### Update HAR selectively

Re-record specific URL patterns when the API changes:

```bash
# Only update HAR for a specific test
HAR_UPDATE=true npx playwright test api.spec.ts
```

```ts
// playwright.config.ts or test
const harUpdate = !!process.env.HAR_UPDATE;
await page.routeFromHAR('./fixtures/api.har', {
  update: harUpdate,
  url: '**/api/**',
});
```

## Request Interception for Assertions

```ts
// Assert a request was made with correct payload
const [request] = await Promise.all([
  page.waitForRequest('**/api/submit'),
  page.getByRole('button', { name: 'Submit' }).click(),
]);

expect(request.method()).toBe('POST');
const body = JSON.parse(request.postData()!);
expect(body).toEqual({ name: 'Test', email: 'test@example.com' });
```

```ts
// Assert a response was received
const [response] = await Promise.all([
  page.waitForResponse('**/api/users'),
  page.goto('/users'),
]);

expect(response.status()).toBe(200);
const data = await response.json();
expect(data).toHaveLength(3);
```

## Context-Level Routing

`page.route()` applies to one page. `browserContext.route()` applies to all pages in a context — useful for common mocks shared across tests:

```ts
// In a fixture
const test = base.extend({
  page: async ({ context }, use) => {
    // Mock analytics for all pages in this test's context
    await context.route('**/analytics/**', route => route.abort());
    const page = await context.newPage();
    await use(page);
  },
});
```

## Anti-Patterns

| Anti-pattern | Fix |
|---|---|
| `page.route('**/*', ...)` — intercept everything | Use specific URL patterns; over-mocking hides real bugs |
| HAR with `update: true` in CI | Only set `update: true` in local/re-record mode; CI always replays |
| Not calling `route.fulfill()` or `route.continue()` | Route handlers must always resolve; unresolved routes time out |
| Mocking internal routes the app doesn't call | Mock only external dependencies (third-party APIs, CDNs) |
