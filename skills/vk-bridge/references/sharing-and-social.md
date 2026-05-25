# Sharing and social

Native share/post flows happen entirely in the host client UI. Your job is to call the right method with the right payload and react to the success/failure.

## `VKWebAppShare` — share a link

Opens the native share sheet with a URL.

```ts
const result = await bridge.send('VKWebAppShare', {
  link: 'https://vk.com/app12345678',
});
// result: { type: 'message' | 'qr' | 'post' | 'story' | 'user' | ..., ... }
```

The user can pick any destination (DM, post, story, copy link, external app). Result `type` tells you where they sent it; the rest of the payload depends on `type`.

## `VKWebAppShowWallPostBox` — wall post composer

Opens the post composer with prefilled content; user can edit and choose audience.

```ts
const { post_id } = await bridge.send('VKWebAppShowWallPostBox', {
  message: 'Check out my score in the game! 🎮',
  attachments: 'photo123456_789,https://my-app.example/share',
  owner_id: -123456,        // optional: post to a community (negative ID)
  friends_only: 0,          // 0 or 1
  // services?: string;     // 'twitter', etc. (legacy)
});
```

`attachments` is a comma-separated list:
- `photo<owner_id>_<photo_id>` for VK photos
- `video<owner_id>_<video_id>` for VK videos
- A direct URL string for external links

`post_id` is returned on success. The user may cancel (rejects with error) — that's expected UX, not a failure.

## `VKWebAppShowStoryBox` — VK Stories editor

Opens the Stories camera/editor with a pre-filled background (image, video, or solid color) and optional stickers/buttons.

```ts
await bridge.send('VKWebAppShowStoryBox', {
  background_type: 'image',      // 'image' | 'video' | 'none'
  url: 'https://my-app.example/story-bg.jpg',
  attachment: {
    text: 'open',                // text on the button sticker
    type: 'url',
    url: 'https://vk.com/app12345678#promo',
  },
  // stickers can be more complex — sticker, mention, hashtag, place, time, link
});
```

For solid-color background, omit `url` and pass a `background_type: 'none'` with custom stickers.

## `VKWebAppShowInviteBox` — friend invitations

```ts
const result = await bridge.send('VKWebAppShowInviteBox');
// result: { success: 1 } when user sent at least one invite
```

The user picks friends from a host-rendered list. No control over which friends are shown.

## `VKWebAppCopyText` — copy to clipboard

```ts
await bridge.send('VKWebAppCopyText', {
  text: 'https://vk.com/app12345678?ref=share',
});
```

Always pair with a visible "copied" toast — the host doesn't show one.

## `VKWebAppShowCommunityWidgetPreviewBox`

For community-app integrations: propose adding a widget to a community's page. The community admin must approve.

```ts
await bridge.send('VKWebAppShowCommunityWidgetPreviewBox', {
  group_id: 123456,
  type: 'text',       // 'text' | 'list' | 'table' | 'tiles' | 'compact_list' | 'cover_list' | 'donation' | 'match'
  code: '...',        // VKScript code that renders the widget
});
```

Requires the app to have community-widget permission.

## `VKWebAppAddToCommunity` / `VKWebAppAddToFavorites`

```ts
const { group_id } = await bridge.send('VKWebAppAddToCommunity');
// User picked a community; you can now install your app there if it supports community mode

await bridge.send('VKWebAppAddToFavorites');
// Adds the current Mini App to the user's favorites (pin)
```

## Error handling pattern

Every social method rejects when the user cancels. Treat cancel as a normal outcome, not an error to surface:

```ts
async function trySharePost(payload: Parameters<typeof bridge.send<'VKWebAppShowWallPostBox'>>[1]) {
  try {
    return await bridge.send('VKWebAppShowWallPostBox', payload);
  } catch (err: any) {
    if (err?.error_data?.error_reason === 'User denied') return null;
    if (err?.error_data?.error_code === 4) return null;
    throw err;
  }
}
```

## Pitfalls

- **External URLs in `VKWebAppShowWallPostBox` attachments** may be stripped on certain platforms — test on iOS, Android, and web before relying on them.
- **`VKWebAppShare` is not a sub-call you can chain after `VKWebAppCallAPIMethod`** — they don't compose. Use one or the other per user action.
- **Stories require a recent enough host version** — gate with `bridge.supports('VKWebAppShowStoryBox')`.
- **`attachments` with mixed types** (photo + external URL) sometimes silently drops the URL on Android. Prefer VK-native attachments where possible.
