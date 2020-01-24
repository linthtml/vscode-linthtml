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
  Files,
  InitializeParams,
  Position,
  ProposedFeatures,
  TextDocument,
  TextDocuments
} from "vscode-languageserver";
import { IExtensionSettings, ILintHtmlIssue } from "./types";
import { getLintHTML } from "./vscode-linthtml/get-linthtml";
import { localeConfig, readLocalConfig } from "./vscode-linthtml/local-config";

// Create a connection for the server. The connection uses Node"s IPC as a transport.
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

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: IExtensionSettings = {
  enabled: true,
  configFile: null,
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
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
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

async function configForFile(textDocument: TextDocument, settings): Promise<any> | never {
  if (settings.configFile !== null && settings.configFile.trim() !== "") {
    return readLocalConfig(settings.configFile);
  }
  return localeConfig(textDocument, connection);
}
async function checkConfig(config: any, lintHTML) {
  try {
    await lintHTML("", config.config);
  } catch (error) {
    return error;
  }
}

function printDiagnostics(issues: ILintHtmlIssue[], textDocument: TextDocument, lintHTML) {

  const diagnostics: Diagnostic[] = issues.map((issue: ILintHtmlIssue) => {
    return {
      severity: DiagnosticSeverity.Error,
      range: {
        start: Position.create(issue.line - 1, issue.column),
        end: Position.create(issue.line - 1, issue.column + 1)
      },
      code: issue.rule,
      source: "linthtml",
      message: issue.msg || lintHTML.messages.renderIssue(issue)
    };
  });
  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

async function lint(textDocument: TextDocument, config: any, lintHTML) {

  const filePath = Files.uriToFilePath(textDocument.uri);
  const text = textDocument.getText();
  try {
    const issues: ILintHtmlIssue[] = await lintHTML(text, config);
    printDiagnostics(issues, textDocument, lintHTML);
  } catch (error) {
    return connection.window.showErrorMessage(`linthtml: ${error.message} In file ${filePath}`);
  }
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings: IExtensionSettings = await getDocumentSettings(textDocument.uri);
  try {
    const lintHTML = await getLintHTML(textDocument, { connection, packageManager: settings.packageManager});

    let config = await configForFile(textDocument, settings);

    if (config !== null) {
      const error: Error = await checkConfig(config, lintHTML);
      if (error) {
        throw new Error(`${error.message}. Check your config file ${config.filepath}.`);
      }
      config = config.config;
    }

    return lint(textDocument, config, lintHTML);
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
