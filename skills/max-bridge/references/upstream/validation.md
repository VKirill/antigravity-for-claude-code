# Валидация данных — upstream mirror (verbatim)

Source: https://dev.max.ru/docs/webapps/validation
Fetched: 2026-05-16

> This file is a verbatim mirror of the upstream documentation page. Do not interpret or paraphrase here — consolidated guidance is in `../launch-data-validation.md`.

---

## Валидация данных

MAX передаёт стартовые параметры мини-приложению с каждым запуском. Чтобы убедиться, что данные принадлежат реальным пользователям и не были изменены, валидируйте их.

## Абстрактная логика проверки

Ниже описан общий алгоритм проверки объекта `WebAppData`. Реализуйте его на любом языке программирования.

**Вводные данные:**
- `BOT_TOKEN` — токен бота
- `USER_URL` — URL, по которому открыто мини-приложение

**Алгоритм:**

1. Извлеките фрагмент из `USER_URL` — данные после символа `#`. В нём в формате `key=value` содержатся параметры платформы, среди которых — `WebAppData`. Убедитесь, что каждый параметр встречается ровно один раз.
2. Преобразуйте значение `WebAppData` из `key=value` в `[['key', 'value']]`.
3. Убедитесь, что ключ `hash` присутствует в параметрах ровно один раз. Сохраните оригинальный хеш и исключите его из массива.
4. Примените URL-декодирование для всех значений (`value`), если ваша платформа не сделала этого автоматически.
5. Отсортируйте массив по ключам в алфавитном порядке `a` → `z`.
6. Сформируйте строку: `key1=value1\nkey2=value2`. Назовём её `launch_params`.
7. Вычислите `secret_key` — ключ для проверки подписи. Для этого подпишите токен бота с помощью HMAC-SHA256, используя строку `WebAppData` в качестве ключа: `HMAC-SHA256('WebAppData', BOT_TOKEN)`.
8. Вычислите собственную подпись: подпишите полученную на шаге 7 строку с помощью HMAC-SHA256, используя `secret_key`. В итоге это будет выглядеть так: `HMAC-SHA256(secret_key, launch_params)`.
9. Преобразуйте подпись из шага 8 в hex-строку.
10. Если hex-строка подписи равна значению параметра `hash` из оригинальной строки — данные подлинные.

## Валидация данных на стороне мини-приложения

### Этап 1. Извлечение данных

При запуске мини-приложения клиентская часть получает закодированную строку для валидации данных через `WebAppData`.

Извлеките параметры платформы из URL-фрагмента — данные после символа `#`. В параметре `WebAppData` содержатся данные для валидации. Эти данные также доступны через `window.WebApp.initData`.

Пример URL с параметрами:

```
https://example.com#WebAppData=chat%3D%257B%2522id%2522%253A12345%252C%2522type%2522%253A%2522DIALOG%2522%257D%26ip%3D192.168.0.1%26user%3D%257B%2522id%2522%253A67890%252C%2522first_name%2522%253A%2522Max%2522%252C%2522last_name%2522%253A%2522User%2522%252C%2522username%2522%253Anull%252C%2522language_code%2522%253A%2522ru%2522%252C%2522photo_url%2522%253Anull%257D%26query_id%3D4c0ab423-342b-4e45-aea4-2747dbc500cd%26auth_date%3D1771409719%26hash%3D<calculated_hash>&WebAppPlatform=web&WebAppVersion=26.2.8
```

### Этап 2. Подготовка данных

- Разбейте значение `WebAppData` по символу `&` на пары `key=value`.
- Сохраните значение параметра `hash` и исключите его из дальнейшей обработки.
- Примените URL-декодирование ко всем значениям.
- Отсортируйте параметры по ключам в алфавитном порядке `a` → `z`.
- Сформируйте строку `launch_params`, объединив пары `key=value` с разделителем `\n` (0x0A).

Пример подготовленных данных:

```
auth_date=1771409719
chat={"id":12345,"type":"DIALOG"}
ip=192.168.0.1
query_id=4c0ab423-342b-4e45-aea4-2747dbc500cd
user={"id":67890,"first_name":"Max","last_name":"User","username":null,"language_code":"ru","photo_url":null}

// hash
'<calculated_hash>'
```

