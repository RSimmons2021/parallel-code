import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'electron/main.ts',
    'electron/preload.cjs',
    'electron/mcp/server.ts', // added in coordinator-2-mcp-backend; listed here so knip tracks it from the start
  ],
  project: ['electron/**/*.ts', 'src/**/*.{ts,tsx}'],
  ignoreBinaries: ['gitleaks'],
  // Test files are allowed to have unused exports (test helpers, fixtures)
  ignoreExportsUsedInFile: true,
};

export default config;
