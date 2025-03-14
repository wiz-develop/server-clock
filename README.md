# @wiz-develop/server-clock

サーバー時間同期型の高精度な時計ライブラリです。ブラウザで動作し、指定されたサーバーと時刻を同期して正確な時間を提供します。

## 特徴

- サーバー時間との精密な同期
- WebWorkerによるパフォーマンス最適化（自動フォールバック機能付き）
- TypeScript完全対応
- UMD/ESM形式で多様な環境に対応
- JST/UTC/ローカル時間の取得
- レガシー環境（WordPress/jQuery）でも使用可能

## インストール

npm:

```bash
npm install @wiz-develop/server-clock
```

yarn:

```bash
yarn add @wiz-develop/server-clock
```

pnpm:

```bash
pnpm add @wiz-develop/server-clock
```

## 使用方法

### モジュールとして使用する場合

```javascript
import { ServerClock } from '@wiz-develop/server-clock';

// 時計を初期化
const clock = new ServerClock({
  serverUrls: ['https://example.com/time-api'], // 時刻配信サーバーのURLリスト
  fetchInterval: 180000, // サーバー時間取得間隔(ms)
});

// 時計を開始
clock.start();

// 時計のTickイベントを監視
clock.onTick((clockData) => {
  console.log('UTC時間:', clockData.UTC_STR);
  console.log('JST時間:', clockData.JST_STR);
  console.log('ローカル時間:', clockData.LOC_STR);
  console.log('サーバーとのオフセット:', clockData.offset, '秒');
  console.log('同期ステータス:', clockData.status);
});

// 時計を停止 (必要な場合)
// clock.stop();
```

### レガシー環境（scriptタグ）での使用方法

```html
<!-- ライブラリを読み込み - CDNもしくはローカルファイルから -->
<script src="https://unpkg.com/@wiz-develop/server-clock@1.0.x/dist/bundle.min.js"></script>

<script>
  // グローバル変数として利用可能
  const clock = new WizDevelopServerClock.ServerClock({
    serverUrls: ['https://example.com/time-api'], // 時刻配信サーバーのURLリスト
    fetchInterval: 180000, // サーバー時間取得間隔(ms)
  });

  clock.start();

  clock.onTick(function (clockData) {
    document.getElementById('server-time').textContent = clockData.JST_STR;
  });
</script>
```

### jQuery環境での使用例

```html
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="https://unpkg.com/@wiz-develop/server-clock@1.0.x/dist/bundle.min.js"></script>

<script>
  $(function () {
    const clock = new WizDevelopServerClock.ServerClock({
      serverUrls: ['https://example.com/time-api'], // 時刻配信サーバーのURLリスト
      fetchInterval: 180000, // サーバー時間取得間隔(ms)
    });

    clock.start();

    clock.onTick(function (clockData) {
      $('#server-time').text(clockData.JST_STR);
    });
  });
</script>
```

## 時刻配信サーバーの実装例

このライブラリは以下のようなレスポンスを返すサーバーと連携します：

```json
{
  "requestReceivedAt": 1647012345678,
  "responseSentAt": 1647012345679
}
```

- `requestReceivedAt`: サーバーがリクエストを受信した時刻（ミリ秒）
- `responseSentAt`: サーバーがレスポンスを送信した時刻（ミリ秒）

Node.jsサーバーの実装例：

```javascript
const express = require('express');
const app = express();

app.get('/time', (req, res) => {
  const requestReceivedAt = Date.now();

  // 処理...

  const responseSentAt = Date.now();
  res.json({
    requestReceivedAt,
    responseSentAt,
  });
});

app.listen(3000);
```

## ClockData オブジェクト

`onTick` コールバックに渡される ClockData オブジェクトの構造：

```typescript
interface ClockData {
  status: 'pending' | 'client_only' | 'server_only' | 'accurate';
  offset: number; // サーバーとの時間オフセット（秒）
  LOCAL: Date; // ローカルタイムゾーンでの時刻（ブラウザのsetTimezone()を適用したDate）
  LOCAL_STR: string; // ローカルタイムゾーンでの時刻（文字列形式）
  JST: Date; // 日本標準時（UTC+9）の時刻
  JST_STR: string; // 日本標準時の文字列表現
  UTC: Date; // 協定世界時（UTC）の時刻
  UTC_STR: string; // 協定世界時の文字列表現
  LOC: Date; // サーバー時刻に基づく現地時刻
  LOC_STR: string; // サーバー時刻に基づく現地時刻の文字列表現
}
```

## ライセンス

MIT
