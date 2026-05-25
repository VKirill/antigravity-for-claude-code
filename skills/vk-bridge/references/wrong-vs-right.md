# Wrong vs Right — VK Bridge anti-patterns

Five high-stakes pairs. Each shows a real failure mode, the secure pattern, and why it matters.

---

## 1. Trusting `vk_user_id` without server-side sign validation

### Wrong

```ts
// Client
const params = parseURLSearchParamsForGetLaunchParams(window.location.search);
fetch('/api/profile', {
  method: 'POST',
  body: JSON.stringify({ user_id: params.vk_user_id }),
});

// Server
app.post('/api/profile', async (req) => {
  const { user_id } = req.body;
  // ❌ Trusts client-supplied value
  return db.profile.find(user_id);
});
```

### Right

```ts
// Client — send the raw search string
fetch('/api/profile', {
  method: 'POST',
  headers: { authorization: `Bearer ${window.location.search}` },
});

// Server
app.addHook('preHandler', async (req, reply) => {
  const search = req.headers.authorization?.replace(/^Bearer /, '');
  if (!search) return reply.code(401).send();
  try {
    req.vk = verifyLaunchParams(search);  // HMAC-SHA256 + replay check
  } catch {
    return reply.code(401).send();
  }
});

app.post('/api/profile', async (req) => {
  return db.profile.find(req.vk.vk_user_id);  // ✅ verified
});
```

**Why it matters**: the launch URL is plain text the user sees. A hostile user can edit `vk_user_id`, hit your endpoint, and impersonate anyone. The `sign` is the only cryptographic binding to VK's authentic identity. Without server-side verification, you have **no authentication**.

---

## 2. Not idempotency-keying VK Pay payments

### Wrong

```ts
const result = await bridge.send('VKWebAppOpenPayForm', { /* ... */ });
if (result.status === 'success') {
  await fetch('/api/grant-premium', {
    method: 'POST',
    body: JSON.stringify({ user_id: vk_user_id }),
  });
}

// Server
app.post('/api/grant-premium', async (req) => {
  // ❌ No idempotency — every call grants again
  await db.users.update(req.body.user_id, { premium: true });
});
```

### Right

```ts
// Client — send transaction_id
if (result.status === 'success') {
  await fetch('/api/vkpay/confirm', {
    method: 'POST',
    body: JSON.stringify({
      order_id: stableOrderId,
      transaction_id: result.transaction_id,
      amount: result.amount,
    }),
  });
}

// Server
app.post('/api/vkpay/confirm', async (req) => {
  const { order_id, transaction_id, amount } = req.body;

  // 1. Independently verify via VK Pay API
  const vkPayState = await vkPay.getTransaction(transaction_id);
  if (vkPayState.status !== 'success' || vkPayState.amount !== amount) {
    return reply.code(409);
  }

  // 2. Atomic: insert payment + grant access, UNIQUE constraint protects
  try {
    await db.$transaction(async (tx) => {
      await tx.payments.insert({
        transaction_id,  // PRIMARY KEY
        order_id,
        user_id: req.vk.vk_user_id,
        amount,
      });
      await tx.users.update(req.vk.vk_user_id, { premium: true });
    });
  } catch (e) {
    if (e.code === 'UNIQUE_VIOLATION') {
      // Already granted — return current state
      return reply.send({ status: 'already_granted' });
    }
    throw e;
  }
});
```

**Why it matters**: clients retry. Networks fail. Without idempotency at the `transaction_id` layer, retries grant premium multiple times — direct money loss. Also: trusting client-reported `status: 'success'` is forgeable; verify server-side.

---

## 3. Calling a bridge method without `supports` feature-detection

### Wrong

```ts
// Always tries to open the story editor
async function shareToStory() {
  await bridge.send('VKWebAppShowStoryBox', { /* ... */ });
}
```

### Right

```ts
async function shareToStory() {
  if (!bridge.supports('VKWebAppShowStoryBox')) {
    // Fallback: open a share sheet, or hide the button entirely
    return bridge.send('VKWebAppShare', { link: STORY_FALLBACK_URL });
  }
  try {
    await bridge.send('VKWebAppShowStoryBox', { /* ... */ });
  } catch (err: any) {
    if (err?.error_data?.error_reason !== 'User denied') {
      console.warn('story share failed', err);
    }
  }
}
```

**Why it matters**: desktop clients, older mobile builds, and some web variants lack specific methods. Calling unsupported methods either hangs forever (worst case) or rejects with a confusing error. Feature-detect + fallback is one extra line and removes the failure entirely.

---

## 4. Storing tokens or sensitive data in `VKWebAppStorageSet`

### Wrong

```ts
const { access_token } = await bridge.send('VKWebAppGetAuthToken', {
  app_id: VK_APP_ID,
  scope: 'wall,friends',
});

await bridge.send('VKWebAppStorageSet', {
  key: 'access_token',                 // ❌
  value: access_token,
});
```

### Right

```ts
const { access_token } = await bridge.send('VKWebAppGetAuthToken', {
  app_id: VK_APP_ID,
  scope: 'wall,friends',
});

// Send to server for storage; never persist in bridge storage
await fetch('/api/vk-token', {
  method: 'POST',
  body: JSON.stringify({ access_token }),
});
// Server stores it bound to verified vk_user_id, encrypted at rest
```

**Why it matters**: bridge storage is per-user but **user-readable** in principle (host devtools, jailbroken devices, or just a leaked log). Treat it as the equivalent of `localStorage` — fine for UI state, never for credentials. Tokens belong on the server, scoped to the verified user identity.

---

## 5. Trusting `vk_viewer_group_role` for admin gating without server check

### Wrong

```ts
// Client
if (params.vk_viewer_group_role === 'admin') {
  showAdminPanel();  // UI-only is fine
}

// Server
app.post('/api/community/config', async (req) => {
  const { role, group_id } = req.body;  // ❌ trusts client
  if (role !== 'admin') return reply.code(403);
  await db.communityConfig.update(group_id, req.body.config);
});
```

### Right

```ts
// Client — UI gating only
if (params.vk_viewer_group_role === 'admin') {
  showAdminPanel();
}

// Server — sign-verified middleware populates req.vk
app.post('/api/community/:groupId/config', async (req, reply) => {
  const groupId = Number(req.params.groupId);

  // 1. Sign-verified vk_group_id matches URL param
  if (req.vk.vk_group_id !== groupId) return reply.code(403);

  // 2. Sign-verified role is admin
  if (req.vk.vk_viewer_group_role !== 'admin') return reply.code(403);

  // 3. Defense in depth — re-confirm via VK API
  const managers = await vkApi('groups.getMembers', COMMUNITY_TOKEN, {
    group_id: String(groupId),
    filter: 'managers',
  });
  const isAdminNow = managers.items.some(
    (m: any) => m.id === req.vk.vk_user_id && m.role === 'administrator',
  );
  if (!isAdminNow) return reply.code(403);

  // ✅ safe to mutate
  await db.communityConfig.update(groupId, req.body.config);
});
```

**Why it matters**: the role can change (admin demoted, kicked, community deleted) between when the URL was signed and when the request hits your server. Sign verification proves "at sign-time the user was admin" — re-confirming via VK API proves "the user is admin right now". For destructive actions (config changes, payouts, member exports), defense in depth is justified.
