/**
 * @wiz-develop/server-clock
 * サーバー時間同期型クロックライブラリ
 */

// CoreモジュールをエクスポートしてESMでも使えるようにする
// ブラウザ実装をエクスポート（デフォルトとして）

export { ServerClock } from './browser/index';
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
export default './browser/index';
