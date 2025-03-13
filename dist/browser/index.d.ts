import { ClockTickHandler, ServerClockOptions } from '../core/types';
/**
 * サーバー同期時計のブラウザ実装
 * 環境に応じてWebWorkerかメインスレッドで実行
 */
export declare class ServerClock {
    private implementation;
    private options;
    private useWorker;
    private lastTickData;
    private tickHandlers;
    /**
     * @param options サーバー時計のオプション
     * @param forceSingleThread WebWorkerが利用可能でも強制的にシングルスレッドで実行する場合はtrue
     * @param workerUrl WebWorkerのURL (デフォルト: './worker.js')
     */
    constructor(options: ServerClockOptions, forceSingleThread?: boolean, workerUrl?: string);
    /**
     * 時計の進行によるイベント通知を処理
     */
    private handleTick;
    /**
     * 時計のティックイベントハンドラーを登録する
     * @returns 登録解除用の関数
     */
    onTick(handler: ClockTickHandler): () => void;
    /**
     * 時計を開始する
     */
    start(): Promise<void>;
    /**
     * 時計を停止する
     */
    stop(): void;
    /**
     * 時計がWebWorkerモードで動作しているかどうか
     */
    isUsingWorker(): boolean;
}
export default ServerClock;
