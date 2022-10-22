import { describe, it } from "mocha";
import { assert } from "chai";

import * as vscode from "vscode";
import { activate, getDocUri } from "./helper";

describe("Should get diagnostics", () => {
  it("Should use linthtml default presets when no config file is found", async function () {
    this.timeout(10000);
    const docUri = getDocUri("diagnostics.html");
    await testDiagnostics(docUri, [
      {
        code: "indent-style",
        range: toRange(2, 2, 7, 9),
        severity: vscode.DiagnosticSeverity.Error,
        source: "linthtml",
        message: "",
      },
      {
        code: "indent-style",
        range: toRange(3, 4, 3, 26),
        severity: vscode.DiagnosticSeverity.Error,
        source: "linthtml",
        message: "",
      },
      {
        code: "indent-style",
        range: toRange(4, 4, 4, 74),
        severity: vscode.DiagnosticSeverity.Error,
        source: "linthtml",
        message: "",
      },
      {
        code: "indent-style",
        range: toRange(5, 4, 5, 57),
        severity: vscode.DiagnosticSeverity.Error,
        source: "linthtml",
        message: "",
      },
      {
        code: "indent-style",
        range: toRange(6, 4, 6, 27),
        severity: vscode.DiagnosticSeverity.Error,
        source: "linthtml",
        message: "",
      },
      {
        code: "indent-style",
        range: toRange(8, 2, 10, 9),
        severity: vscode.DiagnosticSeverity.Error,
        source: "linthtml",
        message: "",
      },
      {
        code: "indent-style",
        range: toRange(9, 4, 9, 230),
        severity: vscode.DiagnosticSeverity.Error,
        source: "linthtml",
        message: "",
      },
    ]);
  });

  it("Should use config htmlint rules using local .linthtmlrc file (ok file)", async function () {
    this.timeout(10000);
    const docUri = getDocUri("with-config-file/diagnostics_ok.html");
    await testDiagnostics(docUri, []); // there're no lint issues in the document
  });

  it("Should use config htmlint rules using local .linthtmlrc file (ko file)", async function () {
    this.timeout(10000);
    const docUri = getDocUri("with-config-file/diagnostics_ko.html");
    await testDiagnostics(docUri, [
      {
        code: "indent-width",
        range: toRange(9, 6, 9, 232),
        severity: vscode.DiagnosticSeverity.Error,
        source: "linthtml",
        message: "",
      },
    ]);
  });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine, sChar);
  const end = new vscode.Position(eLine, eChar);
  return new vscode.Range(start, end);
}

async function testDiagnostics(
  docUri: vscode.Uri,
  expectedDiagnostics: vscode.Diagnostic[]
) {
  await activate(docUri);

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);
  assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i];
    assert.equal(actualDiagnostic.code, expectedDiagnostic.code);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
  });
}
