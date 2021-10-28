# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- One-SDK to peerDependencies and devDependencies
- Warning about sensitive information in recordings
- New parameter for method `run()` to enable keeping original recordings
- AST dependency for provider.json and super.json types
- Export types for nock recording definitions and recording scopes
- Restore recordings before throwing error from perform
- New parameter for method `run()` function to enable using custom pre/post-processing functions
- Functions to pre/post-process recordings
- Parsing of `SUPERFACE_LIVE_API` env variable and it's wildcards
- Check for local map in super.json
- Merge function `test()` and `run()` into `run()`
- Constructor for `SuperfaceTest` with optional `sfConfig` and `nockConfig`
- SuperfaceTest class
- Modules for io, formatting and errors.

[Unreleased]: https://github.com/superfaceai/testing-lib/compare/v0.0.3-beta.9...HEAD
