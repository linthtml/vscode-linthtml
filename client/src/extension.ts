'use strict';

import * as path from 'path';
import type { ExtensionContext, StatusBarItem } from 'vscode';
import {
  StatusBarAlignment,
  ThemeColor,
  window,
  window as Window,
  workspace,
} from 'vscode';
import type {
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node';
import {
  LanguageClient,
  ProgressType,
  RevealOutputChannelOn,
  SettingMonitor,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export class ServerState {
  status:
    | 'IDLE'
    | 'INIT'
    | 'VALIDATION_STARTED'
    | 'VALIDATION_OK'
    | 'VALIDATION_KO';
  document_checked?: string;
  error_message?: string;

  constructor(
    status:
      | 'IDLE'
      | 'INIT'
      | 'VALIDATION_STARTED'
      | 'VALIDATION_OK'
      | 'VALIDATION_KO' = 'IDLE',
    document_checked?: string,
  ) {
    this.status = status;
    this.document_checked = document_checked;
  }
}

const documentsServerState = new Map<string, ServerState>();

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js'),
  );
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { cwd: process.cwd() },
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6011'], cwd: process.cwd() },
    },
  };

  const clientOptions: LanguageClientOptions = {
    // Register the server for plain html documents
    documentSelector: [{ scheme: 'file', language: 'html' }],
    diagnosticCollectionName: 'linthtml',
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    synchronize: {
      configurationSection: 'linthtml',
      // Notify the server about file changes to '.linthtmlrc.* files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.linthtmlrc*'),
    },
    // progressOnInitialization: true,
    // middleware: {
    // 	executeCommand: async (command, args, next) => {
    // 		const selected = await Window.showQuickPick(['Visual Studio', 'Visual Studio Code']);
    // 		if (selected === undefined) {
    // 			return next(command, args);
    // 		}
    // 		args = args.slice(0);
    // 		args.push(selected);
    // 		return next(command, args);
    // 	}
    // }
  };
  const state = new ServerState();

  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);

  window.onDidChangeActiveTextEditor(
    (textEditor) => {
      if (state.status === 'IDLE' || state.status === 'INIT' || !textEditor) {
        statusBarItem.hide();
        return;
      }

      if (textEditor?.document.languageId !== 'html') {
        statusBarItem.hide();
        return;
      }

      const document_state = documentsServerState.get(
        textEditor?.document.uri.toString(),
      );
      if (document_state) {
        updateStatusBarItem(statusBarItem, document_state);
      }
    },
    null,
    context.subscriptions,
  );

  try {
    client = new LanguageClient(
      'linthtml',
      'LintHTML Language Server',
      serverOptions,
      clientOptions,
    );
    // Start the client. This will also launch the server
    // client.start();
    context.subscriptions.push(
      new SettingMonitor(client, 'linthtml.enable').start(),
    );
  } catch (_err) {
    Window.showErrorMessage(
      "The extension couldn't be started. See the output channel for details.",
    );
    return;
  }

  client.registerProposedFeatures();
  client.onProgress(
    new ProgressType<ServerState>(),
    'server-state',
    (new_state) => {
      // Does not means file has been tested
      state.status = new_state.status;
      state.document_checked = new_state.document_checked;
      state.error_message = new_state.error_message;

      if (new_state.status === 'INIT') {
        return;
      }

      documentsServerState.set(new_state.document_checked as string, new_state);

      updateStatusBarItem(statusBarItem, new_state);
    },
  );

  return state;
}

function updateStatusBarItem(statusBarItem: StatusBarItem, state: ServerState) {
  if (state.status === 'VALIDATION_STARTED') {
    statusBarItem.text = `$(loading~spin) LintHTML`;
    statusBarItem.backgroundColor = new ThemeColor('statusBar.background');
    statusBarItem.color = new ThemeColor('statusBar.foreground');
    statusBarItem.show();
  }
  if (state.status === 'VALIDATION_KO') {
    statusBarItem.text = `$(circle-slash) LintHTML`;
    statusBarItem.backgroundColor = new ThemeColor('statusBar.background');
    statusBarItem.color = new ThemeColor('statusBar.foreground');
    statusBarItem.tooltip = state.error_message;
    statusBarItem.show();
  }
  if (state.status === 'VALIDATION_OK') {
    statusBarItem.text = `$(check) LintHTML`;
    statusBarItem.backgroundColor = new ThemeColor('statusBar.background');
    statusBarItem.color = new ThemeColor('statusBar.foreground');
    statusBarItem.show();
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
