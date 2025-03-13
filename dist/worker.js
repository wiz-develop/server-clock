(function () {
    'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol, Iterator */


    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    /**
     * タイムアウト付きで fetch する
     */
    const fetchWithTimeout = (url, timeout = 3000) => __awaiter(void 0, void 0, void 0, function* () {
        return Promise.race([
            fetch(`${url}`, { method: 'GET' }),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('❌ fetch timeout')), timeout);
            }),
        ]);
    });
    /**
     * 時刻配信サーバーからのレスポンスが有効かどうか
     */
    const isValidServerResult = (value) => typeof value === 'object' &&
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
    const processResponse = (itMs, rtMs, data) => {
        const st1 = data.requestReceivedAt;
        const st2 = data.responseSentAt;
        return Object.assign(Object.assign({}, data), { it: itMs, rt: rtMs, rtt: rtMs - itMs, diff: (st1 - itMs - (rtMs - st2)) / 2, lb: itMs - 16 - st1, ub: rtMs + 16 - st2 });
    };
    /**
     * サーバーからのレスポンスを元にオフセット(クライアントとサーバーのズレ)を計算する
     */
    const calculateOffset = (responses, serverUrls) => {
        if (responses.length === 0) {
            return { status: 'client_only', offset: 0 };
        }
        const { maxLb, minUb } = responses.reduce((acc, cur) => ({
            maxLb: Math.max(acc.maxLb, cur.lb),
            minUb: Math.min(acc.minUb, cur.ub),
        }), { maxLb: -Infinity, minUb: Infinity });
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
    const fetchCalculateServerTimeOffset = (serverUrls, fetchTimeout = 3000, currentResult) => __awaiter(void 0, void 0, void 0, function* () {
        // NOTE: オフライン時はサーバー時刻を取得しても無駄なので、サーバーリストを空にする
        if (typeof navigator !== 'undefined' && !navigator.onLine && currentResult) {
            return currentResult;
        }
        const fetchResponses = yield Promise.allSettled(serverUrls.map((server) => __awaiter(void 0, void 0, void 0, function* () {
            const itMs = Date.now();
            const response = yield fetchWithTimeout(server, fetchTimeout).catch((error) => {
                console.error(`[ServerClock] ❌ Failed to fetch data from '${server}': ${error}`);
                throw error;
            });
            const rtMs = Date.now();
            const data = yield response.json();
            if (!isValidServerResult(data)) {
                console.error(`[ServerClock] ❌ Invalid server response from '${server}'`);
                throw new Error(`Invalid server response from '${server}'`);
            }
            return processResponse(itMs, rtMs, data);
        })));
        const succeedResponses = fetchResponses
            .filter((res) => res.status === 'fulfilled')
            .map((res) => res.value);
        return calculateOffset(succeedResponses, serverUrls);
    });

    /**
     * 時刻を文字列に変換する
     */
    const toDateStr = (t) => {
        const yy = t.getUTCFullYear();
        const MM = (t.getUTCMonth() + 1).toString().padStart(2, '0');
        const dd = t.getUTCDate().toString().padStart(2, '0');
        const hh = t.getUTCHours().toString().padStart(2, '0');
        const mm = t.getUTCMinutes().toString().padStart(2, '0');
        const ss = t.getUTCSeconds().toString().padStart(2, '0');
        const ms = t.getUTCMilliseconds().toString().padStart(3, '0');
        return `${yy}/${MM}/${dd} ${hh}:${mm}:${ss}.${ms}`;
    };

    // WebWorker環境にあることを確認
    if (typeof self === 'undefined') {
        throw new Error('This script must be executed in a WebWorker environment');
    }
    // グローバル定数
    const CLOCK_INTERVAL = 10; // Refresh clock display every 10ms
    const FETCH_TIMEOUT = 3000; // HTTP timeout is 3 seconds
    // 状態管理
    let result = { status: 'pending', offset: 0 };
    let clockloopTimer = null;
    let fetchloopTimer = null;
    /**
     * 時計を取得する
     */
    const getClock = () => {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const utcMs = now.getTime() + result.offset + CLOCK_INTERVAL / 2;
        const times = {
            status: result.status,
            offset: Math.round((result.offset / 1000) * 10) / 10,
            LOCAL: new Date(now.getTime() - tzOffset),
            JST: new Date(utcMs + 9 * 3600000),
            UTC: new Date(utcMs),
            LOC: new Date(utcMs - tzOffset),
        };
        return Object.assign(Object.assign({}, times), { LOCAL_STR: toDateStr(times.LOCAL), JST_STR: toDateStr(times.JST), UTC_STR: toDateStr(times.UTC), LOC_STR: toDateStr(times.LOC) });
    };
    /**
     * 時計を開始する
     * @param serverList 時刻配信サーバーの URL リスト
     * @param fetchInterval サーバーからの時刻取得間隔(ミリ秒) ※デフォルトは3分
     */
    const startClock = (serverList, fetchInterval = 1000 * 60 * 3) => __awaiter(void 0, void 0, void 0, function* () {
        if (clockloopTimer) {
            clearInterval(clockloopTimer);
        }
        if (fetchloopTimer) {
            clearInterval(fetchloopTimer);
        }
        // サーバーとの時間オフセットを計算
        result = yield fetchCalculateServerTimeOffset(serverList, FETCH_TIMEOUT);
        // 定期的にサーバー時間を取得
        fetchloopTimer = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            result = yield fetchCalculateServerTimeOffset(serverList, FETCH_TIMEOUT, result);
        }), fetchInterval);
        // 時計を更新して送信
        clockloopTimer = setInterval(() => {
            const clock = getClock();
            self.postMessage(clock); // メインスレッドに送信
        }, CLOCK_INTERVAL);
    });
    /**
     * 時計を停止する
     */
    const stopClock = () => {
        if (clockloopTimer) {
            clearInterval(clockloopTimer);
            clockloopTimer = null;
        }
        if (fetchloopTimer) {
            clearInterval(fetchloopTimer);
            fetchloopTimer = null;
        }
    };
    // メッセージハンドラ
    self.addEventListener('message', (event) => {
        console.info('[ServerClock Worker] Message received:', event.data);
        switch (event.data.type) {
            case 'start':
                if (event.data.serverList == null) {
                    console.error('[ServerClock Worker] serverList is required');
                    break;
                }
                startClock(event.data.serverList, event.data.fetchInterval);
                break;
            case 'stop':
                stopClock();
                break;
            default:
                console.error('[ServerClock Worker] Unknown message type:', event.data);
                break;
        }
    });
    // エラーハンドラ
    self.addEventListener('error', (event) => {
        console.error('[ServerClock Worker] Error:', event);
    });

})();
//# sourceMappingURL=worker.js.map
