// @ts-ignore
import * as pathIsInside from "path-is-inside";
import { URI } from "vscode-uri";
import { TextDocument } from 'vscode-languageserver-textdocument';

async function getWorkspaceFolder(document: TextDocument, connection: any) {
  const documentPath = URI.parse(document.uri).fsPath;
  const workspaceFolders = await connection.workspace.getWorkspaceFolders();

  if (documentPath) {
    if (workspaceFolders) {
      for (const { uri } of workspaceFolders) {
        const workspacePath = URI.parse(uri).fsPath;

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
