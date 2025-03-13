import { ClockData, ClockTickHandler, ServerClockOptions } from './types';
/**
 * 時刻を文字列に変換する
 */
export declare const toDateStr: (t: Date) => string;
/**
 * サーバー時間同期時計のコア実装
 */
export declare class CoreClock {
    private serverUrls;
    private fetchInterval;
    private clockInterval;
    private fetchTimeout;
    private fallbackToLocal;
    private result;
    private clockloopTimer;
    private fetchloopTimer;
    private tickHandlers;
    constructor(options: ServerClockOptions);
    /**
     * 時計を取得する
     */
    getClock(): ClockData;
    /**
     * 時計のティックイベントハンドラーを登録する
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
     * 現在の時間オフセット値を取得
     */
    getTimeOffset(): number;
    /**
     * 現在の同期ステータスを取得
     */
    getStatus(): string;
}
