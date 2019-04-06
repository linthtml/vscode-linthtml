/* --------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
* ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  SettingMonitor
} from 'vscode-languageclient';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js')
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
		diagnosticCollectionName: 'linthtml',
    // Register the server for plain html documents
    documentSelector: [{ scheme: 'file', language: 'html' }],
    synchronize: {
      configurationSection: 'linthtml',
      // Notify the server about file changes to '.linthtmlrc.* files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.linthtmlrc.*')
    },
    middleware: {
      didOpen: (document, next) => {
        // debugger
        next(document);
      },
      didChange: (event, next) => {
        // debugger
        next(event);
      },
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'linthtml',
    'LintHTML Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  // client.start();
    // debugger
  context.subscriptions.push(new SettingMonitor(client, 'linthtml.enable').start());
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
