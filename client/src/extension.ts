/* --------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
* ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import { ExtensionContext, window as Window, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions, SettingMonitor, TransportKind } from 'vscode-languageclient';

let client: LanguageClient;
export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc, options: { cwd: process.cwd() } },
    debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ['--nolazy', '--inspect=6011'], cwd: process.cwd() } }
  };

  let clientOptions: LanguageClientOptions = {
    // Register the server for plain html documents
    documentSelector: [{ scheme: 'file', language: 'html' }],
    diagnosticCollectionName: 'linthtml',
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    synchronize: {
      configurationSection: "linthtml",
      // Notify the server about file changes to '.linthtmlrc.* files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.linthtmlrc*")
    }
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

  try {
    client = new LanguageClient(
      "linthtml",
      "LintHTML Language Server",
      serverOptions,
      clientOptions
    );
    // Start the client. This will also launch the server
    // client.start();
    context.subscriptions.push(new SettingMonitor(client, "linthtml.enable").start());
  } catch (err) {
    Window.showErrorMessage(`The extension couldn't be started. See the output channel for details.`);
    return;
  }
  client.registerProposedFeatures();

  context.subscriptions.push(
    client.start(),
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}