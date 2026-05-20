/**
 * Ambient declarations for the virtual modules the runtime clients import.
 * The plugin (src/index.ts) resolves and loads each ID at build/dev time.
 *
 * This file is NOT named after a sibling .ts file on purpose — TS treats
 * `foo.d.ts` next to `foo.ts` as the manually-written declaration for that
 * source, NOT as a global ambient-declaration source.
 */

declare module "virtual:extro/csui-mount/config" {
  export const config: { dev: boolean };
}

declare module "virtual:extro/user/content-page" {
  const UserComponent: import("react").ComponentType;
  export default UserComponent;
}

declare module "virtual:extro/user/content-script" {}

declare module "virtual:extro/dev-bridge/config" {
  export const config: {
    signalPort: number;
    vitePort: number;
    hasCSUI: boolean;
  };
}

declare module "virtual:extro/user/background" {}
