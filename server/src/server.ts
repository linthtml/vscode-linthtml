import type {
  CompletionItem,
  Diagnostic,
  InitializeParams,
} from 'vscode-languageserver';
import {
  createConnection,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  Position,
  ProgressType,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  Files,
} from 'vscode-languageserver';
import {
  Severity,
  type IExtensionSettings,
  type ILintHtmlIssue,
  type Linter,
} from './types';
import type { LintHTML_LIKE } from './vscode-linthtml/get-linthtml';
import { getLintHTML } from './vscode-linthtml/get-linthtml';
import { localeConfig, readLocalConfig } from './vscode-linthtml/local-config';
import type { Range } from 'vscode-languageserver-textdocument';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import type { CosmiconfigResult } from 'cosmiconfig';

type LEGACY_LINTHTML = (
  content: string,
  config: unknown,
) => Promise<ILintHtmlIssue>;

// Create a connection for the server. The connection uses Node"s IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let hasDiagnosticRelatedInformationCapability = false;

class ServerState {
  document_checked: string | undefined;
  is_document_checked = false;
}

function send_state(state: ServerState) {
  connection.sendProgress(
    new ProgressType<ServerState>(),
    'server-state',
    state,
  ); // Works but cannot be used to check file has been checked
}

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Full,
      },
      // Tell the client that the server supports code completion
      completionProvider: {
        // resolveProvider: true
      },
    },
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined,
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((/*event*/) => {
      connection.console.log('Workspace folder change event received.');
    });
  }
  send_state(new ServerState());
});

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: IExtensionSettings = {
  enabled: true,
  configFile: undefined,
  packageManager: 'npm',
};

let globalSettings: IExtensionSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<IExtensionSettings>> = new Map();
connection.onDidChangeConfiguration(({ settings }) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    globalSettings = (settings.linthtml ||
      defaultSettings) as IExtensionSettings;
  }

  // Revalidate all open text documents
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  documents.all().forEach(validateTextDocument);
});

// Only keep settings for open documents
documents.onDidClose((/*e*/) => {
  // documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      section: 'linthtml',
    });
    documentSettings.set(resource, result);
  }
  return result;
}

async function configForFile(textDocument: TextDocument, configFile?: string) {
  if (configFile && configFile.trim() !== '') {
    return readLocalConfig(configFile);
  }
  return localeConfig(textDocument, connection);
}

async function checkConfig(
  config: CosmiconfigResult,
  lintHTML: LEGACY_LINTHTML,
) {
  try {
    await lintHTML('', config?.config);
  } catch (error) {
    return error;
  }
}

function generateSeverity(issue: ILintHtmlIssue) {
  return issue.severity === Severity.WARNING
    ? DiagnosticSeverity.Warning
    : DiagnosticSeverity.Error;
}

function generateDiagnosticPosition(issue: ILintHtmlIssue): Range {
  if (issue.position) {
    const { start, end } = issue.position;
    return {
      start: Position.create(start.line - 1, start.column - 1),
      end: Position.create(end.line - 1, end.column - 1),
    };
  }

  return {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    start: Position.create(issue.line - 1, issue.column),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    end: Position.create(issue.line - 1, issue.column + 1),
  };
}

function printDiagnostics(
  issues: ILintHtmlIssue[],
  textDocument: TextDocument,
  lintHTML: LintHTML_LIKE,
) {
  const diagnostics: Diagnostic[] = issues.map((issue: ILintHtmlIssue) => {
    return {
      severity: generateSeverity(issue),
      range: generateDiagnosticPosition(issue),
      code: issue.rule,
      source: 'linthtml',
      message: issue.msg || lintHTML.messages.renderIssue(issue),
    };
  });
  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

async function lint(
  textDocument: TextDocument,
  linter: Linter,
  lintHTML: LintHTML_LIKE,
) {
  const text = textDocument.getText();
  try {
    const issues: ILintHtmlIssue[] = await linter.lint(text);

    const state = new ServerState();
    state.document_checked = Files.uriToFilePath(textDocument.uri);
    state.is_document_checked = true;
    send_state(state);

    printDiagnostics(issues, textDocument, lintHTML);
  } catch (error) {
    return connection.window.showErrorMessage(
      `linthtml: ${(error as Error).message} In file ${URI.parse(textDocument.uri).fsPath}`,
    );
  }
}

async function createLinter(
  textDocument: TextDocument,
  { configFile }: IExtensionSettings,
  lintHTML: LintHTML_LIKE,
): Promise<Linter | undefined> {
  // VSCODE extension already create a linter per file correctly
  // globby/node-ignorer don't accept absolute and relative paths with ../..
  if (lintHTML.create_linters_for_files) {
    if (configFile && configFile.trim() !== '') {
      return lintHTML.from_config_path(configFile);
    }

    // need to send file path relative to vscode folder and not workspace folder
    let path = URI.parse(textDocument.uri).fsPath;
    if (/^[a-z]:\\/i.test(path)) {
      // convert "\" in "/" in windows path
      path = path.replace(/\\/g, '/');
    }

    const [{ linter }] = await lintHTML.create_linters_for_files([path], null);
    return linter;
  }

  let config = await configForFile(textDocument, configFile);

  if (config !== null) {
    const error = await checkConfig(
      config,
      lintHTML as unknown as LEGACY_LINTHTML,
    );
    if (error) {
      throw new Error(
        `${(error as Error).message}. Check your config file ${config.filepath}.`,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    config = config.config;
  }

  if (!lintHTML.fromConfig) {
    connection.window.showErrorMessage(
      "LintHTML extension does not support lintHTML's versions below the version 0.3.0",
    );
    return;
  }

  return lintHTML.fromConfig(config);
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings: IExtensionSettings = await getDocumentSettings(
    textDocument.uri,
  );
  try {
    const lintHTML = await getLintHTML(textDocument, {
      connection,
      packageManager: settings.packageManager,
    });

    const linter = await createLinter(textDocument, settings, lintHTML);

    if (linter) {
      return lint(textDocument, linter, lintHTML);
    }
    return;
  } catch (error) {
    return connection.window.showErrorMessage(
      `linthtml: ${(error as Error).message}`,
    );
  }
}

connection.onDidChangeWatchedFiles((/*change*/) => {
  // changes globalConfig
  // need to load config once before ^^
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  documents.all().forEach((file) => validateTextDocument(file));
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
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
  },
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
  const state = new ServerState();
  state.document_checked = Files.uriToFilePath(params.textDocument.uri);
  send_state(state);
  // A text document got opened in VSCode.
  // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
  // params.text the initial full content of the document.
  connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
  // The content of a text document did change in VSCode.
  // params.uri uniquely identifies the document.
  // params.contentChanges describe the content changes to the document.
  const state = new ServerState();
  state.document_checked = params.textDocument.uri;
  send_state(state);
  connection.console.log(
    `${params.textDocument.uri} changed: ${JSON.stringify(
      params.contentChanges,
    )}`,
  );
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
