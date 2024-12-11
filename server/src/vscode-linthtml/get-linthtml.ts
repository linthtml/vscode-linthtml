import { execSync } from 'child_process';
import * as path from 'path';
import { Files } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { getWorkspaceFolder } from './get-workspace-folder';
import type { Connection, TextDocument } from 'vscode-languageserver';
import type { ILintHtmlIssue, Linter } from '../types';

type Tracer = (message: string) => void;

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-implied-eval
const dynamicImport = new Function(
  'specifier',
  'return import(specifier).then(package => package.default ?? package)',
);

export type LintHTML_LIKE = {
  lint: (content: string) => Promise<ILintHtmlIssue>;
  create_linters_for_files?: (
    file_paths: string[],
    config: unknown,
  ) => Promise<Array<{ linter: Linter }>>;
  from_config_path: (config_path: string) => Promise<Linter>;
  fromConfig?: (config: unknown) => Promise<Linter>;
  messages: {
    renderIssue: (issue: ILintHtmlIssue) => string;
  };
};

async function getLintHTML(
  textDocument: TextDocument,
  {
    connection,
    packageManager,
  }: {
    connection: Connection;
    packageManager: string;
  },
) {
  function trace(message: string) {
    connection.tracer.log(message);
  }
  let cwd;
  try {
    // TODO: Use a setting or something to determine the package manager
    const resolvedGlobalPackageManagerPath = globalPathGet(
      packageManager,
      trace,
    );
    const uri = URI.parse(textDocument.uri);

    if (uri.scheme === 'file') {
      const file = uri.fsPath;
      const directory = path.dirname(file);

      cwd = directory;
    } else {
      const workspaceFolder = await getWorkspaceFolder(
        textDocument,
        connection,
      );

      cwd = workspaceFolder;
    }
    const lintHTMLPath = await Files.resolve(
      '@linthtml/linthtml',
      resolvedGlobalPackageManagerPath,
      cwd,
      trace,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const LintHTML = await dynamicImport(lintHTMLPath);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return (LintHTML.default ?? LintHTML) as LintHTML_LIKE;
  } catch (_error) {
    throw new Error('Cannot find global or local @linthtml/linthtml package');
  }
}

const globalPaths = {
  yarn: {
    cache: undefined,
    get(trace: Tracer) {
      return Files.resolveGlobalYarnPath(trace);
    },
  },
  npm: {
    cache: undefined,
    get(trace: Tracer) {
      return Files.resolveGlobalNodePath(trace);
    },
  },
  pnpm: {
    cache: undefined,
    get() {
      const pnpmPath = execSync('pnpm root -g').toString().trim();

      return pnpmPath;
    },
  },
} as const satisfies Record<
  string,
  { cache: undefined | string; get: (trace: Tracer) => string | undefined }
>;

function globalPathGet(packageManager: string, trace: Tracer) {
  const pm = globalPaths[packageManager as keyof typeof globalPaths];

  if (pm) {
    if (pm.cache === undefined) {
      // @ts-expect-error cache is not readonly
      pm.cache = pm.get(trace);
    }

    return pm.cache;
  }

  return undefined;
}

export { getLintHTML };
