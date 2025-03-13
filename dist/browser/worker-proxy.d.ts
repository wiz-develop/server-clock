import { ClockTickHandler, ServerClockOptions } from '../core/types';
/**
 * WebWorkerを使用した時計プロキシ
 * メインスレッドとWebWorker間の通信を管理します
 */
export declare class WorkerProxy {
    private worker;
    private tickHandlers;
    private options;
    private workerUrl;
    /**
     * @param options ServerClock オプション
     * @param workerUrl WebWorkerのURL (デフォルト: './worker.js')
     */
    constructor(options: ServerClockOptions, workerUrl?: string);
    /**
     * 時計のティックイベントハンドラーを登録する
     */
    onTick(handler: ClockTickHandler): () => void;
    /**
     * WebWorkerを開始する
     */
    start(): void;
    /**
     * WebWorkerを停止する
     */
    stop(): void;
    /**
     * Workerからのメッセージをハンドリングするためのメソッド
     */
    private handleWorkerMessage;
    /**
     * Workerからのエラーをハンドリングするためのメソッド
     */
    private handleWorkerError;
    /**
     * WebWorkerが利用可能かどうかをチェック
     */
    static isWorkerAvailable(): boolean;
}
