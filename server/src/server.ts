/* --------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
* ------------------------------------------------------------------------------------------ */
import {
  CompletionItem,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  InitializeParams,
  Position,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind
} from "vscode-languageserver";
import * as path from "path";
import { IExtensionSettings, ILintHtmlIssue, Linter } from "./types";
import { getLintHTML } from "./vscode-linthtml/get-linthtml";
import { localeConfig, readLocalConfig } from "./vscode-linthtml/local-config";
import { TextDocument, Range } from 'vscode-languageserver-textdocument';
import { URI } from "vscode-uri";

// Create a connection for the server. The connection uses Node"s IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
// @ts-ignore
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
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Full,
      },
      // Tell the client that the server supports code completion
      completionProvider: {
        // resolveProvider: true
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

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: IExtensionSettings = {
  enabled: true,
  configFile: undefined,
  packageManager: "npm"
};

let globalSettings: IExtensionSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<IExtensionSettings>> = new Map();
connection.onDidChangeConfiguration(({ settings }) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = (
      (settings.linthtml || defaultSettings)
    ) as IExtensionSettings;
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

// Only keep settings for open documents
documents.onDidClose((/*e*/) => {
  // documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
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

async function configForFile(textDocument: TextDocument, configFile?: string): Promise<any> | never {
  if (configFile && configFile.trim() !== "") {
    return readLocalConfig(configFile);
  }
  return localeConfig(textDocument, connection);
}
async function checkConfig(config: any, lintHTML: any) {
  try {
    await lintHTML("", config.config);
  } catch (error) {
    return error;
  }
}

function generateSeverity(issue: ILintHtmlIssue) {
  return issue.severity === "warning"
    ? DiagnosticSeverity.Warning
    : DiagnosticSeverity.Error;
}

function generateDiagnosticPosition(issue: ILintHtmlIssue): Range {
  if (issue.position) {
    let { start, end } = issue.position;
    return {
      start: Position.create(start.line - 1, start.column - 1),
      end: Position.create(end.line - 1, end.column - 1)
    }
  }

  return {
    // @ts-ignore
    start: Position.create(issue.line - 1, issue.column),
    // @ts-ignore
    end: Position.create(issue.line - 1, issue.column + 1)
  }
}

function printDiagnostics(issues: ILintHtmlIssue[], textDocument: TextDocument, lintHTML: any) {

  const diagnostics: Diagnostic[] = issues.map((issue: ILintHtmlIssue) => {
    return {
      severity: generateSeverity(issue),
      range: generateDiagnosticPosition(issue),
      code: issue.rule,
      source: "linthtml",
      message: issue.msg || lintHTML.messages.renderIssue(issue)
    };
  });
  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

async function lint(textDocument: TextDocument, linter: Linter, lintHTML: any) {
  const text = textDocument.getText();
  try {
    const issues: ILintHtmlIssue[] = await linter.lint(text);
    printDiagnostics(issues, textDocument, lintHTML);
  } catch (error) {
    return connection.window.showErrorMessage(`linthtml: ${error.message} In file ${URI.parse(textDocument.uri).fsPath}`);
  }
}

async function createLinter(textDocument: TextDocument, { configFile }: IExtensionSettings, lintHTML: any): Promise<Linter | undefined> {
  if (lintHTML.create_linters_for_files) {
    if (configFile && configFile.trim() !== "") {
      return lintHTML.from_config_path(configFile)
    }
    // need to send file path relative to vscode folder and not workspace folder
    let file_path = path.relative(process.cwd(), URI.parse(textDocument.uri).fsPath);
    const { linter } = lintHTML.create_linters_for_files([file_path], null, process.cwd())[0];
    return linter;
  }

  let config = await configForFile(textDocument, configFile);
  if (config !== null) {
    const error: Error = await checkConfig(config, lintHTML);
    if (error) {
      throw new Error(`${error.message}. Check your config file ${config.filepath}.`);
    }
    config = config.config;
  }

  return lintHTML.fromConfig(config);
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings: IExtensionSettings = await getDocumentSettings(textDocument.uri);
  try {
    const lintHTML = await getLintHTML(textDocument, { connection, packageManager: settings.packageManager});

    let linter = await createLinter(textDocument, settings, lintHTML);

    if (linter) {
      return lint(textDocument, linter, lintHTML);
    }
    return;
  } catch (error) {
    return connection.window.showErrorMessage(`linthtml: ${error.message}`);
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
