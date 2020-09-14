// /* --------------------------------------------------------------------------------------------
// * Copyright (c) Microsoft Corporation. All rights reserved.
// * Licensed under the MIT License. See License.txt in the project root for license information.
// * ------------------------------------------------------------------------------------------ */

// import * as assert from "assert";
// import * as vscode from "vscode";
// import { activate, getDocUri } from "./helper";

// describe("Should get diagnostics", () => {

//   // it('Should use linthtml default rules', async () => {
//   //   const docUri = getDocUri('diagnostics.html');
//   //   await testDiagnostics(docUri, [
//   //     { code: 'indent-style', range: toRange(3, 1, 3, 2), severity: vscode.DiagnosticSeverity.Error, source: 'linthtml', message: '' },
//   //     { code: 'indent-style', range: toRange(8, 1, 8, 2), severity: vscode.DiagnosticSeverity.Error, source: 'linthtml', message: '' },
//   //     { code: 'indent-style', range: toRange(9, 1, 9, 2), severity: vscode.DiagnosticSeverity.Error, source: 'linthtml', message: '' },
//   //     { code: 'indent-style', range: toRange(11, 1, 11, 2), severity: vscode.DiagnosticSeverity.Error, source: 'linthtml', message: '' }
//   //   ]);
//   // });

//   it("Should use config htmlint rules using local .linthtmlrc file", async () => {
//     const docUri = getDocUri("with-config-file/diagnostics.html");
//     await testDiagnostics(docUri, [
//     ]);

//   });
// });

// function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
//   const start = new vscode.Position(sLine, sChar);
//   const end = new vscode.Position(eLine, eChar);
//   return new vscode.Range(start, end);
// }

// async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
//   await activate(docUri);

//   const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

//   assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

//   expectedDiagnostics.forEach((expectedDiagnostic, i) => {
//     const actualDiagnostic = actualDiagnostics[i];
//     assert.equal(actualDiagnostic.code, expectedDiagnostic.code);
//     assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
//     assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
//   });
// }
