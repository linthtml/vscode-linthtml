// The example settings
interface IExtensionSettings {
  enabled: boolean;
  configFile: string|null;
  packageManager: string;
}

enum Severity {
  ERROR = "error",
  WARNING = "warning"
}

interface ILintHtmlIssue {
  code: string;
  column: number;
  line: number;

  rule: string;
  msg: string;
  severity?: Severity;
}

export { IExtensionSettings, ILintHtmlIssue };
