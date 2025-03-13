/**
 * インラインWebWorkerを作成するためのユーティリティ関数
 *
 * このモジュールは、Nuxt3などの環境で
 * WebWorkerを簡単に使用できるようにするためのユーティリティです。
 *
 * worker.jsファイルをpublicディレクトリにコピーする代わりに、
 * ランタイムでWebWorkerコードをインライン化します。
 */

// プロダクションビルド時に埋め込まれるワーカーコード
// このコメントはビルド時にrollupプラグインによって置き換えられます
const WORKER_CODE = `
// このコードはビルド時に自動生成されるため、手動で編集しないでください
// src/worker/index.tsのコードがここに埋め込まれます
`;

/**
 * WebWorkerコードをBlobURLとして返す
 * @returns WorkerのBlobURL
 */
export const createInlineWorker = (): string => {
  const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};

/**
 * 環境に応じたWorker URLを取得する
 *
 * - Nuxt3環境: BlobURLを使用
 * - 通常環境: 指定されたパスを使用
 *
 * @param defaultUrl デフォルトのWorkerURL
 * @returns 環境に適したWorkerURL
 */
export const getWorkerUrl = (defaultUrl = './worker.js'): string => {
  // 明示的にブラウザ環境でない場合はデフォルトのURLを返す
  if (typeof window === 'undefined') {
    return defaultUrl;
  }

  return createInlineWorker();
};
