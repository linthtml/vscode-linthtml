// import * as assert from "assert";
// import * as vscode from "vscode";
// import { activate, getDocUri } from "./helper";

// describe("Should do completion", () => {
//   const docUri = getDocUri("completion.html");

//   it("Completes JS/TS in txt file", async () => {
//     // await testCompletion(docUri, new vscode.Position(0, 0), {
//     //   items: [
//     //     { label: 'JavaScript', kind: vscode.CompletionItemKind.Text },
//     //     { label: 'TypeScript', kind: vscode.CompletionItemKind.Text }
//     //   ]
//     // });
//     assert.ok(true);
//   });
// });

// async function testCompletion(
//   docUri: vscode.Uri,
//   position: vscode.Position,
//   expectedCompletionList: vscode.CompletionList
// ) {
//   await activate(docUri);

//   // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
//   const actualCompletionList = (await vscode.commands.executeCommand(
//     "vscode.executeCompletionItemProvider",
//     docUri,
//     position
//   )) as vscode.CompletionList;
//   expectedCompletionList.items.forEach((expectedItem, i) => {
//     const actualItem = actualCompletionList.items[i];
//     assert.equal(actualItem.label, expectedItem.label);
//     assert.equal(actualItem.kind, expectedItem.kind);
//   });
// }
