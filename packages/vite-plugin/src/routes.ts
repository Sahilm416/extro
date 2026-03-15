import fg from "fast-glob";
import path from "node:path";

export type Route = {
  path: string;
  file: string;
};

/**
 * @file routes.ts
 * @description Finds the popup routes in the project.
 */
export async function findPopupRoutes(root: string): Promise<Route[]> {
  const files = await fg("src/**/page.{ts,tsx}", {
    cwd: root,
    ignore: ["src/ext/**"],
  });

  return files.map((file) => {
    const routePath = file
      .replace(/^src/, "")
      .replace(/\/page\.(ts|tsx)$/, "")
      .replace(/^\//, "");

    return {
      path: routePath ? `/${routePath}` : "/",
      file: path.join(root, file),
    };
  });
}
