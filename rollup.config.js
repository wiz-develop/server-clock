import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import fs from 'node:fs';
import path from 'node:path';

// WorkerコードをインラインにするためのRollupプラグイン
const inlineWorkerPlugin = () => ({
  name: 'inline-worker-plugin',
  async writeBundle(outputOptions, bundle) {
    // WebWorkerのビルド済みコードを読み込む
    const workerFilePath = path.resolve('./dist/worker.js');

    if (!fs.existsSync(workerFilePath)) {
      console.error('Worker file not found:', workerFilePath);
      return;
    }

    // WebWorkerコードを取得
    const workerCode = fs.readFileSync(workerFilePath, 'utf8');

    // 出力ディレクトリ内のcreateInlineWorker.jsファイルを探す
    for (const fileName of Object.keys(bundle)) {
      const bundleFile = bundle[fileName];

      if (
        bundleFile.type === 'chunk' &&
        bundleFile.code &&
        // createInlineWorker.tsに関連するファイルを探す
        (bundleFile.facadeModuleId?.includes('createInlineWorker') ||
          bundleFile.code.includes('WORKER_CODE'))
      ) {
        // エスケープ処理
        const escapedWorkerCode = workerCode
          .replaceAll('\\', '\\\\')
          .replaceAll('`', '\\`')
          .replaceAll('${', '\\${');

        // WORKER_CODEプレースホルダをWebWorkerコードで置き換え
        bundleFile.code = bundleFile.code.replace(
          /const\s+WORKER_CODE\s*=\s*`[^`]*`/,
          `const WORKER_CODE = \`${escapedWorkerCode}\``,
        );

        // ファイルに書き戻す
        if (bundleFile.fileName) {
          const outputPath = path.join(
            outputOptions.dir || path.dirname(outputOptions.file || ''),
            bundleFile.fileName,
          );
          fs.writeFileSync(outputPath, bundleFile.code, 'utf-8');
          console.log(`✅ Inlined Worker code into: ${outputPath}`);
        }
      }
    }
  },
});

// 共通設定
const commonPlugins = [resolve(), commonjs(), typescript({ tsconfig: './tsconfig.json' })];

export default [
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
  // ブラウザ用バンドル (最小化版)
  {
    input: 'src/browser/index.ts',
    output: {
      file: 'dist/bundle.min.js',
      format: 'umd',
      name: 'WizDevelopServerClock',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [...commonPlugins, inlineWorkerPlugin(), terser()],
  },
  // WebWorker用バンドル
  {
    input: 'src/worker/index.ts',
    output: {
      file: 'dist/worker.js',
      format: 'iife', // 即時実行関数式
      sourcemap: true,
    },
    plugins: commonPlugins,
  },
];
