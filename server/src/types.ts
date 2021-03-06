// The example settings
interface IExtensionSettings {
  enabled: boolean;
  configFile?: string;
  packageManager: string;
}

enum Severity {
  ERROR = "error",
  WARNING = "warning"
}

interface Range {
  start: {
    line: number;
    column: number;
  }
  end: {
    line: number;
    column: number;
  }
}

interface ILintHtmlIssue {
  code: string;

  column?: number;
  line?: number;
  position?: Range

  rule: string;
  msg: string;
  severity?: Severity;
}

interface Linter {
  lint(html :string) :ILintHtmlIssue[];
}

export { IExtensionSettings, ILintHtmlIssue, Linter };
