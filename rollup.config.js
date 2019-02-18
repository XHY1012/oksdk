/**
 * Vendor
 */

import { terser } from "rollup-plugin-terser";
import typescript from "rollup-plugin-typescript2";

/**
 * Expo
 */

export default {
  input: "./src/index.ts",
  output: {
    file: "dist/oksdk.es.js",
    format: "es",
  },
  plugins: [typescript(), terser()]
};
