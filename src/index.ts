/**
 * @wiz-develop/server-clock
 * サーバー時間同期型クロックライブラリ
 */

// CoreモジュールをエクスポートしてESMでも使えるようにする
export { CoreClock } from './core/clock';
export { fetchCalculateServerTimeOffset } from './core/sync';
export {
  CalculatedResult,
  ClockData,
  ClockTickHandler,
  ServerClockOptions,
  ServerUrls,
  Status,
} from './core/types';
export { ServerClock };

// ブラウザ実装をエクスポート（デフォルトとして）
import { ServerClock } from './browser/index';
export default ServerClock;
