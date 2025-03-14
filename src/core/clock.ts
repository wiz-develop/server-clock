import { fetchCalculateServerTimeOffset, getClockData } from './sync';
import {
  type CalculatedResult,
  type ClockTickHandler,
  type ServerClockOptions,
  type ServerUrls,
} from './types';

export const FETCH_INTERVAL = 180000; // デフォルト3分
export const CLOCK_INTERVAL = 100; // デフォルト100ms
export const FETCH_TIMEOUT = 3000; // デフォルト3秒

/**
 * サーバー時間同期時計のコア実装
 */
export class CoreClock {
  private serverUrls: ServerUrls;
  private fetchInterval: number;
  private clockInterval: number;
  private fetchTimeout: number;
  private fallbackToLocal: boolean;

  private result: CalculatedResult = { status: 'pending', offset: 0 };
  private clockloopTimer: ReturnType<typeof setInterval> | null = null;
  private fetchloopTimer: ReturnType<typeof setInterval> | null = null;
  private tickHandlers = new Set<ClockTickHandler>();

  constructor(options: ServerClockOptions) {
    this.serverUrls = options.serverUrls;
    this.fetchInterval = options.fetchInterval ?? FETCH_INTERVAL;
    this.clockInterval = options.clockInterval ?? CLOCK_INTERVAL;
    this.fetchTimeout = options.fetchTimeout ?? FETCH_TIMEOUT;
    this.fallbackToLocal = options.fallbackToLocal ?? true; // デフォルトtrueでローカル時間にフォールバック
  }

  /**
   * 時計のティックイベントハンドラーを登録する
   */
  public onTick(handler: ClockTickHandler): () => void {
    this.tickHandlers.add(handler);

    // 登録解除用の関数を返す
    return () => {
      this.tickHandlers.delete(handler);
    };
  }

  /**
   * 時計を開始する
   */
  public async start(): Promise<void> {
    this.stop();

    // サーバー時間オフセットを初期化
    try {
      this.result = await fetchCalculateServerTimeOffset(
        this.serverUrls,
        this.fetchTimeout,
        this.fallbackToLocal ? undefined : this.result,
      );
    } catch (error) {
      console.error('[ServerClock] Failed to initialize time offset:', error);
      if (!this.fallbackToLocal) {
        throw error;
      }
    }

    // 定期的にサーバー時間を取得
    this.fetchloopTimer = setInterval(async () => {
      try {
        this.result = await fetchCalculateServerTimeOffset(
          this.serverUrls,
          this.fetchTimeout,
          this.result,
        );
      } catch (error) {
        console.error('[ServerClock] Failed to update time offset:', error);
      }
    }, this.fetchInterval);

    // 時計を更新
    this.clockloopTimer = setInterval(() => {
      const clock = getClockData(this.result, this.clockInterval);

      // 全てのハンドラを呼び出す
      this.tickHandlers.forEach((handler) => {
        try {
          handler(clock);
        } catch (error) {
          console.error('[ServerClock] Error in tick handler:', error);
        }
      });
    }, this.clockInterval);
  }

  /**
   * 時計を停止する
   */
  public stop(): void {
    if (this.clockloopTimer) {
      clearInterval(this.clockloopTimer);
      this.clockloopTimer = null;
    }

    if (this.fetchloopTimer) {
      clearInterval(this.fetchloopTimer);
      this.fetchloopTimer = null;
    }
  }
}