> `auth_date` передаётся в формате Unix timestamp в секундах.

### Этап 3. Создание ключа шифрования

Создайте ключ шифрования `secret_key` с помощью алгоритма HMAC-SHA256. Используйте строку `WebAppData` в качестве ключа и токен бота, который вы получили при создании чат-бота на платформе MAX для партнёров:

```
HMAC_SHA256("WebAppData", Bot Token)
```

```javascript
HMAC_SHA256(
    "WebAppData",
    "YOUR_BOT_TOKEN" // Bot Token
)
```

### Этап 4. Вычисление подписи

Вычислите подпись `hash` стартовых параметров `initData`. Подпишите строку `launch_params` с помощью HMAC-SHA256, используя `secret_key` в качестве криптографического ключа. Преобразуйте результат в hex-строку:

```
hex(HMAC_SHA256(secret_key, launch_params))
```

### Этап 5. Сравнение результата

Сравните полученную hex-строку с оригинальным значением `hash` из `WebAppData`. Если подписи совпадают — данные подлинные. Если нет — данные были изменены.

## Примеры кода

(Upstream tabs: TypeScript, Python, Go, Java. Only TypeScript content was extractable from the rendered page; other tabs require a JS-rendered scrape. Re-fetch the page in a browser when verifying.)

### TypeScript (verbatim)

```typescript
// Вводные параметры
const BOT_TOKEN = 'YOUR_BOT_TOKEN';
const USER_LINK = 'https://example.com#WebAppData=...&WebAppPlatform=web&WebAppVersion=26.2.8';

// Извлекаем параметры платформы из фрагмента URL
const hashParams = new URLSearchParams(new URL(USER_LINK).hash.slice(1));
const appData: string = hashParams.get('WebAppData') || '';
const platform: string = hashParams.get('WebAppPlatform') || '';
const appVersion: string = hashParams.get('WebAppVersion') || '';

const validateAppData = async (appData: string, botToken: string): Promise<boolean> => {
  // Преобразуем appData из key1=value1&key2=value2 в [["key", "value"], ["key2", "value2"]]
  const params: string[][] = appData.split('&').map((x) => x.split('='));

  // Если hash встречается больше одного раза — прерываем проверку
  if (params.filter((x) => x[0] === 'hash').length !== 1) {
    return false;
  }

  // Сохраняем хеш, который пришёл вместе с параметрами
  const originalHash = params.find((x) => x[0] === 'hash');

  // Если хеш отсутствует — валидация невозможна
  if (!originalHash || typeof originalHash[1] !== 'string') {
    return false;
  }

  // Производим URL-декодирование значений параметров
  for (const param of params) {
    param[1] = decodeURIComponent(param[1]);
  }

  // Сортируем параметры по названию ключа a -> z
  params.sort((a, b) => a[0].localeCompare(b[0]));

  // Формируем строку для подписи с разделителем \n, исключаем hash
  const launchParams = params
    .filter((x) => x[0] !== 'hash')
    .map((x) => `${x[0]}=${x[1]}`)
    .join('\n');

  // Преобразуем строку для подписи и токен бота в массивы байтов
  const encoder = new TextEncoder();
  const botTokenBytes = encoder.encode(botToken);
  const launchParamsBytes = encoder.encode(launchParams);

  // Создаём secret_key: подписываем токен бота с помощью HMAC-SHA256,
  // используя строку "WebAppData" в качестве ключа
  const launchParamsKeyBytes = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    ),
    botTokenBytes,
  );

  // Создаём подпись параметров с помощью HMAC-SHA256, используя secret_key
  const signature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      launchParamsKeyBytes,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    ),
    launchParamsBytes,
  );

  // Переводим подпись из массива байтов в hex-формат
  const hash = Array.from(new Uint8Array(signature))
    .map((b) => ('00' + b.toString(16)).slice(-2))
    .join('');

  // Сравниваем с полученным хешем
  return hash === originalHash[1];
};

console.log(await validateAppData(appData, BOT_TOKEN));
```

---

(end of upstream mirror — validation.md)
