import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

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
    plugins: commonPlugins,
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
    plugins: commonPlugins,
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
    plugins: [...commonPlugins, terser()],
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
