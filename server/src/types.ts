// The example settings
interface IExtensionSettings {
  enabled: boolean;
  configFile: string|null;
  packageManager: string|null;
}

interface ILintHtmlIssue {
  code: string;
  column: number;
  line: number;

  rule: string;
  msg: string;
}

export { IExtensionSettings, ILintHtmlIssue };
