import typescript from "rollup-plugin-typescript2";

export default {
  input: "./src/index.ts",
  output: {
    file: "dist/oksdk.es.js",
    format: "es",
  },
  plugins: [typescript()]
};
