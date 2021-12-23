// vite.config.js
import path from 'path';
import { defineConfig } from 'vite';
import typescript from '@rollup/plugin-typescript'

const resolvePath = (str: string) => path.resolve(__dirname, str)

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'Web3Auth',
      fileName: (format) => `web3-auth.${format}.js`
    },
    // plugins: [typescript({
    //   'tsconfig': './tsconfig.json',
    //   'noEmitOnError': true,
    //   'declaration': true,
    //   'declarationDir': resolvePath('./dist'),
    //   exclude: resolvePath('../../node_modules/**'),
    // })]
  }
})