# MAX Bridge — upstream mirror (verbatim)

Source: https://dev.max.ru/docs/webapps/bridge
Fetched: 2026-05-16

> This file is a verbatim mirror of the upstream documentation page. Do not interpret or paraphrase here — consolidated guidance is in `../bridge-api.md` and `../launch-data-validation.md`.

---

## MAX Bridge

Библиотека MAX Bridge позволяет мини-приложениям корректно взаимодействовать с API MAX и API операционной системы на устройстве пользователя.

## Подключение библиотеки

Через CDN добавьте библиотеку `max-web-app.js`:

```html
<script src="https://st.max.ru/js/max-web-app.js"></script>
```

После подключения библиотеки приложение получит доступ к объекту `WebApp` через глобальный объект `window`:

```javascript
window.WebApp
```

`window.WebApp` — это глобальный объект, который связывает мини-приложение с клиентом и позволяет взаимодействовать с MAX, управлять интерфейсом приложения и получать информацию о пользователях. Объект создаётся с каждым запуском сервиса, предзагружает данные и не требует отдельной инициализации: его методы и параметры доступны напрямую.

## Работа с данными инициализации

В объекте `WebApp` предусмотрены:

- `initData`
- `initDataUnsafe`
- `platform`
- `version`

### `window.WebApp.initData`

Строка со стартовыми параметрами в URL-кодировке. Содержит данные о пользователе и другие инициализационные данные в виде закодированной в UTF-8 строки **для валидации на стороне сервера**.

Тип: `string`

### `window.WebApp.initDataUnsafe`

Объект, который содержит данные из `initData` в виде JSON-объекта.
**Обратите внимание, что объект нельзя использовать для валидации данных.**

```typescript
interface InitData {
  query_id: string;
  ip?: string;
  auth_date: number;
  hash: string;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    language_code: string;
    photo_url: string;
  };
  chat: {
    id: number;
    type: 'DIALOG' | 'CHAT' | 'CHANNEL';
  };
  start_param: string;
}
```

| Поле | Тип | Описание |
|---|---|---|
| `query_id` | `string` | Уникальный идентификатор текущей сессии |
| `ip?` | `string` | IP-адрес пользователя |
| `auth_date` | `number` | Время выдачи данных. Позволяет определить момент инвалидации данных. Рекомендуемый интервал составляет 1 час |
| `hash` | `string` | Хеш переданных параметров, который можно использовать для проверки их достоверности |
| `user` | `object` | Объект содержит данные о пользователе, который открывает мини-приложение |
| `user.id` | `number` | Идентификатор пользователя |
| `user.first_name` | `string` | Имя пользователя |
| `user.last_name` | `string` | Фамилия пользователя |
| `user.username` | `string` | Никнейм пользователя |
| `user.language_code` | `string` | Язык интерфейса клиента MAX |
| `user.photo_url` | `string` | Ссылка на фото профиля пользователя |
| `chat` | `object` | Объект содержит данные о чате, в котором открыто мини-приложение |
| `chat.id` | `number` | Идентификатор чата |
| `chat.type` | `string` | Тип чата (`DIALOG` / `CHAT` / `CHANNEL`) |
| `start_param` | `string` | Значение, переданное в мини-приложение через query-параметр. Пример: `https://max.ru/<your_awesome_bot>?startapp=someData`, где `start_param` будет содержать `someData` |

### `window.WebApp.platform`

Платформа, с которой запущено мини-приложение. Возможные значения: `ios`, `android`, `desktop`, `web`.

```typescript
type platform = 'ios' | 'android' | 'desktop' | 'web';
```

### `window.WebApp.version`

Версия приложения MAX, с которого запущено мини-приложение. Формат: `<year>.<build_number>.<patch_version>`, например `25.9.16`.

**Этот параметр не участвует в формировании хеша для валидации — в хеше учитываются только данные из `WebAppData`.**

## Работа с экраном

### `window.WebApp.requestScreenMaxBrightness()`

Устанавливает яркость экрана пользователя на максимум. Клиент поддержит максимальную яркость 30 секунд, затем восстановит исходное значение.

Возвращает: `Promise<{ maxBrightness: boolean }>`

### `window.WebApp.restoreScreenBrightness()`

Восстанавливает яркость экрана пользователя до исходного значения.

Возвращает: `Promise<{ maxBrightness: boolean }>`

### `window.WebApp.ScreenCapture.enableScreenCapture()`

Включает возможность делать скриншоты или записывать экран.

Возвращает: `Promise<{ isScreenCaptureEnabled: boolean }>`

### `window.WebApp.ScreenCapture.disableScreenCapture()`

Отключает возможность делать скриншоты или записывать экран.

