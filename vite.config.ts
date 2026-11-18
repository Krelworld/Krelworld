import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { chunkSizeWarningLimit: 2500 },
  // agents' git worktrees live under .claude/: don't watch them (their edits would reload everyone's page)
  server: { watch: { ignored: ["**/.claude/**"] } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
} as any);
