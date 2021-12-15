# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Debug logging throughout the library
- Warning about sensitive information before they're written
- Hiding of credentials and parameters located in rawHeaders or in response.

### Changed
- Format of placeholders for sensitive information in recordings

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

[Unreleased]: https://github.com/superfaceai/testing/compare/v1.0.0...HEAD
