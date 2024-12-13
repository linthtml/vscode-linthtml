import * as path from 'path';
import * as vscode from 'vscode';
import type { ServerState } from '../../extension';

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;

function is_document_linted(
  extension: vscode.Extension<ServerState>,
  docUri: string,
): Promise<void> {
  return new Promise((resolve, _) => {
    const id = setInterval(() => {
      if (
        extension.exports.status === 'VALIDATION_OK' &&
        extension.exports.document_checked === docUri
      ) {
        // does not mean file has been checked
        clearInterval(id);
        return resolve();
      }
    }, 200);
  });
}
/**
 * Activates the extension
 */
export async function activate(docUri: vscode.Uri) {
  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension('kamikillerto.vscode-linthtml')!;
  await ext.activate();
  try {
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);
    // TODO: Find a way to get server readiness (maybe extension client side can expose server status)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await is_document_linted(ext, docUri.fsPath); // Wait for server activation
    // await new Promise((resolve) => setTimeout(resolve, 4000));
  } catch (e) {
    /* tslint:disable no-console */
    console.error(e);
    /* tslint:enable no-console */
  }
}

export const getDocPath = (p: string) => {
  return path.resolve(__dirname, '..', '..', '..', 'testFixture', p);
};
export const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p));
};

export async function setTestContent(content: string): Promise<boolean> {
  const all = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length),
  );
  return editor.edit((eb) => eb.replace(all, content));
}
