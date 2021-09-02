# Superface Testing Library _(testing-lib)_
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/superfaceai/testing-lib/CI)
![NPM](https://img.shields.io/npm/v/@superfaceai/testing-lib)
[![NPM](https://img.shields.io/npm/l/@superfaceai/testing-lib)](LICENSE)
![TypeScript](https://img.shields.io/badge/%3C%2F%3E-Typescript-blue)

<img src="https://github.com/superfaceai/testing-lib/blob/main/docs/LogoGreen.png" alt="superface logo" width="150" height="150">

This library enables easy testing of Superface capabilities with exported class `TestConfig` and its methods. It offers methods for recording traffic or methods for testing and running Superface.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Support](#support)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [Licensing](#licensing)
- [License](#license)

## Background

Superface (super-interface) is a higher-order API, an abstraction on top of the modern APIs like GraphQL and REST. Superface is one interface to discover, connect, and query any capabilities available via conventional APIs. 

Through its focus on application-level semantics, Superface decouples the clients from servers, enabling fully autonomous evolution. As such it minimizes the code base as well as errors and downtimes while providing unmatched resiliency and redundancy. 

Superface allows for switching capability providers without development at a runtime in milliseconds. Furthermore, Superface decentralizes the composition and aggregation, and thus creates an Autonomous Integration Mesh.

Motivation behind Superface is nicely described in this [video](https://www.youtube.com/watch?v=BCvq3NXFb94) from APIdays conference.

You can get more information at https://superface.ai and https://docs.superface.ai/.

## Install

To install the package, run in the project directory:

```
# npm users
npm install @superfaceai/testing-lib
# yarn users
yarn add @superfaceai/testing-lib
```

## Usage

<!-- TODO: modify guide link when guide merged -->

To know more about using our testing library in your tests, you can read through our guide [Test Capability](https://superface.ai/docs/guides/run-and-test).

## Support

If you need any additional support, have any questions or you just want to talk you can do that through our [documentation page](https://docs.superface.ai). 

## Maintainers

- [@Martin Albert](https://github.com/martinalbert)

## Contributing

**Please open an issue first if you want to make larger changes**

Feel free to contribute! Please follow the [Contribution Guide](CONTRIBUTION_GUIDE.md).

## Licensing

Licenses of `node_modules` are checked during push CI/CD for every commit. Only the following licenses are allowed:

- 0BDS
- MIT
- Apache-2.0
- ISC
- BSD-3-Clause
- BSD-2-Clause
- CC-BY-4.0
- CC-BY-3.0;BSD
- CC0-1.0
- Unlicense

## License

The Superface Testing Library is licensed under the [MIT](LICENSE).
© 2021 Superface
