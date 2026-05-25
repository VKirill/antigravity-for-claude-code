# VK Bridge — Reference Index

Capability map and decision flow for the `@vkontakte/vk-bridge` SDK.

## Decision map — "what do you need?"

| You need to... | Open |
|---|---|
| Install, init, detect runtime | [setup.md](setup.md) |
| Parse `vk_*` launch params on client | [setup.md](setup.md) + [launch-params.md](launch-params.md) |
| Validate `sign` server-side | [launch-params.md](launch-params.md) |
| Get user identity (name, photo) | [auth-and-identity.md](auth-and-identity.md) |
| Get an OAuth access token for VK API | [auth-and-identity.md](auth-and-identity.md) |
| Call a VK API method through the bridge | [auth-and-identity.md](auth-and-identity.md) |
| React to theme/insets/viewport changes | [ui-events.md](ui-events.md) |
| Customize status bar / disable swipe back | [ui-events.md](ui-events.md) |
| Share a link / wall post / story | [sharing-and-social.md](sharing-and-social.md) |
| Accept payment via VK Pay | [payments.md](payments.md) |
| Persist key-value per-user data | [storage.md](storage.md) |
| Send push notifications | [notifications.md](notifications.md) |
| Detect "I'm in a community app" + admin role | [community-apps.md](community-apps.md) |
| Sane defaults for retries, TTL, prefixes | [recommended-defaults.md](recommended-defaults.md) |
| A method works locally but not on iOS/Android | [troubleshooting.md](troubleshooting.md) |
| Verify code against known antipatterns | [wrong-vs-right.md](wrong-vs-right.md) |

## API surface tree

```
@vkontakte/vk-bridge (default export: bridge)
├── bridge.send(method, params?)  -> Promise<Result>
├── bridge.subscribe(handler)     -> () => void   (unsubscribe)
├── bridge.unsubscribe(handler)
├── bridge.supports(method)       -> boolean      (sync best-effort)
├── bridge.supportsAsync(method)  -> Promise<boolean>
├── bridge.isEmbedded()           -> boolean      (running inside VK client)
├── bridge.isIframe()             -> boolean      (web iframe runtime)
├── bridge.isWebView()            -> boolean      (mobile WebView runtime)
└── functions:
    ├── parseURLSearchParamsForGetLaunchParams(search) -> Partial<LaunchParams>
    └── applyMiddleware(...mws)(bridge)            -> EnhancedBridge

Companion: @vkontakte/vk-bridge-react
├── useAppearance()  -> 'light' | 'dark' | null
└── useInsets()      -> { top, bottom, left, right } | null
```

## Method families (by capability)

| Family | Examples |
|---|---|
| Lifecycle | `VKWebAppInit` |
| Identity | `VKWebAppGetUserInfo`, `VKWebAppGetEmail`, `VKWebAppGetPhoneNumber`, `VKWebAppGetAuthToken` |
| VK API | `VKWebAppCallAPIMethod` |
| UI / chrome | `VKWebAppSetViewSettings`, `VKWebAppDisableSwipeBack`, `VKWebAppEnableSwipeBack`, `VKWebAppScroll`, `VKWebAppResizeWindow`, `VKWebAppGetConfig` |
| Sharing | `VKWebAppShare`, `VKWebAppShowWallPostBox`, `VKWebAppShowStoryBox`, `VKWebAppShowInviteBox` |
| Payments | `VKWebAppOpenPayForm` |
| Storage | `VKWebAppStorageSet`, `VKWebAppStorageGet`, `VKWebAppStorageGetKeys` |
| Notifications | `VKWebAppAllowNotifications`, `VKWebAppDenyNotifications` |
| Community | `VKWebAppAddToCommunity`, `VKWebAppShowCommunityWidgetPreviewBox`, `VKWebAppJoinGroup` |
| Hardware | `VKWebAppOpenCodeReader`, `VKWebAppCopyText`, `VKWebAppOpenContacts`, `VKWebAppGetGeodata` |
| Subscribe-only events | `VKWebAppUpdateConfig`, `VKWebAppLocationChanged`, `VKWebAppViewHide`, `VKWebAppViewRestore` |

## Runtime matrix

| Runtime | `bridge.isEmbedded()` | Transport |
|---|---|---|
| Web (vk.com iframe) | true | `postMessage` |
| iOS VK app WebView | true | `webkit.messageHandlers` |
| Android VK app WebView | true | `window.AndroidBridge` |
| Desktop VK app | true | Custom IPC |
| Local dev (no host) | false | No-op (rejects most calls) |

Different runtimes implement different method subsets — always feature-detect with `bridge.supports()` for non-core methods.
