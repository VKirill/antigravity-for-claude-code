# Permissions and Native APIs

The pattern is two-step: **declare** the usage string via a config plugin (or app config block), then **request** it at runtime via the module's `requestPermissionsAsync`.

Common APIs: camera, media library, location, contacts, microphone, notifications, motion, calendar.

## App config declarations

Most SDK modules accept a config-plugin entry that sets the right plist key and Android manifest entry.

```ts
// app.config.ts
export default {
  expo: {
    ios: {
      infoPlist: {
        NSCameraUsageDescription: 'We need camera access to scan QR codes.',
        NSLocationWhenInUseUsageDescription: 'We use your location to show nearby items.',
      },
    },
    android: {
      permissions: ['CAMERA', 'ACCESS_FINE_LOCATION'],
    },
    plugins: [
      ['expo-camera', { cameraPermission: 'We need camera access to scan QR codes.' }],
      ['expo-location', { locationAlwaysAndWhenInUsePermission: 'Show nearby items.' }],
      ['expo-image-picker', { photosPermission: 'Pick a photo to share.' }],
      ['expo-contacts', { contactsPermission: 'Help you invite friends.' }],
    ],
  },
};
```

Prefer the plugin form over hand-writing `infoPlist`/`permissions` — plugins keep iOS and Android in sync and document the keys.

## Runtime request pattern

```ts
import * as Camera from 'expo-camera';

async function ensureCamera(): Promise<boolean> {
  const { status: existing } = await Camera.getCameraPermissionsAsync();
  if (existing === 'granted') return true;
  if (existing === 'denied') {
    // iOS: user blocked; only Settings can reverse. Show rationale + deep link.
    return false;
  }
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted';
}
```

Three statuses: `granted`, `denied`, `undetermined`. Re-requesting after `denied` is a no-op on iOS — open Settings via `Linking.openSettings()`.

## Location specifics

```ts
import * as Location from 'expo-location';

const fg = await Location.requestForegroundPermissionsAsync();
if (fg.status !== 'granted') return;

const pos = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced,
});

// Background location requires foreground first, plus an extra prompt
const bg = await Location.requestBackgroundPermissionsAsync();
```

Background location requires:

- iOS: `NSLocationAlwaysAndWhenInUseUsageDescription` + `UIBackgroundModes: [location]` (set by plugin)
- Android: `ACCESS_BACKGROUND_LOCATION` permission + Android 10+ rationale screen

## Camera with expo-camera

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';

export function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return null;             // loading
  if (!permission.granted) {
    return (
      <View>
        <Text>We need camera access.</Text>
        <Button onPress={requestPermission} title="Grant" />
      </View>
    );
  }

  return <CameraView style={{ flex: 1 }} facing="back" />;
}
```

## Media library

```ts
import * as MediaLibrary from 'expo-media-library';
const { status } = await MediaLibrary.requestPermissionsAsync();
// granular: writeOnly | readWrite. Defaults to readWrite.
```

## Contacts

```ts
import * as Contacts from 'expo-contacts';
const { status } = await Contacts.requestPermissionsAsync();
if (status === 'granted') {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Emails],
  });
}
```

## iOS App Tracking Transparency

For IDFA / tracking-based analytics:

```ts
plugins: [
  ['expo-tracking-transparency', { userTrackingPermission: 'Used to deliver personalised ads.' }],
],
```

```ts
import * as TrackingTransparency from 'expo-tracking-transparency';
const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
```

App Store will reject submissions that read IDFA without this prompt.

## Android runtime permissions

Android 6+ requires runtime prompts for "dangerous" permissions. Expo modules handle this transparently. If using a raw native lib, pair its `<uses-permission>` with a `PermissionsAndroid.request(...)` call.

## Permission status caching

Permissions can change between sessions (user revokes in Settings). Always check current status with `get*PermissionsAsync` before assuming access; don't cache `granted` in your own state across app restarts without a verification step.

## Anti-patterns

- Declaring a permission without a corresponding feature — App Store will reject vague descriptions
- Calling `request*` before showing a rationale UI — iOS only prompts once per install; a low grant rate kills your funnel
- Checking only `granted`/`denied` and treating `undetermined` as `denied` — request flow never starts
- Hard-coding usage strings in English only — non-en stores require localised strings via `InfoPlist.strings`
- Forgetting `UIBackgroundModes` when using background location — silently fails after app suspends
- Re-requesting after `denied` on iOS — no-op; deep link to Settings instead
