import { CalculatedResult, ProcessedServerResponse, ServerResponse, ServerUrls } from './types';
/**
 * タイムアウト付きで fetch する
 */
export declare const fetchWithTimeout: (url: string, timeout?: number) => Promise<Response>;
/**
 * 時刻配信サーバーからのレスポンスが有効かどうか
 */
export declare const isValidServerResult: (value: unknown) => value is ServerResponse;
/**
 * 時刻配信サーバーからのレスポンスを加工する
 */
export declare const processResponse: (itMs: number, rtMs: number, data: ServerResponse) => ProcessedServerResponse;
/**
 * サーバーからのレスポンスを元にオフセット(クライアントとサーバーのズレ)を計算する
 */
export declare const calculateOffset: (responses: ProcessedServerResponse[], serverUrls: ServerUrls) => CalculatedResult;
/**
 * クライアント時刻とサーバー時刻とのオフセットを計算する
 * @param serverUrls 時刻配信サーバーのURLリスト
 * @param fetchTimeout HTTPリクエストのタイムアウト時間(ミリ秒)
 * @param currentResult 現在のオフセット計算結果（オフライン時などに使用）
 */
export declare const fetchCalculateServerTimeOffset: (serverUrls: ServerUrls, fetchTimeout?: number, currentResult?: CalculatedResult) => Promise<CalculatedResult>;
