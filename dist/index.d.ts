/**
 * @wiz-develop/server-clock
 * サーバー時間同期型クロックライブラリ
 */
export { CoreClock } from './core/clock';
export { fetchCalculateServerTimeOffset } from './core/sync';
export { CalculatedResult, ClockData, ClockTickHandler, ServerClockOptions, ServerUrls, Status, } from './core/types';
export { ServerClock };
import { ServerClock } from './browser/index';
export default ServerClock;
