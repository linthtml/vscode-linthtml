/* --------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
* ------------------------------------------------------------------------------------------ */

import * as linthtml from "@linthtml/linthtml";
import * as cosmiconfig from "cosmiconfig";
import * as fs from "fs";
import * as path from "path";
import {
  CompletionItem,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  Files,
  InitializeParams,
  Position,
  ProposedFeatures,
  TextDocument,
  TextDocuments,
  WorkspaceFolder
} from "vscode-languageserver";
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings
  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
  hasDiagnosticRelatedInformationCapability =
    !!(capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation);

  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      // Tell the client that the server supports code completion
      completionProvider: {
        resolveProvider: true
      }
    }
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((/*event*/) => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

// The example settings
interface IExtensionSettings {
  enabled: boolean;
  configFile: string|null;
}

interface ILintHtmlIssue {
  code: string;
  column: number;
  line: number;

  rule: string;
  msg: string;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: IExtensionSettings = { enabled: true, configFile: null };
let globalSettings: IExtensionSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<IExtensionSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = (
      (change.settings.languageServerExample || defaultSettings)
    ) as IExtensionSettings;
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<IExtensionSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "linthtml"
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function findFileWorkspace(textDocument: TextDocument): Promise<string> {
  const filePath = Files.uriToFilePath(textDocument.uri);
  const workspaces = await connection.workspace.getWorkspaceFolders();

  function transform(workspace: WorkspaceFolder): {dir: string, length: number} {
    const dir = Files.uriToFilePath(workspace.uri);
    return {
      dir,
      length: path.relative(dir, filePath).length
    };
  }

  function sort(a: {dir: string, length: number}, b: {dir: string, length: number}): number {
    if (a.length > b.length) {
      return 1;
    } else if (a.length < b.length) {
      return -1;
    }
    return 0;
  }
  // Get relative path between the current file and the workspaces dir
  // Sort by the smallest one and return the path to the workspace with the smallest diff
  return workspaces.map(transform).sort(sort)[0].dir;
}

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

async function checkConfig(config: any) {
  try {
    await linthtml("", config.config);
  } catch (error) {
    return error;
  }
}

function printDiagnostics(issues: ILintHtmlIssue[], textDocument: TextDocument) {
  const diagnostics: Diagnostic[] = [];

  issues.forEach((issue: ILintHtmlIssue) => {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: Position.create(issue.line - 1, issue.column),
        end: Position.create(issue.line - 1, issue.column + 1)
      },
      code: issue.rule,
      source: "linthtml",
      message: issue.msg || linthtml.messages.renderIssue(issue)
    };
    diagnostics.push(diagnostic);
  });
  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

async function getLocaleConfig(textDocument: TextDocument) {
  const filePath = Files.uriToFilePath(textDocument.uri);
  const workspace: string = await findFileWorkspace(textDocument);
  const explorer = cosmiconfig("linthtml", { stopDir: workspace, packageProp: "linthtmlConfig"});
  try {
    return explorer.searchSync(filePath);
  } catch (error) {
    return null;
  }
}

function readConfigFromFile(configFile: string): any | never {
  try {
    const explorer = cosmiconfig("linthtml", { packageProp: "linthtmlConfig"});
    return explorer.loadSync(configFile);
  } catch (error) {
    throw cannotReadConfig(configFile);
  }
}

async function getConfigForFile(textDocument: TextDocument): Promise<any> | never {
  const settings: IExtensionSettings = await getDocumentSettings(textDocument.uri);

  if (settings.configFile !== null) {
    return readConfigFromFile(settings.configFile);
  }
  return getLocaleConfig(textDocument);
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  // In this simple example we get the settings for every validate run.
  try {
    let config = await getConfigForFile(textDocument);

    if (config !== null) {
      const error: Error = await checkConfig(config);
      if (error) {
        return connection.window.showErrorMessage(`linthtml: ${error.message}. Check your config file ${config.filepath}.`);
      }
      config = config.config;
    }

    return lint(textDocument, config);
  } catch (error) {
    return connection.window.showErrorMessage(`linthtml: ${error.message}`);
  }
}

async function lint(textDocument: TextDocument, config: any) {
  const filePath = Files.uriToFilePath(textDocument.uri);
  const text = textDocument.getText();
  try {
    const issues: ILintHtmlIssue[] = await linthtml(text, config);
    printDiagnostics(issues, textDocument);
  } catch (error) {
    return connection.window.showErrorMessage(`linthtml: ${error.message} In file ${filePath}`);
  }
}

connection.onDidChangeWatchedFiles((/*change*/) => {
  // changes globalConfig
  // need to load config once before ^^
  documents.all().forEach((file) => validateTextDocument(file));
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (/*textDocumentPosition: TextDocumentPositionParams*/): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    // Return completion of linthtml rules
    return [
      // {
      //   label: "TypeScript",
      //   kind: CompletionItemKind.Text,
      //   data: 1
      // },
      // {
      //   label: "JavaScript",
      //   kind: CompletionItemKind.Text,
      //   data: 2
      // }
    ];
  }
);

// This handler resolve additional information for the item selected in
// the completion list.
// connection.onCompletionResolve(
//   (item: CompletionItem): CompletionItem => {
//     if (item.data === 1) {
//       (item.detail = "TypeScript details"),
//         (item.documentation = "TypeScript documentation");
//     } else if (item.data === 2) {
//       (item.detail = "JavaScript details"),
//         (item.documentation = "JavaScript documentation");
//     }
//     return item;
//   }
// );

connection.onDidOpenTextDocument((params) => {
  // A text document got opened in VSCode.
  // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
  // params.text the initial full content of the document.
  connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
  // The content of a text document did change in VSCode.
  // params.uri uniquely identifies the document.
  // params.contentChanges describe the content changes to the document.
  connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
  // A text document got closed in VSCode.
  // params.uri uniquely identifies the document.
  connection.console.log(`${params.textDocument.uri} closed.`);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
