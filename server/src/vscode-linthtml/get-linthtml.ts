import { execSync } from "child_process";
import * as path from "path";
import {
  Files,
  TextDocument
} from "vscode-languageserver";
import { URI } from "vscode-uri";
import { getWorkspaceFolder } from "./get-workspace-folder";

async function getLintHTML(textDocument: TextDocument, { connection, packageManager }: { connection: any, packageManager: string}) {
  function trace(message: string, verbose?: string) {
    connection.tracer.log(message, verbose);
  }
  let cwd;
  try {
    const resolvedGlobalPackageManagerPath = globalPathGet(packageManager, trace); // TODO: Use a setting or something to determine the package manager
    // const resolvedGlobalPackageManagerPath = globalPathGet(packageManager, trace);
    const uri = URI.parse(textDocument.uri);


    if (uri.scheme === "file") {
      const file = uri.fsPath;
      const directory = path.dirname(file);

      cwd = directory;
    } else {
      const workspaceFolder = await getWorkspaceFolder(textDocument, connection);

      cwd = workspaceFolder;
    }
    const lintHTMLPath = await Files.resolve(
      "@linthtml/linthtml",
      resolvedGlobalPackageManagerPath,
      cwd,
      trace,
    );

    const LintHTML = await import(lintHTMLPath);
    return LintHTML.default ?? LintHTML;
  } catch (error) {
    throw new Error("Cannot find global or local @linthtml/linthtml package");
  }
}

const globalPaths: any = {
  yarn: {
    cache: undefined,
    get(trace: any) {
      return Files.resolveGlobalYarnPath(trace);
    },
  },
  npm: {
    cache: undefined,
    get(trace: any) {
      return Files.resolveGlobalNodePath(trace);
    },
  },
  pnpm: {
    cache: undefined,
    get() {
      const pnpmPath = execSync("pnpm root -g")
        .toString()
        .trim();

      return pnpmPath;
    },
  },
};

function globalPathGet(packageManager: string, trace: any) {
  const pm: any = globalPaths[packageManager];

  if (pm) {
    if (pm.cache === undefined) {
      pm.cache = pm.get(trace);
    }

    return pm.cache;
  }

  return undefined;
}

export { getLintHTML };
