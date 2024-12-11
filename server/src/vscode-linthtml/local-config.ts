import { cosmiconfigSync as cosmiconfig } from 'cosmiconfig';
import * as fs from 'fs';
import type { Connection, TextDocument } from 'vscode-languageserver';
import { Files } from 'vscode-languageserver/node';
import { getWorkspaceFolder } from './get-workspace-folder';

function cannotReadConfig(filePath: string): Error {
  let isDirectory: boolean = false;
  let error: Error = new Error(`Cannot read config file "${filePath}"`);
  try {
    isDirectory = fs.lstatSync(filePath).isDirectory();
  } catch (_e) {
    //
  } finally {
    if (isDirectory) {
      error = new Error(`Cannot read config file in directory "${filePath}"`);
    }
  }
  return error;
}

async function localeConfig(
  textDocument: TextDocument,
  connection: Connection,
) {
  const filePath = Files.uriToFilePath(textDocument.uri);
  const workspace: string | undefined = await getWorkspaceFolder(
    textDocument,
    connection,
  );
  const explorer = cosmiconfig('linthtml', {
    stopDir: workspace,
    packageProp: 'linthtmlConfig',
  });
  try {
    return explorer.search(filePath);
  } catch (_error) {
    return null;
  }
}

function readLocalConfig(configFile: string) {
  try {
    const explorer = cosmiconfig('linthtml', { packageProp: 'linthtmlConfig' });
    return explorer.load(configFile);
  } catch (_error) {
    throw cannotReadConfig(configFile);
  }
}

export { localeConfig, readLocalConfig };
