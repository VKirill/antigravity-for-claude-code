# Wrong vs Right code pairs

A documentation pattern for high-stakes skills. Instead of describing "the right way", show a **side-by-side contrast** between a common wrong pattern (that a junior or an LLM is likely to write) and the right one.

Both reviewers (ChatGPT and Opus) flagged the absence of explicit "wrong vs right" pairs as a quality gap. This file defines when and how to use them.

## When to include wrong-vs-right pairs

**MUST include** in references/*.md when:
- The skill targets `risk: high-stakes` (payments, auth, data integrity, queues, migrations).
- The library has a "naïve usage" that compiles/runs but is unsafe in production.
- Documentation describes a footgun explicit by name (e.g., webhook HMAC bypass, idempotency keys, retry storms).
- An anti-pattern has appeared in real LLM-generated code (e.g., `RateLimiterPg` hallucination in bullmq before fix).

**SHOULD include** when:
- The library API has a deprecated form and a current form that look similar (e.g., `QueueScheduler` vs Worker absorption in BullMQ 5).
- Two patterns yield different operational outcomes (e.g., `force` vs `force-with-lease` in git).

**SKIP** when:
- The library has only one obvious way (e.g., `z.string().email()` — there is no wrong-vs-right pair worth showing).
- The pattern is universal best practice without a tempting wrong shortcut.

## Anatomy of a wrong-vs-right block

```md
### Idempotent webhook handler

**❌ Wrong — body-parser eats the raw stream, HMAC fails silently:**
\`\`\`ts
app.post('/webhook', async (req, res) => {
  const sig = req.headers['content-hmac'];
  // req.body is already parsed JSON; original bytes are gone
  if (!verify(sig, JSON.stringify(req.body))) return res.status(403).end();
  // ...
});
\`\`\`

**✅ Right — capture raw body before parsing:**
\`\`\`ts
app.post('/webhook', { config: { rawBody: true } }, async (req, res) => {
  const sig = req.headers['content-hmac'];
  if (!verify(sig, req.rawBody)) return res.status(403).end();
  // ...
});
\`\`\`

**Why it matters:** signature is computed over the bytes the client sent. JSON.stringify of the parsed body re-orders keys, drops whitespace, and changes number formats — the recomputed digest will not match. The handler appears to work in dev (signatures match by accident on simple payloads) and fails in prod under load.
```

Three blocks: ❌ wrong, ✅ right, **Why it matters**. The third block is non-negotiable — if the reader can't see why the wrong version is wrong, the pair is decorative.

## Where to place the blocks

- **Concept files** (`webhooks.md`, `payments-flow.md`, `production-patterns.md`) — interleave wrong-vs-right at the point of explanation, not in a separate "anti-patterns" appendix. The contrast is most useful at first encounter.
- **Migration files** (`migration.md`) — every breaking change deserves an `old API ❌ / new API ✅` pair.
- **Troubleshooting files** (`troubleshooting.md`) — symptom → wrong fix attempt → right fix.

## Pitfalls of wrong-vs-right blocks

- ❌ Showing **two right ways** as if one is wrong — confuses readers.
- ❌ Showing **strawman code** no one would actually write — wastes space.
- ❌ Skipping the "Why it matters" — leaves the lesson un-grounded.
- ❌ Long blocks (> 30 lines each side) — split into separate sections instead.

Keep each side under 15 lines. If you need more, the example is doing too much.

## Audit grep

To find skills missing wrong-vs-right pairs in high-stakes references:

```bash
# High-stakes skills without any ❌/✅ pair in references
for skill in cloudpayments yookassa bullmq prisma postgresql redis linux-sysadmin; do
  if ! grep -rq "❌.*✅\|✅.*❌" "/home/ubuntu/.claude/skills/$skill/references/" 2>/dev/null; then
    echo "MISSING: $skill has no wrong-vs-right pairs"
  fi
done
```

Run this as part of pre-merge audit for any high-stakes skill change.