Возвращает: `Promise<{ isScreenCaptureEnabled: boolean }>`

## Запрос номера телефона

### `window.WebApp.requestContact()`

Запрашивает телефон у пользователя в нативном диалоговом окне.

Возвращает: `Promise<{ phone: string }>`

## Подтверждение закрытия мини-приложения

> Эти методы отправляют запрос клиенту MAX в одностороннем порядке.

### `window.WebApp.enableClosingConfirmation()`

Включает предупреждение о риске потерять заполненные данные, если закрыть мини-приложение.

### `window.WebApp.disableClosingConfirmation()`

Выключает предупреждение.

## Открытие ссылок

### `window.WebApp.openLink(url)`

Открывает ссылку во внешнем браузере. **Перед вызовом MAX Bridge проверяет клик пользователя в мини-приложении. Если клика не было, перехода по ссылке не будет.**

Параметры: `url: string`

### `window.WebApp.openMaxLink(url)`

Открывает диплинк вида `https://max.ru/<some-url>` из мини-приложения внутри MAX. Если передать ссылку другого вида, метод откроет её во внешнем браузере.

Параметры: `url: string`

## Скачивание файла

> Условие для скачивания файла — наличие защищённого `https`-соединения. MAX Bridge проверяет клик пользователя в мини-приложении.

### `window.WebApp.downloadFile(url, file_name)`

Параметры:
- `url: string` — URL для доступа к ресурсу
- `file_name: string` — название файла

Возвращает: `Promise<{ status: 'downloading' | 'cancelled' }>`

## Шеринг контента

### `window.WebApp.shareContent(params)`

Вызывает нативный экран шеринга из мини-приложения на iOS, Android. Передаются параметры `text` и/или `link`: один из параметров всегда должен быть передан. **Не поддерживается веб-клиентом.**

Параметры: `{ text?: string; link?: string }`

Возвращает: `Promise<{ status: 'shared' | 'cancelled' }>`

### `window.WebApp.shareMaxContent(params)`

Открывает экран шеринга внутри MAX. Перед вызовом MAX Bridge проверяет клик пользователя.

Два режима:
- Шеринг текста — аналогичен `shareContent`
- Шеринг текста с контентом (файл, медиа): бот, на котором работает мини-приложение, предварительно отправляет контент пользователю через `POST /messages`. Мини-приложение получает идентификатор сообщения `mid`, после чего вызывает `shareMaxContent({ mid, chatType })`.

`chatType` — тип чата:
- `DIALOG` — диалог между двумя пользователями
- `CHAT` — групповой чат (пользователь должен быть участником)

> Если при шеринге медиа передать `text` или `link`, они будут проигнорированы.

Параметры: `{ text?: string; link?: string } | { mid: string; chatType: 'DIALOG' | 'CHAT' }`

Возвращает: `Promise<{ status: 'shared' | 'cancelled' }>`

## Сканирование QR-кодов

### `window.WebApp.openCodeReader(fileSelect = true)`

Открывает камеру для считывания QR-кода.

Параметры:
- `fileSelect: boolean` — `true` (по умолчанию): доступен выбор из галереи; `false`: только камера

Возвращает: `Promise<{ value: string }>`

## Управление кнопкой «Назад»

Объект `BackButton`.

### `window.WebApp.BackButton.show()`
Делает кнопку Назад активной и видимой.

### `window.WebApp.BackButton.hide()`
Скрывает кнопку Назад.

### `window.WebApp.BackButton.isVisible`
Тип: `boolean`. По умолчанию `false`.

### `window.WebApp.BackButton.onClick(callback)`
Устанавливает обработчик. `callback: () => void`. Сохраните ссылку на функцию, чтобы можно было отписаться.

### `window.WebApp.BackButton.offClick(callback)`
Отключает обработчик. `callback: () => void`.

## Хранилище устройства (`DeviceStorage`)

> Не поддерживается веб-клиентом.

### `setItem(key, value)`
Параметры: `key: string`, `value: string`.
Возвращает: `Promise<{ status: 'updated' | 'removed' }>`

### `getItem(key)`
Параметры: `key: string`.
Возвращает: `Promise<{ key: string; value: string }>`

### `removeItem(key)`
Параметры: `key: string`.
Возвращает: `Promise<{ status: 'updated' | 'removed' }>`

### `clear()`
Очищает все ключи, ранее сохранённые ботом в локальном хранилище устройства.

## Защищённое хранилище (`SecureStorage`)

> Не поддерживается веб-клиентом. **Каждый бот может хранить до 10 ключей на пользователя.**

Подходит для хранения токенов, секретов, состояния аутентификации.

API: `setItem`, `getItem`, `removeItem`, `clear` — сигнатуры идентичны `DeviceStorage`.

