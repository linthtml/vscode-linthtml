# vscode-linthtml

[![Build Status](https://travis-ci.org/KamiKillertO/vscode-linthtml.svg?branch=master)](https://travis-ci.org/KamiKillertO/vscode-linthtml)

A [Visual Studio Code extension](https://code.visualstudio.com/) to lint [HTML](https://www.w3.org/WebPlatform/WG/PubStatus#HTML_specifications) with [linthtml](https://github.com/linthtml/linthtml).

![screenshot](screenshot.png)
_If you find some error message not explicit enough, please create an issue [here](https://github.com/KamiKillertO/vscode-linthtml/issues)_

## Installation

1. Execute `Extensions: Install Extensions` command from [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette).
2. Type `@sort:installs linthtml` into the search form and install the topmost one.

Read the [extension installation guide](https://code.visualstudio.com/docs/editor/extension-gallery) for more details.

## Usage

This extension automatically validates documents with these [language identifiers](https://code.visualstudio.com/docs/languages/overview#_language-id):

* HTML (`html`)

If you have a valid hmllint configuration file `.linthtmlrc` (all options available [here](https://github.com/linthtml/linthtml/wiki/Options)) in the current workspace folder the extension will use it. Otherwise, the default configuration of linthtml will be used.

## Extension settings

#### linthtml.enable

Type: `boolean`  
Default: `true`

Control whether this extension is enabled or not.

### linthtml.configFile

Type: `string`
Default: `null`

Specified the path to a config file for LintHTML that will be used to lint all HTML files in the current workspace.

## License

[APACHE 2.0 License](./LICENSE.txt)
