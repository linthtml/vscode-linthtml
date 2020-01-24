import * as cosmiconfig from "cosmiconfig";
import * as fs from "fs";
import { Files, TextDocument } from "vscode-languageserver";
import { getWorkspaceFolder } from "./get-workspace-folder";

function cannotReadConfig(filePath: string): Error {
  let isDirectory: boolean = false;
  let error: Error = new Error(`Cannot read config file "${filePath}"`);
  try {
    isDirectory = fs.lstatSync(filePath).isDirectory();
  } catch (e) {
    //
  } finally {
    if (isDirectory) {
      error = new Error(`Cannot read config file in directory "${filePath}"`);
    }
  }
  return error;
}

async function localeConfig(textDocument: TextDocument, connection) {
  const filePath = Files.uriToFilePath(textDocument.uri);
  const workspace: string = await getWorkspaceFolder(textDocument, connection);
  const explorer = cosmiconfig("linthtml", { stopDir: workspace, packageProp: "linthtmlConfig"});
  try {
    return explorer.searchSync(filePath);
  } catch (error) {
    return null;
  }
}

function readLocalConfig(configFile: string): any | never {
  try {
    const explorer = cosmiconfig("linthtml", { packageProp: "linthtmlConfig"});
    return explorer.loadSync(configFile);
  } catch (error) {
    throw cannotReadConfig(configFile);
  }
}

export { localeConfig, readLocalConfig };
