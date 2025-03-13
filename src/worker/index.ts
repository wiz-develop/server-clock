/**
 * WebWorker として動作する時計実装
 * このファイルはWebWorker環境で実行されることを想定しています
 */
import { toDateStr } from '../core/clock';
import { fetchCalculateServerTimeOffset } from '../core/sync';
import { CalculatedResult, ClockData, ServerUrls } from '../core/types';

// WebWorker環境にあることを確認
if (typeof self === 'undefined') {
  throw new Error('This script must be executed in a WebWorker environment');
}

// グローバル定数
const CLOCK_INTERVAL = 10; // Refresh clock display every 10ms
const FETCH_TIMEOUT = 3000; // HTTP timeout is 3 seconds

// 状態管理
let result: CalculatedResult = { status: 'pending', offset: 0 };
let clockloopTimer: number | ReturnType<typeof setInterval> | null = null;
let fetchloopTimer: number | ReturnType<typeof setInterval> | null = null;

/**
 * 時計を取得する
 */
const getClock = (): ClockData => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60_000;

  const utcMs = now.getTime() + result.offset + CLOCK_INTERVAL / 2;

  const times = {
    status: result.status,
    offset: Math.round((result.offset / 1000) * 10) / 10,
    LOCAL: new Date(now.getTime() - tzOffset),
    JST: new Date(utcMs + 9 * 3_600_000),
    UTC: new Date(utcMs),
    LOC: new Date(utcMs - tzOffset),
  };

  return {
    ...times,
    LOCAL_STR: toDateStr(times.LOCAL),
    JST_STR: toDateStr(times.JST),
    UTC_STR: toDateStr(times.UTC),
    LOC_STR: toDateStr(times.LOC),
  };
};

/**
 * 時計を開始する
 * @param serverList 時刻配信サーバーの URL リスト
 * @param fetchInterval サーバーからの時刻取得間隔(ミリ秒) ※デフォルトは3分
 */
const startClock = async (
  serverList: ServerUrls,
  fetchInterval: number = 1000 * 60 * 3,
): Promise<void> => {
  if (clockloopTimer) {
    clearInterval(clockloopTimer);
  }
  if (fetchloopTimer) {
    clearInterval(fetchloopTimer);
  }

  // サーバーとの時間オフセットを計算
  result = await fetchCalculateServerTimeOffset(serverList, FETCH_TIMEOUT);

  // 定期的にサーバー時間を取得
  fetchloopTimer = setInterval(async () => {
    result = await fetchCalculateServerTimeOffset(serverList, FETCH_TIMEOUT, result);
  }, fetchInterval);

  // 時計を更新して送信
  clockloopTimer = setInterval(() => {
    const clock = getClock();
    self.postMessage(clock); // メインスレッドに送信
  }, CLOCK_INTERVAL);
};

/**
 * 時計を停止する
 */
const stopClock = (): void => {
  if (clockloopTimer) {
    clearInterval(clockloopTimer);
    clockloopTimer = null;
  }
  if (fetchloopTimer) {
    clearInterval(fetchloopTimer);
    fetchloopTimer = null;
  }
};

// メッセージハンドラ
self.addEventListener('message', (event) => {
  console.info('[ServerClock Worker] Message received:', event.data);

  switch (event.data.type) {
    case 'start':
      if (event.data.serverList == null) {
        console.error('[ServerClock Worker] serverList is required');
        break;
      }
      startClock(event.data.serverList, event.data.fetchInterval);
      break;
    case 'stop':
      stopClock();
      break;
    default:
      console.error('[ServerClock Worker] Unknown message type:', event.data);
      break;
  }
});

// エラーハンドラ
self.addEventListener('error', (event) => {
  console.error('[ServerClock Worker] Error:', event);
});
