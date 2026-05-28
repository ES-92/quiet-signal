import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'public', 'docs', '.superpowers'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.serviceworker }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // ignoreRestSiblings: `const { encrypted, ...plain } = quote` intentionally strips fields via rest
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      // advisory rules from eslint-plugin-react-hooks v7: flag intentional setState-in-effect / impure-render patterns across ~10 existing files; keep as warnings to avoid mass-editing behavior-neutral code
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn'
    }
  },
  prettier
)
