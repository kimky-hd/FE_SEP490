/* ESLint 8 (legacy config). Tối thiểu: TS + react-hooks + no-console (giữ quy tắc không log token/dữ liệu nhạy cảm). */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended', 'prettier'],
  ignorePatterns: ['dist', 'node_modules', '.taste-skill', '.kilo', 'doc', '*.cjs', '*.mjs'],
  rules: {
    'no-console': 'error',
    // Repo không dùng dấu chấm phẩy nên có chỗ cố ý mở dòng bằng `;(` — không phải lỗi.
    'no-extra-semi': 'off',
    // Nhiều file trang export kèm schema/hằng số (dùng trong test) — chỉ ảnh hưởng HMR, tắt cho đỡ nhiễu.
    'react-refresh/only-export-components': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**', 'vite.config.ts'],
      env: { node: true },
      rules: { 'no-console': 'off' },
    },
  ],
}
