# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/superfaceai/testing/compare/v2.0.3...HEAD
[2.0.3]: https://github.com/superfaceai/testing/compare/v2.0.1...v2.0.3
[2.0.1]: https://github.com/superfaceai/testing/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/superfaceai/testing/compare/v1.0.0...v2.0.0
