# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- `@superfaceai/one-sdk` peer dependency from `v2.0` to `v2.2`

## [3.0.0] - 2022-12-07
### Added
- New parameter `recordingType` in method `run()` to differentiate between prepare, teardown or main test run
- New dev and peer dependency - Superface Parser [v1.2.0](https://github.com/superfaceai/parser/releases/tag/v1.2.0)
- New module for preparing files necessary for `perform` (SuperJson, ProfileAST, MapAST, ProviderJson)
- New module for mocking necessary files for `perform`
- Support hiding of credentials used with new security scheme Digest
- New parameter `fullError` in method `run()` to enable returning whole `PerformError` instead of string
- New static function `report` in `SuperfaceTest` to report found provider changes
- Module `matcher` for comparing old and new HTTP traffic
- Module `analyzer` for determining impact of provider changes
- Module `reporter` for reporting provider changes throughout tests
- Class `ErrorCollector` for collecting errors in `matcher`
- Environment variable `UPDATE_TRAFFIC` to replace old traffic with new, if present
- Environment variable `DISABLE_PROVIDER_CHANGES_COVERAGE` to disable collecting of test reports
- Environment variable `USE_NEW_TRAFFIC` to test with newly recorded traffic
- Environment variable `DECODE_RESPONSE` to save recordings with decoded response next to original one
- Errors for module `matcher`
- Error `CoverageFileNotFoundError` for correct reporting

### Changed
- **BREAKING CHANGE:** Recording fixtures are grouped by test file or provider
- **BREAKING CHANGE:** Recording fixtures are stored next to test file OR in `<project-dir>/recordings/<profile>/<provider>.recording.json`
- **BREAKING CHANGE:** Updated One-SDK to [v2.0.0](https://github.com/superfaceai/one-sdk-js/releases/tag/v2.0.0)
- **BREAKING CHANGE:** Use `BoundProfileProvider` instead of using client and use-case to run `perform` -> Local use only
- Move functions used for recording in `SuperfaceTest` to seperate module
- Use `SecurityConfiguration` (containing merged `SecurityValue` and `SecurityScheme` interfaces) instead of using them separately
- Move parameter `testInstance` from superface components to second parameter in constructor
- Return value from method `run` to `PerformError | string`
- Does not overwrite HTTP traffic recording when in record mode, instead save new one next to old one with suffix `-new`

### Removed
- Parameter `client` from constructor and method `run`
- Function for omitting timestamp from perform error `removeTimestamp`

## [2.0.3] - 2022-02-15
### Changed
- Updated One-SDK to [v1.3.0](https://github.com/superfaceai/one-sdk-js/releases/tag/v1.3.0) and AST to [v1.1.0](https://github.com/superfaceai/ast-js/releases/tag/v1.1.0)

## [2.0.1] - 2022-02-14
### Fixed
- Passing jest test instance into `beforeAll()` generates hash based on `currentTestName`, not specified input

## [2.0.0] - 2022-01-17
### Added
- Debug logging throughout the library
- Warning about sensitive information before they're written
- Hiding of credentials and parameters located in rawHeaders or in response.
- New parameter `hideInput` in method `run()` for hiding primitive `input` values in recordings
- New parameter `testName` in method `run()` for hashing recording files
- New parameter `testInstance` in constructor for pluging in instance of used test framework

### Changed
- Format of placeholders for sensitive information in recordings
- Hash of recording is based on parameters in following priority: `testName` -> `testInstance` -> `input`

### Fixed
- Check for profile provider in super.json now does not expect defined profile

## 1.0.0 - 2021-11-05
### Added
- Hiding integration parameters in headers, body, baseUrl, path and query
- Hashing input for unique name of recording files
- Rewrap perform result to Result<unknown, string>
- One-SDK to peerDependencies and devDependencies
- Warning about sensitive informations in recordings
- New parameter for method `run()` for keeping credentials in recordings
- New parameter for method `run()` for custom pre/post-processing functions for recordings
- Functions to process credentials in recordings
- AST dependency for provider.json and super.json types
- Parsing of `SUPERFACE_LIVE_API` env variable and its wildcards
- Check for local map in super.json
- Method `run()` into `SuperfaceTest` class
- Constructor for `SuperfaceTest` with optional `sfConfig` and `nockConfig`
- Modules for io, formatting and errors.
- SuperfaceTest class

[Unreleased]: https://github.com/superfaceai/testing/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/superfaceai/testing/compare/v2.0.3...v3.0.0
[2.0.3]: https://github.com/superfaceai/testing/compare/v2.0.1...v2.0.3
[2.0.1]: https://github.com/superfaceai/testing/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/superfaceai/testing/compare/v1.0.0...v2.0.0
