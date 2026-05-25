# Community apps — group context, admin gating

A VK Mini App can be embedded in a community (group) page. The launch params expose extra fields letting your app know it's running in community context and what role the viewer has.

## Detection — community vs personal context

| Launch param | Personal context | Community context |
|---|---|---|
| `vk_group_id` | absent | community numeric ID |
| `vk_viewer_group_role` | absent | `'admin' \| 'editor' \| 'moder' \| 'member' \| 'none'` |
| `vk_user_id` | viewer's user ID | viewer's user ID (same) |
| `vk_app_id` | your app ID | your app ID (same) |

```ts
import { parseURLSearchParamsForGetLaunchParams } from '@vkontakte/vk-bridge';
const p = parseURLSearchParamsForGetLaunchParams(window.location.search);
const isCommunityContext = p.vk_group_id != null;
const isAdminViewer = p.vk_viewer_group_role === 'admin';
```

**Critical**: gate features on the server using the **verified** values, not the client-parsed ones. The launch URL is forgeable. See [launch-params.md](launch-params.md) for the sign verification.

## Roles

| Role | Permissions inside the community |
|---|---|
| `admin` | Full administrative access — content, settings, members, money |
| `editor` | Content + members management, no settings |
| `moder` | Moderate posts and comments |
| `member` | Joined the community, no special powers |
| `none` | Not a member; viewing publicly |

For admin-only features (configuration screens, payouts, member exports), gate strictly on `vk_viewer_group_role === 'admin'`.

## Server-side gating pattern

```ts
// Middleware after sign verification populates req.vk
app.post('/api/community/:groupId/config', async (req, reply) => {
  const groupId = Number(req.params.groupId);

  // 1. Sign-verified context must match the URL's group
  if (req.vk.vk_group_id !== groupId) {
    return reply.code(403).send({ error: 'group_mismatch' });
  }

  // 2. Sign-verified role must be admin
  if (req.vk.vk_viewer_group_role !== 'admin') {
    return reply.code(403).send({ error: 'not_admin' });
  }

  // 3. (Optional) re-confirm via VK API with a community token — defense in depth
  const members = await vkApi('groups.getMembers', COMMUNITY_TOKEN, {
    group_id: String(groupId),
    filter: 'managers',
  });
  if (!members.items.some((m: any) => m.id === req.vk.vk_user_id && m.role === 'administrator')) {
    return reply.code(403).send({ error: 'role_lost' });
  }

  // ... admin action
});
```

## Personal-app vs community-app dashboards

When you register a Mini App on vk.com, you choose:
- **Personal Mini App** — installs to the user's app menu; opens with personal context.
- **Community Mini App** — can be added to a community's page; opens with community context.

A single app **can** support both modes — branch on `vk_group_id`. The dashboard configures which surfaces (catalog, community widget, etc.) the app appears in.

## Adding the app to a community programmatically

`VKWebAppAddToCommunity` opens a flow where the user picks one of their communities to install your app into:

```ts
const { group_id } = await bridge.send('VKWebAppAddToCommunity');
// User picked community 12345; your app is now installed there
```

Useful for onboarding flows where the user is already logged in and you want them to add the app to their community without leaving the Mini App.

## Community widgets

After install, your community Mini App can render a widget on the community's wall via `VKWebAppShowCommunityWidgetPreviewBox` — see [sharing-and-social.md](sharing-and-social.md).

## Community messaging

Sending DMs from the community to users requires the community access token + `messages` scope; see [notifications.md](notifications.md).

## Pitfalls

- **`vk_viewer_group_role` is client-supplied** — a hostile client can claim `'admin'`. Always re-validate via VK API in admin endpoints, OR ensure your sign verification covers the field (which it does if you include every `vk_*` key in the canonical message).
- **A user may be admin of community X but a member of community Y** — never grant admin powers across communities. Always scope to the `vk_group_id` from launch params.
- **Apps without community mode enabled** silently miss `vk_group_id` even when launched via a community URL — confirm the app is configured for community context in the dashboard.
- **Personal account testing**: open `https://vk.com/app<APP_ID>` for personal context; `https://vk.com/app<APP_ID>_-<GROUP_ID>` for community context (note the negative group_id convention in some URLs).
