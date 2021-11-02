# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.3-beta.12] - 2021-11-02

## [0.0.3-beta.11] - 2021-11-01

## 0.0.3-beta.10 - 2021-11-01
### Added
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

[Unreleased]: https://github.com/superfaceai/testing-lib/compare/v0.0.3-beta.12...HEAD
[0.0.3-beta.12]: https://github.com/superfaceai/testing-lib/compare/v0.0.3-beta.11...v0.0.3-beta.12
[0.0.3-beta.11]: https://github.com/superfaceai/testing-lib/compare/v0.0.3-beta.10...v0.0.3-beta.11
