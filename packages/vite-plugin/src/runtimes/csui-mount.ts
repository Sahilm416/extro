import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * @file runtimes/csui-mount.ts
 * @description Plugin-side loader for the CSUI Mount Runtime module.
 *
 * Owns the virtual IDs this runtime consumes and emits source for each.
 * The runtime client itself lives at `runtimes/clients/csui-mount.ts`
 * (a real TS file compiled separately via `tsconfig.runtime.json`); this
 * loader only reads the compiled JS and emits the small config / user-
 * import virtuals it imports.
 */

export const CSUI_ENTRY_ID = "virtual:extro/csui-content";
export const CSUI_CONFIG_ID = "virtual:extro/csui-mount/config";
export const CSUI_USER_PAGE_ID = "virtual:extro/user/content-page";
export const CSUI_USER_SCRIPT_ID = "virtual:extro/user/content-script";

const clientJsURL = new URL("./clients/csui-mount.js", import.meta.url);

export const loadCSUIClient = (): string =>
  fs.readFileSync(fileURLToPath(clientJsURL), "utf-8");

export const csuiConfigSource = (dev: boolean): string =>
  `export const config = ${JSON.stringify({ dev })};\n`;

export const csuiUserPageSource = (pagePath: string): string =>
  `export { default } from ${JSON.stringify(pagePath)};\n`;

export const csuiUserScriptSource = (scriptPath: string | undefined): string =>
  scriptPath ? `import ${JSON.stringify(scriptPath)};\n` : "\n";
