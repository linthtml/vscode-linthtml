# CHANGELOG

## [0.6.2]

- [FIX] Convert windows paths into linux like paths

## [0.6.0]

- [FEAT] Improve support for linthtml 0.5+.
  Now linthtml will correctly serach for configurations and fallback to the default preset if there's no configuration file.
- [FIX] Stop crashing for linthtml version <0.3 and display error message instead.

## [0.5.0]

- [FEAT] Add support for LintHTML0.5.0
- [INTERNAL] Use webpack to bundle extension

## [0.4.0]

- [FEAT] Display warning issues as warning

## [0.3.0]

- [FEAT] Use local/global @linthtml/linthtml package
- [FEAT] Stop including @linthtml/linthtml package in extension build

## [0.2.0]

- [FEAT] Upgrade to linthtml@0.2.0
- [FEAT] Replay linthtml's errors as errors notification

## [0.1.0]

- First release
- Display linthtml errors
- Auto load of `.linthtmlrc.*` files
