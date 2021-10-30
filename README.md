# Superface Testing Library

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/superfaceai/testing-lib/CI)
![NPM](https://img.shields.io/npm/v/@superfaceai/testing-lib)
[![NPM](https://img.shields.io/npm/l/@superfaceai/testing-lib)](LICENSE)
![TypeScript](https://img.shields.io/badge/%3C%2F%3E-Typescript-blue)

<img src="https://github.com/superfaceai/testing-lib/blob/main/docs/LogoGreen.png" alt="superface logo" width="150" height="150">

This library enables easy testing of Superface capabilities with `SuperfaceTest` class.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Recording traffic](#recording)
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
npm install -D @superfaceai/testing-lib
# yarn users
yarn add -D @superfaceai/testing-lib
```

## Usage

To test Superface capabilities, initialize a new `SuperfaceTest` instance and call its method `run()` with superface configuration.

Superface configuration should contain `profile`, `provider` and `useCase`. You can enter them either in string format (as ids of corresponding components) or as instances of corresponding components. Along side profile, provider and usecase, you can also enter your `SuperfaceClient` instance. (More about Superface client [here](https://github.com/superfaceai/one-sdk-js#initializing-the-onesdk-client))

```typescript
import { SuperfaceClient } from '@superfaceai/one-sdk';
import { SuperfaceTest } from '@superfaceai/testing-lib';

const client = new SuperfaceClient();
const superface = new SuperfaceTest({
  client,
  profile: 'profile',
  provider: 'provider',
  useCase: 'useCase',
});
```

### Initializing SuperfaceTest instance

```typescript
import { SuperfaceTest } from '@superfaceai/testing-lib';
```

without any arguments:

```typescript
const superface = new SuperfaceTest();
```

with superface configuration:

```typescript
const client = new SuperfaceClient();
const profile = await client.getProfile('profile');
const provider = await client.getProvider('provider');
const useCase = await profile.getUseCase('useCase');

const superface = new SuperfaceTest({
  client,
  profile,
  provider,
  useCase,
});
```

with superface and nock configuration:

```typescript
const superface = new SuperfaceTest(
  {
    profile: 'profile',
    provider: 'provider',
    useCase: 'useCase',
  },
  {
    path: 'nock-recordings',
    fixture: 'my-recording',
    enableReqheadersRecording: true,
  }
);
```

Given superface configuration is stored in class and used later in `run()` method. You can also pass in instance of `SuperfaceClient`, but it is not required as it gets initialized inside library if not provided.

Given nock configuration is also stored in class. Property `path` and `fixture` is used to configure location of recordings and property `enableReqheadersRecording` is used to enable/disable recording of request headers (This is turned off by default).

### Running

To test your capabilities, use method `run()`, which encapsulates nock recording and usecase perform. It expects superface configuration (similar to initializing `SuperfaceTest` class) and input. You don't need to specify profile, provider or useCase if you already specified them when initializing `SuperfaceTest` class.

```typescript
import { SuperfaceTest } from '@superfaceai/testing-lib';

const superface = new SuperfaceTest({
  profile: 'profile',
  provider: 'provider',
  useCase: 'useCase',
});

superface.run({
  input: {
    some: 'input',
  },
});
```

Example with jest:

```typescript
import { SuperfaceTest } from '@superfaceai/testing-lib';

describe('test', () => {
  let superface: SuperfaceTest;

  afterEach(() => {
    superface = new SuperfaceTest();
  });

  it('performs corretly', async () => {
    await expect(
      superface.run({
        profile: 'profile',
        provider: 'provider',
        useCase: 'useCase',
        input: {
          some: 'input',
        },
      })
    ).resolves.toMatchSnapshot();
  });
});
```

Method `run()` will transform all components that are represented by string to corresponding instances, check whether map is locally present based on super.json, loads recording or starts recording, runs perform for given usecase, ends the recording and returns **result** or **error** value from perform.

You can then use this return value to test your capabilities (We recommend you to use jest [snapshot testing](https://jestjs.io/docs/snapshot-testing) as seen in example above).

### Recording

Testing library will decide to record HTTP traffic based on environmental variable `SUPERFACE_LIVE_API` and current superface configuration.

Its format is: `<profile>:<provider>:<usecase>` where each component is separated by `:` and can start or/and end with wildcard `*`.

For example in method `run()` bellow, to record HTTP traffic, `SUPERFACE_LIVE_API` has to be one of following:

- `profile:provider:useCase`
- `*` or `*:*:*`
- `*:*:useCase`
- `*:provider`

```typescript
superface.run({
  profile: 'profile',
  provider: 'provider',
  useCase: 'useCase',
  input: {
    some: 'input',
  },
});
```

## Support

If you need any additional support, have any questions or you just want to talk you can do that through our [support page](https://superface.ai/support).

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
