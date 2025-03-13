import { CalculatedResult, ProcessedServerResponse, ServerResponse, ServerUrls } from './types';

/**
 * タイムアウト付きで fetch する
 */
export const fetchWithTimeout = async (url: string, timeout: number = 3000): Promise<Response> =>
  Promise.race([
    fetch(`${url}`, { method: 'GET' }),
    new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('❌ fetch timeout')), timeout);
    }),
  ]);

/**
 * 時刻配信サーバーからのレスポンスが有効かどうか
 */
export const isValidServerResult = (value: unknown): value is ServerResponse =>
  typeof value === 'object' &&
  value !== null &&
  'requestReceivedAt' in value &&
  'responseSentAt' in value &&
  value.requestReceivedAt != null &&
  value.responseSentAt != null &&
  typeof value.requestReceivedAt === 'number' &&
  typeof value.responseSentAt === 'number';

/**
 * 時刻配信サーバーからのレスポンスを加工する
 */
export const processResponse = (
  itMs: number,
  rtMs: number,
  data: ServerResponse,
): ProcessedServerResponse => {
  const st1 = data.requestReceivedAt;
  const st2 = data.responseSentAt;

  return {
    ...data,
    it: itMs,
    rt: rtMs,
    rtt: rtMs - itMs,
    diff: (st1 - itMs - (rtMs - st2)) / 2,
    lb: itMs - 16 - st1,
    ub: rtMs + 16 - st2,
  };
};

/**
 * サーバーからのレスポンスを元にオフセット(クライアントとサーバーのズレ)を計算する
 */
export const calculateOffset = (
  responses: ProcessedServerResponse[],
  serverUrls: ServerUrls,
): CalculatedResult => {
  if (responses.length === 0) {
    return { status: 'client_only', offset: 0 };
  }

  const { maxLb, minUb } = responses.reduce(
    (acc, cur) => ({
      maxLb: Math.max(acc.maxLb, cur.lb),
      minUb: Math.min(acc.minUb, cur.ub),
    }),
    { maxLb: -Infinity, minUb: Infinity },
  );

  const offset = -((maxLb + minUb) / 2);

  if (responses.length >= serverUrls.length && maxLb < minUb && minUb - maxLb < 500) {
    return { status: 'accurate', offset };
  }

  return { status: 'server_only', offset };
};

/**
 * クライアント時刻とサーバー時刻とのオフセットを計算する
 * @param serverUrls 時刻配信サーバーのURLリスト
 * @param fetchTimeout HTTPリクエストのタイムアウト時間(ミリ秒)
 * @param currentResult 現在のオフセット計算結果（オフライン時などに使用）
 */
export const fetchCalculateServerTimeOffset = async (
  serverUrls: ServerUrls,
  fetchTimeout: number = 3000,
  currentResult?: CalculatedResult,
): Promise<CalculatedResult> => {
  // NOTE: オフライン時はサーバー時刻を取得しても無駄なので、サーバーリストを空にする
  if (typeof navigator !== 'undefined' && !navigator.onLine && currentResult) {
    return currentResult;
  }

  const fetchResponses = await Promise.allSettled(
    serverUrls.map(async (server) => {
      const itMs = Date.now();
      const response = await fetchWithTimeout(server, fetchTimeout).catch((error) => {
        console.error(`[ServerClock] ❌ Failed to fetch data from '${server}': ${error}`);
        throw error;
      });
      const rtMs = Date.now();

      const data = await response.json();
      if (!isValidServerResult(data)) {
        console.error(`[ServerClock] ❌ Invalid server response from '${server}'`);
        throw new Error(`Invalid server response from '${server}'`);
      }

      return processResponse(itMs, rtMs, data);
    }),
  );

  const succeedResponses = fetchResponses
    .filter(
      (res): res is PromiseFulfilledResult<ProcessedServerResponse> => res.status === 'fulfilled',
    )
    .map((res) => res.value);

  return calculateOffset(succeedResponses, serverUrls);
};
