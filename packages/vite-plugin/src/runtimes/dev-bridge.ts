import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * @file runtimes/dev-bridge.ts
 * @description Plugin-side loader for the Dev Bridge Runtime module.
 *
 * Owns the virtual IDs this runtime consumes and emits source for each.
 * The runtime client itself lives at `runtimes/clients/dev-bridge.ts`
 * (a real TS file compiled separately via `tsconfig.runtime.json`); this
 * loader only reads the compiled JS and emits the small config / user-
 * import virtuals it imports.
 */

export const DEV_BRIDGE_ENTRY_ID = "virtual:extro/dev-background";
export const DEV_BRIDGE_CONFIG_ID = "virtual:extro/dev-bridge/config";
export const DEV_BRIDGE_USER_BG_ID = "virtual:extro/user/background";

const clientJsURL = new URL("./clients/dev-bridge.js", import.meta.url);

export const loadDevBridgeClient = (): string =>
  fs.readFileSync(fileURLToPath(clientJsURL), "utf-8");

interface DevBridgeConfig {
  signalPort: number;
  vitePort: number;
  hasCSUI: boolean;
}

export const devBridgeConfigSource = (cfg: DevBridgeConfig): string =>
  `export const config = ${JSON.stringify(cfg)};\n`;

export const devBridgeUserBackgroundSource = (
  backgroundPath: string | undefined,
): string =>
  backgroundPath ? `import ${JSON.stringify(backgroundPath)};\n` : "\n";
