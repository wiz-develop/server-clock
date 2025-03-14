/**
 * WebWorker として動作する時計実装
 * このファイルはWebWorker環境で実行されることを想定しています
 */
import { CLOCK_INTERVAL, FETCH_TIMEOUT } from '../core/clock';
import { fetchCalculateServerTimeOffset, getClockData } from '../core/sync';
import { type CalculatedResult, type ServerUrls } from '../core/types';

/**
 * このファイルは、Web Worker として動作するファイルです。
 * Background から server-time api にアクセスするための処理を記述します。
 */
declare let self: DedicatedWorkerGlobalScope | undefined;

// WebWorker環境にあることを確認
if (self === undefined) {
  throw new TypeError('This script must be executed in a WebWorker environment');
}

// 状態管理
let result: CalculatedResult = { status: 'pending', offset: 0 };
let clockloopTimer: number | null = null;
let fetchloopTimer: number | null = null;

/**
 * 時計を開始する
 * @param serverUrls 時刻配信サーバーの URL リスト
 * @param fetchInterval サーバーからの時刻取得間隔(ミリ秒) ※デフォルトは3分
 */
const startClock = async (
  serverUrls: ServerUrls,
  fetchInterval: number = 1000 * 60 * 3,
): Promise<void> => {
  if (clockloopTimer) {
    clearInterval(clockloopTimer);
  }
  if (fetchloopTimer) {
    clearInterval(fetchloopTimer);
  }

  // サーバーとの時間オフセットを計算
  result = await fetchCalculateServerTimeOffset(serverUrls, FETCH_TIMEOUT);

  // 定期的にサーバー時間を取得
  fetchloopTimer = setInterval(async () => {
    result = await fetchCalculateServerTimeOffset(serverUrls, FETCH_TIMEOUT, result);
  }, fetchInterval);

  // 時計を更新して送信
  clockloopTimer = setInterval(() => {
    const clock = getClockData(result, CLOCK_INTERVAL);
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
self.addEventListener('message', async (event) => {
  console.info('[ServerClock Worker] Message received:', event.data);

  switch (event.data.type) {
    case 'start':
      if (event.data.serverUrls == null) {
        console.error('[ServerClock Worker] serverUrls is required');
        break;
      }
      await startClock(event.data.serverUrls, event.data.fetchInterval);
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
