/**
 * 時刻配信サーバーからのレスポンス
 */
export interface ServerResponse {
    /** Server request received at (ms) */
    requestReceivedAt: number;
    /** Server response sent at (ms) */
    responseSentAt: number;
}
/**
 * 加工後のオブジェクト
 */
export interface Processed {
    /** Request time (ms) */
    it: number;
    /** Response time (ms) */
    rt: number;
    /** Round-trip time (ms) */
    rtt: number;
    /** Estimated offset (ms) */
    diff: number;
    /** Lower bound (ms) */
    lb: number;
    /** Upper bound (ms) */
    ub: number;
}
/**
 * 時刻配信サーバーからのレスポンス（加工後）
 */
export type ProcessedServerResponse = ServerResponse & Processed;
/**
 * オフセット計算結果ステータス
 */
export type Status = 'pending' | 'client_only' | 'server_only' | 'accurate';
/**
 * オフセット計算結果
 */
export interface CalculatedResult {
    status: Status;
    offset: number;
}
/**
 * 時刻配信サーバーの URL リスト
 */
export type ServerUrls = string[];
/**
 * 時計データ
 */
export interface ClockData {
    status: Status;
    offset: number;
    LOCAL: Date;
    LOCAL_STR: string;
    JST: Date;
    JST_STR: string;
    UTC: Date;
    UTC_STR: string;
    LOC: Date;
    LOC_STR: string;
}
/**
 * ServerClockの設定オプション
 */
export interface ServerClockOptions {
    /** 時刻配信サーバーのURLリスト */
    serverUrls: ServerUrls;
    /** サーバーからの時刻取得間隔(ミリ秒) (デフォルト: 180000 - 3分) */
    fetchInterval?: number;
    /** 時計の更新間隔(ミリ秒) (デフォルト: 10) */
    clockInterval?: number;
    /** HTTPリクエストのタイムアウト時間(ミリ秒) (デフォルト: 3000) */
    fetchTimeout?: number;
    /** サーバー接続失敗時にローカル時間を使用するか (デフォルト: true) */
    fallbackToLocal?: boolean;
}
/**
 * 時計イベントハンドラー
 */
export type ClockTickHandler = (clockData: ClockData) => void;
