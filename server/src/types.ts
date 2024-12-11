type ValueOf<
  ObjectType,
  ValueType extends keyof ObjectType = keyof ObjectType,
> = ObjectType[ValueType];

// The example settings
interface IExtensionSettings {
  enabled: boolean;
  configFile?: string;
  packageManager: string;
}

export const Severity = {
  ERROR: 'error',
  WARNING: 'warning',
};

interface Range {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

interface ILintHtmlIssue {
  code: string;

  column?: number;
  line?: number;
  position?: Range;

  rule: string;
  msg: string;
  severity?: ValueOf<typeof Severity>;
}

interface Linter {
  lint(html: string): Promise<ILintHtmlIssue[]>;
}

export { IExtensionSettings, ILintHtmlIssue, Linter };
