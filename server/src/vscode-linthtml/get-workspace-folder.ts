// @ts-ignore
import * as pathIsInside from 'path-is-inside';
import { URI } from 'vscode-uri';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection } from 'vscode-languageserver';

async function getWorkspaceFolder(
  document: TextDocument,
  connection: Connection,
) {
  const documentPath = URI.parse(document.uri).fsPath;
  const workspaceFolders = await connection.workspace.getWorkspaceFolders();

  if (documentPath) {
    if (workspaceFolders) {
      for (const { uri } of workspaceFolders) {
        const workspacePath = URI.parse(uri).fsPath;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        if (pathIsInside(documentPath, workspacePath)) {
          return workspacePath;
        }
      }
    }
  } else if (workspaceFolders && workspaceFolders.length) {
    const { uri } = workspaceFolders[0];

    return URI.parse(uri).fsPath;
  }

  return undefined;
}

export { getWorkspaceFolder };
