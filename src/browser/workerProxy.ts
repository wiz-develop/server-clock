import { type ClockData, type ClockTickHandler, type ServerClockOptions } from '../core/types';

/**
 * WebWorkerを使用した時計プロキシ
 * メインスレッドとWebWorker間の通信を管理します
 */
export class WorkerProxy {
  private worker: Worker | null = null;
  private tickHandlers = new Set<ClockTickHandler>();
  private options: ServerClockOptions;
  private workerUrl: string;

  /**
   * @param options ServerClock オプション
   * @param workerUrl WebWorkerのURL (デフォルト: './worker.js')
   */
  constructor(options: ServerClockOptions, workerUrl = './worker.js') {
    this.options = options;
    this.workerUrl = workerUrl;
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
   * WebWorkerを開始する
   */
  public start(): void {
    if (this.worker) {
      this.stop();
    }

    try {
      // WebWorkerを作成
      this.worker = new Worker(this.workerUrl);

      // メッセージハンドラを設定
      this.worker.addEventListener('message', this.handleWorkerMessage);
      this.worker.addEventListener('error', WorkerProxy.handleWorkerError);

      // Workerに開始メッセージを送信
      this.worker.postMessage({
        type: 'start',
        serverUrls: this.options.serverUrls,
        fetchInterval: this.options.fetchInterval,
      });
    } catch (error) {
      console.error('[ServerClock] Failed to start worker:', error);
      throw error;
    }
  }

  /**
   * WebWorkerを停止する
   */
  public stop(): void {
    if (this.worker) {
      // Workerに停止メッセージを送信
      this.worker.postMessage({
        type: 'stop',
      });

      // イベントリスナーを削除
      this.worker.removeEventListener('message', this.handleWorkerMessage);
      this.worker.removeEventListener('error', WorkerProxy.handleWorkerError);

      // Workerを終了
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Workerからのメッセージをハンドリングするためのメソッド
   */
  private handleWorkerMessage = (event: MessageEvent<ClockData>): void => {
    // 全てのハンドラを呼び出す
    this.tickHandlers.forEach((handler) => {
      try {
        handler(event.data);
      } catch (error) {
        console.error('[ServerClock] Error in tick handler:', error);
      }
    });
  };

  /**
   * Workerからのエラーをハンドリングするためのメソッド
   */
  private static handleWorkerError = (event: ErrorEvent): void => {
    console.error('[ServerClock] Worker error:', event);
  };

  /**
   * WebWorkerが利用可能かどうかをチェック
   */
  public static isWorkerAvailable(): boolean {
    return typeof Worker !== 'undefined';
  }
}
