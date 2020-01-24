import * as pathIsInside from "path-is-inside";
import URI from "vscode-uri";

async function getWorkspaceFolder(document, connection) {
  const documentPath = URI.parse(document.uri).fsPath;

  if (documentPath) {
    const workspaceFolders = await connection.workspace.getWorkspaceFolders();

    if (workspaceFolders) {
      for (const { uri } of workspaceFolders) {
        const workspacePath = URI.parse(uri).fsPath;

        if (pathIsInside(documentPath, workspacePath)) {
          return workspacePath;
        }
      }
    }
  }

  return undefined;
}

export { getWorkspaceFolder };
