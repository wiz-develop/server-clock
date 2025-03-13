(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.WizDevelopServerClock = {}));
})(this, (function (exports) { 'use strict';

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
    /**
     * サーバー時間同期時計のコア実装
     */
    class CoreClock {
        constructor(options) {
            var _a, _b, _c, _d;
            this.result = { status: 'pending', offset: 0 };
            this.clockloopTimer = null;
            this.fetchloopTimer = null;
            this.tickHandlers = new Set();
            this.serverUrls = options.serverUrls;
            this.fetchInterval = (_a = options.fetchInterval) !== null && _a !== void 0 ? _a : 1000 * 60 * 3; // デフォルト3分
            this.clockInterval = (_b = options.clockInterval) !== null && _b !== void 0 ? _b : 10; // デフォルト10ms
            this.fetchTimeout = (_c = options.fetchTimeout) !== null && _c !== void 0 ? _c : 3000; // デフォルト3秒
            this.fallbackToLocal = (_d = options.fallbackToLocal) !== null && _d !== void 0 ? _d : true; // デフォルトtrueでローカル時間にフォールバック
        }
        /**
         * 時計を取得する
         */
        getClock() {
            const now = new Date();
            const tzOffset = now.getTimezoneOffset() * 60000;
            // 半分のクロック間隔を足して丸め誤差を減らす
            const utcMs = now.getTime() + this.result.offset + this.clockInterval / 2;
            const times = {
                status: this.result.status,
                offset: Math.round((this.result.offset / 1000) * 10) / 10,
                LOCAL: new Date(now.getTime() - tzOffset),
                JST: new Date(utcMs + 9 * 3600000),
                UTC: new Date(utcMs),
                LOC: new Date(utcMs - tzOffset),
            };
            return Object.assign(Object.assign({}, times), { LOCAL_STR: toDateStr(times.LOCAL), JST_STR: toDateStr(times.JST), UTC_STR: toDateStr(times.UTC), LOC_STR: toDateStr(times.LOC) });
        }
        /**
         * 時計のティックイベントハンドラーを登録する
         */
        onTick(handler) {
            this.tickHandlers.add(handler);
            // 登録解除用の関数を返す
            return () => {
                this.tickHandlers.delete(handler);
            };
        }
        /**
         * 時計を開始する
         */
        start() {
            return __awaiter(this, void 0, void 0, function* () {
                this.stop();
                // サーバー時間オフセットを初期化
                try {
                    this.result = yield fetchCalculateServerTimeOffset(this.serverUrls, this.fetchTimeout, this.fallbackToLocal ? undefined : this.result);
                }
                catch (error) {
                    console.error('[ServerClock] Failed to initialize time offset:', error);
                    if (!this.fallbackToLocal) {
                        throw error;
                    }
                }
                // 定期的にサーバー時間を取得
                this.fetchloopTimer = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        this.result = yield fetchCalculateServerTimeOffset(this.serverUrls, this.fetchTimeout, this.result);
                    }
                    catch (error) {
                        console.error('[ServerClock] Failed to update time offset:', error);
                    }
                }), this.fetchInterval);
                // 時計を更新
                this.clockloopTimer = setInterval(() => {
                    const clock = this.getClock();
                    // 全てのハンドラを呼び出す
                    this.tickHandlers.forEach((handler) => {
                        try {
                            handler(clock);
                        }
                        catch (error) {
                            console.error('[ServerClock] Error in tick handler:', error);
                        }
                    });
                }, this.clockInterval);
            });
        }
        /**
         * 時計を停止する
         */
        stop() {
            if (this.clockloopTimer) {
                clearInterval(this.clockloopTimer);
                this.clockloopTimer = null;
            }
            if (this.fetchloopTimer) {
                clearInterval(this.fetchloopTimer);
                this.fetchloopTimer = null;
            }
        }
        /**
         * 現在の時間オフセット値を取得
         */
        getTimeOffset() {
            return this.result.offset;
        }
        /**
         * 現在の同期ステータスを取得
         */
        getStatus() {
            return this.result.status;
        }
    }

    /**
     * WebWorkerを使用した時計プロキシ
     * メインスレッドとWebWorker間の通信を管理します
     */
    class WorkerProxy {
        /**
         * @param options ServerClock オプション
         * @param workerUrl WebWorkerのURL (デフォルト: './worker.js')
         */
        constructor(options, workerUrl = './worker.js') {
            this.worker = null;
            this.tickHandlers = new Set();
            /**
             * Workerからのメッセージをハンドリングするためのメソッド
             */
            this.handleWorkerMessage = (event) => {
                // 全てのハンドラを呼び出す
                this.tickHandlers.forEach((handler) => {
                    try {
                        handler(event.data);
                    }
                    catch (error) {
                        console.error('[ServerClock] Error in tick handler:', error);
                    }
                });
            };
            /**
             * Workerからのエラーをハンドリングするためのメソッド
             */
            this.handleWorkerError = (event) => {
                console.error('[ServerClock] Worker error:', event);
            };
            this.options = options;
            this.workerUrl = workerUrl;
        }
        /**
         * 時計のティックイベントハンドラーを登録する
         */
        onTick(handler) {
            this.tickHandlers.add(handler);
            // 登録解除用の関数を返す
            return () => {
                this.tickHandlers.delete(handler);
            };
        }
        /**
         * WebWorkerを開始する
         */
        start() {
            if (this.worker) {
                this.stop();
            }
            try {
                // WebWorkerを作成
                this.worker = new Worker(this.workerUrl);
                // メッセージハンドラを設定
                this.worker.addEventListener('message', this.handleWorkerMessage);
                this.worker.addEventListener('error', this.handleWorkerError);
                // Workerに開始メッセージを送信
                this.worker.postMessage({
                    type: 'start',
                    serverList: this.options.serverUrls,
                    fetchInterval: this.options.fetchInterval,
                });
            }
            catch (error) {
                console.error('[ServerClock] Failed to start worker:', error);
                throw error;
            }
        }
        /**
         * WebWorkerを停止する
         */
        stop() {
            if (this.worker) {
                // Workerに停止メッセージを送信
                this.worker.postMessage({
                    type: 'stop',
                });
                // イベントリスナーを削除
                this.worker.removeEventListener('message', this.handleWorkerMessage);
                this.worker.removeEventListener('error', this.handleWorkerError);
                // Workerを終了
                this.worker.terminate();
                this.worker = null;
            }
        }
        /**
         * WebWorkerが利用可能かどうかをチェック
         */
        static isWorkerAvailable() {
            return typeof Worker !== 'undefined';
        }
    }

    /**
     * サーバー同期時計のブラウザ実装
     * 環境に応じてWebWorkerかメインスレッドで実行
     */
    class ServerClock {
        /**
         * @param options サーバー時計のオプション
         * @param forceSingleThread WebWorkerが利用可能でも強制的にシングルスレッドで実行する場合はtrue
         * @param workerUrl WebWorkerのURL (デフォルト: './worker.js')
         */
        constructor(options, forceSingleThread = false, workerUrl = './worker.js') {
            var _a, _b, _c, _d;
            this.lastTickData = null;
            this.tickHandlers = new Set();
            /**
             * 時計の進行によるイベント通知を処理
             */
            this.handleTick = (data) => {
                this.lastTickData = data;
                // 登録されたすべてのハンドラに通知
                this.tickHandlers.forEach((handler) => {
                    try {
                        handler(data);
                    }
                    catch (error) {
                        console.error('[ServerClock] Error in tick handler:', error);
                    }
                });
            };
            this.options = Object.assign(Object.assign({}, options), { fetchInterval: (_a = options.fetchInterval) !== null && _a !== void 0 ? _a : 1000 * 60 * 3, clockInterval: (_b = options.clockInterval) !== null && _b !== void 0 ? _b : 10, fetchTimeout: (_c = options.fetchTimeout) !== null && _c !== void 0 ? _c : 3000, fallbackToLocal: (_d = options.fallbackToLocal) !== null && _d !== void 0 ? _d : true });
            // WebWorkerが利用可能で、強制シングルスレッドでない場合はWorkerを使用
            this.useWorker = !forceSingleThread && WorkerProxy.isWorkerAvailable();
            if (this.useWorker) {
                this.implementation = new WorkerProxy(this.options, workerUrl);
            }
            else {
                this.implementation = new CoreClock(this.options);
            }
            // 実装からの時計イベントをハンドル
            this.implementation.onTick(this.handleTick);
        }
        /**
         * 時計のティックイベントハンドラーを登録する
         * @returns 登録解除用の関数
         */
        onTick(handler) {
            this.tickHandlers.add(handler);
            // 既に時計データがある場合は即時にハンドラを呼び出す
            if (this.lastTickData) {
                try {
                    handler(this.lastTickData);
                }
                catch (error) {
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
        start() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.useWorker) {
                    this.implementation.start();
                }
                else {
                    yield this.implementation.start();
                }
            });
        }
        /**
         * 時計を停止する
         */
        stop() {
            this.implementation.stop();
        }
        /**
         * 時計がWebWorkerモードで動作しているかどうか
         */
        isUsingWorker() {
            return this.useWorker;
        }
    }

    exports.ServerClock = ServerClock;
    exports.default = ServerClock;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=bundle.js.map
