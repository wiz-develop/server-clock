import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import fs from 'node:fs';
import path from 'node:path';

// WorkerコードをインラインにするためのRollupプラグイン
const inlineWorkerPlugin = () => ({
  name: 'inline-worker-plugin',
  transform(code, id) {
    // createInlineWorker.tsファイルのみ処理
    if (id.includes('createInlineWorker')) {
      // WebWorkerのビルド済みコードを読み込む
      const workerFilePath = path.resolve('./dist/worker.js');

      if (!fs.existsSync(workerFilePath)) {
        console.error('Worker file not found:', workerFilePath);
        return null;
      }

      // WebWorkerコードを取得
      const workerCode = fs.readFileSync(workerFilePath, 'utf8');

      // エスケープ処理
      const escapedWorkerCode = workerCode
        .replaceAll('\\', '\\\\')
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${');

      // WORKER_CODEプレースホルダをWebWorkerコードで置き換え
      const result = code.replace(
        /(const\s+WORKER_CODE\s*=\s*`)[\S\s]*?(`)/,
        (match, p1, p2) => `${p1}${escapedWorkerCode}${p2}`,
      );

      console.info(`✅ Inlined Worker code into: ${id}`);
      return {
        code: result,
        map: null,
      };
    }
    return null;
  },
});

// 共通設定
const commonPlugins = [resolve(), commonjs(), typescript({ tsconfig: './tsconfig.json' })];

// ワーカーを最初にビルドして、他のバンドルで利用できるようにする
const buildOrder = [
  // WebWorker用バンドル（最初にビルド）
  {
    input: 'src/worker/index.ts',
    output: {
      file: 'dist/worker.js',
      format: 'iife', // 即時実行関数式
      sourcemap: true,
    },
    plugins: commonPlugins,
  },
  // ESモジュール版 (modern JS environments)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [...commonPlugins, inlineWorkerPlugin()],
  },
  // ブラウザ用バンドル (UMD - for <script> tags)
  {
    input: 'src/browser/index.ts',
    output: {
      file: 'dist/bundle.js',
      format: 'umd',
      name: 'WizDevelopServerClock',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [...commonPlugins, inlineWorkerPlugin()],
  },
  // ブラウザ用バンドル (最小化版) - 通常版を最小化
  {
    input: 'src/browser/index.ts',
    output: {
      file: 'dist/bundle.min.js',
      format: 'umd',
      name: 'WizDevelopServerClock',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      ...commonPlugins,
      // コンパイル前にWorkerコードをインライン化
      inlineWorkerPlugin(),
      // その後minify
      terser({
        compress: {
          // 'WORKER_CODE'に関連する行を削除しないようにする
          pure_funcs: [],
          drop_console: false,
        },
        mangle: {
          reserved: ['WORKER_CODE'],
        },
      }),
    ],
  },
];

export default buildOrder;
