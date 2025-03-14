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
const commonPlugins = [
  resolve(),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    sourceMap: false, // TypeScriptのソースマップ生成も無効化
  }),
];

// 難読化・最小化のための設定（バンドルサイズを極力削減）
const minifyOptions = {
  compress: {
    pure_funcs: [],
    drop_console: true,
    drop_debugger: true,
    passes: 3, // 最適化パスを増やす
    toplevel: true, // トップレベルの変数と関数も最適化
    unsafe: true, // 「安全でない」最適化を有効化
    unsafe_arrows: true,
    unsafe_comps: true,
    unsafe_Function: true,
    unsafe_math: true,
    unsafe_methods: true,
    unsafe_proto: true,
    unsafe_regexp: true,
    pure_getters: true, // getter呼び出しを純粋と見なす
    collapse_vars: true,
    booleans: true,
    if_return: true,
    inline: true,
    dead_code: true,
  },
  mangle: {
    reserved: ['WORKER_CODE'],
    toplevel: true, // トップレベルの変数名も難読化
    properties: {
      regex: /^_/, // アンダースコアで始まるプロパティ名を難読化
    },
  },
  format: {
    comments: false,
    ascii_only: true, // ASCII文字のみ使用
    wrap_iife: true, // IIFEをラップして安全に
  },
};

// ワーカーを最初にビルドして、他のバンドルで利用できるようにする
const buildOrder = [
  // WebWorker用バンドル（最初にビルド）
  {
    input: 'src/worker/index.ts',
    output: {
      file: 'dist/worker.js',
      format: 'iife', // 即時実行関数式
      sourcemap: false,
    },
    plugins: [...commonPlugins, terser(minifyOptions)],
  },
  // ESモジュール版 (modern JS environments)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: false,
    },
    plugins: [...commonPlugins, inlineWorkerPlugin(), terser(minifyOptions)],
  },
  // ブラウザ用バンドル (UMD - for <script> tags)
  {
    input: 'src/browser/index.ts',
    output: {
      file: 'dist/bundle.js',
      format: 'umd',
      name: 'WizDevelopServerClock',
      sourcemap: false,
      exports: 'named',
    },
    plugins: [...commonPlugins, inlineWorkerPlugin(), terser(minifyOptions)],
  },
  // ブラウザ用バンドル (最小化版) - 通常版を最小化
  {
    input: 'src/browser/index.ts',
    output: {
      file: 'dist/bundle.min.js',
      format: 'umd',
      name: 'WizDevelopServerClock',
      sourcemap: false,
      exports: 'named',
    },
    plugins: [
      ...commonPlugins,
      // コンパイル前にWorkerコードをインライン化
      inlineWorkerPlugin(),
      // その後minify
      terser(minifyOptions),
    ],
  },
];

export default buildOrder;
