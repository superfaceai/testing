# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 0.0.3-beta.9 - 2021-10-22
### Added
- One-SDK to peerDependencies and devDependencies
- Warning about sensitive information in recordings
- New parameter for method `run()` to enable keeping original recordings
- Mock of Superface components to be used across tests
- AST dependency for provider.json and super.json types
- Export types for nock recording definitions and recording scopes
- New parameter for method `run()` function to enable using custom pre/post-processing functions
- Functions to pre/post-process recordings
- Parsing of `SUPERFACE_LIVE_API` env variable and it's wildcards
- SuperfaceTest class
- Modules for io, formatting and errors.

### Changed
- **BREAKING CHANGE**: Rename `before` and `after` processing functions to `afterRecordingLoad` and `beforeRecordingSave`
- **BREAKING CHANGE**: Rename class `TestConfig` to `SuperfaceTest`
- **BREAKING CHANGE**: Merge function `test()` and `run()`
- Error when recording file contains no recordings to warning because of maps with no HTTP calls
- Add new lines to error messages
- `sfConfig` in constructor to optional
- Require only local map in super.json

### Removed
- nock.back support
- Check for local provider.json

### Fixed
- Regex in `loadCredentials` for filtering query parameters
- Process recording path from URL variable correctly
- Restore recordings before throwing error from perform

[Unreleased]: https://github.com/superfaceai/testing-lib/compare/v0.0.3-beta.9...HEAD
