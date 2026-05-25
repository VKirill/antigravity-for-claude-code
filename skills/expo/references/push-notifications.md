# Push Notifications

`expo-notifications` covers local and remote notifications. Remote sends go through the Expo push service (proxy to FCM and APNs) or directly to FCM/APNs from your backend.

## Install and configure

```bash
npx expo install expo-notifications expo-device
```

```ts
// app.config.ts
plugins: [
  [
    'expo-notifications',
    {
      icon: './assets/notification-icon.png',
      color: '#ffffff',
      defaultChannel: 'default',
      sounds: ['./assets/notification.wav'],
      enableBackgroundRemoteNotifications: false,
    },
  ],
],
```

For iOS, add an APNs key in EAS credentials (`eas credentials -p ios` → "Push Notifications"). For Android, configure FCM:

```bash
eas credentials -p android
```

Upload the FCM v1 service-account JSON or use the legacy server key.

## Permission + token registration

```ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) {
    console.warn('Push tokens require a physical device');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;
  if (!projectId) throw new Error('EAS projectId missing');

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}
```

On Android, the **channel must exist before** the permission prompt, otherwise the prompt won't appear.

## Listeners

```tsx
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

export function NotificationListeners() {
  const receivedRef = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    receivedRef.current = Notifications.addNotificationReceivedListener((n) => {
      console.log('received', n.request.content);
    });

    responseRef.current = Notifications.addNotificationResponseReceivedListener((r) => {
      // user tapped the notification — navigate
      console.log('tapped', r.notification.request.content.data);
    });

    return () => {
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, []);

  return null;
}
```

For cold-start (app launched by notification tap):

```ts
const last = await Notifications.getLastNotificationResponseAsync();
if (last) {
  // route based on last.notification.request.content.data
}
```

## Sending via Expo push service

Server-side, POST to `https://exp.host/--/api/v2/push/send`:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H 'Content-Type: application/json' \
  -d '[{
    "to": "ExponentPushToken[xxx]",
    "title": "Hello",
    "body":  "World",
    "data":  { "url": "myapp://posts/42" },
    "sound": "default",
    "priority": "high",
    "channelId": "default"
  }]'
```

Receipts are fetched asynchronously by ticket ID:

```bash
curl -X POST https://exp.host/--/api/v2/push/getReceipts \
  -H 'Content-Type: application/json' \
  -d '{ "ids": ["ticket-id-1", "ticket-id-2"] }'
```

Receipts reveal delivery errors per device (e.g., `DeviceNotRegistered` → clean from your DB).

## Direct FCM / APNs

If you want to skip the Expo push proxy:

- iOS: APNs via your server using the APNs key (`.p8`) + JWT auth
- Android: FCM v1 with the service-account JSON

Use `getDevicePushTokenAsync()` instead of `getExpoPushTokenAsync()`:

```ts
const { data, type } = await Notifications.getDevicePushTokenAsync();
// type: 'ios' | 'android'; data: the FCM registration token or APNs device token (hex on iOS, base64 helper available)
```

## Local notifications

```ts
await Notifications.scheduleNotificationAsync({
  content: { title: 'Reminder', body: 'Time to log your meal.' },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 60 * 30,
  },
});
```

Other trigger types: `DAILY`, `WEEKLY`, `CALENDAR`, `DATE`.

## Background notifications

iOS background notifications require both:

- `enableBackgroundRemoteNotifications: true` in the plugin config (sets `UIBackgroundModes: remote-notification`)
- `content-available: 1` in the push payload

Android handles backgrounded notifications natively; FCM messages with `data` and no `notification` block are delivered to a background handler — register one with `Notifications.registerTaskAsync(TASK_NAME)` and `TaskManager.defineTask`.

## Anti-patterns

- Skipping `Device.isDevice` — token requests on a simulator silently fail
- Creating the Android channel **after** requesting permissions — prompt never appears
- Storing the Expo token without listening for token rotations — register `addPushTokenListener` to update
- Sending APNs `priority: 10` for background updates — Apple silently drops them; use `priority: 5` for background
- Mixing `notification` and `data` blocks on FCM payloads — background handler is skipped when `notification` is present
- Not handling `DeviceNotRegistered` errors in receipts — accumulates dead tokens