## Биометрия (`BiometricManager`)

> Не поддерживается десктоп и веб-клиентом. **Требуется однократный вызов `init()` перед использованием остальных методов.**

### `init()`

Возвращает:

```typescript
type BiometryType = 'finger' | 'face' | 'unknown';
interface BiometryInfo {
  available: boolean;
  type: BiometryType[];
  accessRequested: boolean;
  accessGranted: boolean;
  tokenSaved: boolean;
  deviceId: string | null;
}
Promise<BiometryInfo>
```

| Поле | Тип | Описание |
|---|---|---|
| `available` | `boolean` | Доступна ли биометрия на устройстве |
| `type` | `array` | Типы: `fingerprint`, `faceid`, `unknown`. Если пользователь отказал — `[unknown]`. Для Android всегда `[unknown]` |
| `accessRequested` | `boolean` | Был ли отправлен запрос на доступ |
| `accessGranted` | `boolean` | Предоставлен ли доступ |
| `tokenSaved` | `boolean` | Есть ли токен в безопасном хранилище |
| `deviceId` | `string \| null` | Идентификатор устройства для сопоставления токена |

### `isInited` / `isBiometricAvailable` / `isAccessRequested` / `isAccessGranted` / `isBiometricTokenSaved`
Геттеры типа `boolean`. Если пользователь отказал в доступе — все возвращают `false`.

### `biometricType`
`Array<'finger' | 'face' | 'unknown'>`. Если отказ — `["unknown"]`. Для Android всегда `["unknown"]`.

### `deviceId`
`string | null`. `null`, если пользователь отказал.

### `requestAccess(reason)`
Параметры: `reason?: string` (1–128 символов, остальное обрезается).
Возвращает: `Promise<BiometryInfo>`.

### `authenticate(reason)`
Параметры: `reason?: string` (1–128 символов).
Возвращает: `Promise<{ status: 'authorized'; token: string }>`.

### `updateBiometricToken(token, reason)`
Параметры: `token?: string`, `reason?: string` (1–128 символов). Без `token` — удаление.
Возвращает: `Promise<{ status: 'updated' | 'removed' }>`.

### `openSettings()`
Отображает нативное диалоговое окно с предложением перейти в настройки приватности MAX. **Вызывает закрытие мини-приложения.**
Возвращает: `Promise<{ status: 'opened' }>`.

## Тактильные отклики (`HapticFeedback`)

> Не поддерживается десктоп и веб-клиентом.

### `impactOccurred(impactStyle, disableVibrationFallback?)`
`impactStyle`: `'light' | 'medium' | 'heavy' | 'rigid' | 'soft'`.
`disableVibrationFallback?: boolean` (по умолчанию `false`).
Возвращает: `Promise<{ status: 'impactOccured' }>`.

### `notificationOccurred(notificationType, disableVibrationFallback?)`
`notificationType`: `'error' | 'success' | 'warning'`.
Возвращает: `Promise<{ status: 'notificationOccured' }>`.

### `selectionChanged(disableVibrationFallback?)`
Сообщает, что пользователь изменил выбор. **Не вызывать при подтверждении выбора — только при изменении.**
Возвращает: `Promise<{ status: 'selectionChanged' }>`.

## NFC (`NfcManager`)

> Только Android. Требуется `init()` перед использованием.

### `init()`

```typescript
interface NfcInfo {
  available: boolean;
  enabled: boolean;
  accessRevoked?: boolean;
}
```

| Поле | Тип | Описание |
|---|---|---|
| `available` | `boolean` | Наличие NFC-модуля |
| `enabled` | `boolean` | Включён ли NFC в настройках системы |
| `accessRevoked?` | `boolean` | Отозвал ли пользователь разрешение |

### `isInited`
Тип `boolean`.

### `openSystemSettings()`
Открывает страницу системных настроек NFC, **вызывает закрытие мини-приложения**. Если NFC включён — перехода не будет.
Возвращает: `Promise<{ status: 'opened' }>`.

### `emulateNfcTag(nfctag?)`
Передаёт данные через NFC-модуль. Без аргумента — вещание останавливается.
Параметры: `nfctag?: string`.
Возвращает: `Promise<{ status: 'scanned' | 'stopped' }>`.

## Ошибки и обработка исключений

Большинство методов возвращают `Promise`; при ошибке вызывается `reject`. Объект ошибки:

```typescript
{ error: { code: string } }
```

Пример:

```javascript
window.WebApp.SecureStorage.setItem('key', 'value')
  .then((result) => {
    console.log('Успешно сохранено');
  })
  .catch(({ error }) => {
    console.error('Произошла ошибка:', error.code);
  });
```

---

(end of upstream mirror — bridge.md)
