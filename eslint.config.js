import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/{components,pages}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/elevator/calculations/**',
                '**/elevator/rules/**',
                '**/collision/**',
                '**/simulation/**',
                '**/three/geometry/**',
              ],
              message:
                'Presentation code must consume feature-facing results instead of technical internals.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/engineering/**/*.{ts,tsx}',
      'src/elevator/**/*.{ts,tsx}',
      'src/collision/**/*.{ts,tsx}',
      'src/simulation/**/*.{ts,tsx}',
      'src/three/geometry/lift-geometry-planning-input.ts',
      'src/three/geometry/passenger/passenger-installation-model.ts',
      'src/three/geometry/passenger/mechanical/passenger-mechanical-layout.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Core technical modules must remain independent from React.',
            },
            {
              name: 'three',
              message:
                'Core technical modules must expose render-neutral data to the Three.js layer.',
            },
            {
              name: '@react-three/fiber',
              message: 'Core technical modules must remain independent from rendering.',
            },
            {
              name: '@react-three/drei',
              message: 'Core technical modules must remain independent from rendering.',
            },
          ],
        },
      ],
    },
  },
])
