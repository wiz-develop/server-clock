import { CoreClock } from '../core/clock';
import { ClockData, ClockTickHandler, ServerClockOptions } from '../core/types';
import { WorkerProxy } from './worker-proxy';

/**
 * サーバー同期時計のブラウザ実装
 * 環境に応じてWebWorkerかメインスレッドで実行
 */
export class ServerClock {
  private implementation: CoreClock | WorkerProxy;
  private options: ServerClockOptions;
  private useWorker: boolean;
  private lastTickData: ClockData | null = null;
  private tickHandlers: Set<ClockTickHandler> = new Set();

  /**
   * @param options サーバー時計のオプション
   * @param forceSingleThread WebWorkerが利用可能でも強制的にシングルスレッドで実行する場合はtrue
   * @param workerUrl WebWorkerのURL (デフォルト: './worker.js')
   */
  constructor(
    options: ServerClockOptions,
    forceSingleThread: boolean = false,
    workerUrl: string = './worker.js',
  ) {
    this.options = {
      ...options,
      fetchInterval: options.fetchInterval ?? 1000 * 60 * 3,
      clockInterval: options.clockInterval ?? 10,
      fetchTimeout: options.fetchTimeout ?? 3000,
      fallbackToLocal: options.fallbackToLocal ?? true,
    };

    // WebWorkerが利用可能で、強制シングルスレッドでない場合はWorkerを使用
    this.useWorker = !forceSingleThread && WorkerProxy.isWorkerAvailable();

    if (this.useWorker) {
      this.implementation = new WorkerProxy(this.options, workerUrl);
    } else {
      this.implementation = new CoreClock(this.options);
    }

    // 実装からの時計イベントをハンドル
    this.implementation.onTick(this.handleTick);
  }

  /**
   * 時計の進行によるイベント通知を処理
   */
  private handleTick = (data: ClockData): void => {
    this.lastTickData = data;

    // 登録されたすべてのハンドラに通知
    this.tickHandlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error('[ServerClock] Error in tick handler:', error);
      }
    });
  };

  /**
   * 時計のティックイベントハンドラーを登録する
   * @returns 登録解除用の関数
   */
  public onTick(handler: ClockTickHandler): () => void {
    this.tickHandlers.add(handler);

    // 既に時計データがある場合は即時にハンドラを呼び出す
    if (this.lastTickData) {
      try {
        handler(this.lastTickData);
      } catch (error) {
        console.error('[ServerClock] Error in tick handler:', error);
      }
    }

    // 登録解除用の関数を返す
    return () => {
      this.tickHandlers.delete(handler);
    };
  }

  /**
   * 時計を開始する
   */
  public async start(): Promise<void> {
    if (this.useWorker) {
      (this.implementation as WorkerProxy).start();
    } else {
      await (this.implementation as CoreClock).start();
    }
  }

  /**
   * 時計を停止する
   */
  public stop(): void {
    this.implementation.stop();
  }

  /**
   * 時計がWebWorkerモードで動作しているかどうか
   */
  public isUsingWorker(): boolean {
    return this.useWorker;
  }
}

// グローバルにエクスポート（UMD/スクリプトタグ用）
export default ServerClock;
