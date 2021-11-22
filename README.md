# Superface Testing Library

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/superfaceai/testing/CI)
![NPM](https://img.shields.io/npm/v/@superfaceai/testing)
[![NPM](https://img.shields.io/npm/l/@superfaceai/testing)](LICENSE)
![TypeScript](https://img.shields.io/badge/%3C%2F%3E-Typescript-blue)

<img src="https://github.com/superfaceai/testing/blob/main/docs/LogoGreen.png" alt="superface logo" width="150" height="150">

This library enables easy testing of local Superface capabilities with `SuperfaceTest` class. It uses these capabilities either with live HTTP traffic or with recorded traffic (More about recording HTTP traffic in section [recording](#recording)).

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
npm install -D @superfaceai/testing
# yarn users
yarn add -D @superfaceai/testing
```

## Usage

To test Superface capabilities, initialize a new `SuperfaceTest` instance and call its method `run()` with test configuration and input specific for your test run. Test configuration should contain `profile`, `provider` and `useCase`. You can enter them either in string format (as ids of corresponding components) or as instances of corresponding components (more about them in [One-SDK docs](https://github.com/superfaceai/one-sdk-js#using-the-onesdk) or in [Comlink reference](https://superface.ai/docs/comlink)).

### Initializing SuperfaceTest instance

```typescript
import { SuperfaceTest } from '@superfaceai/testing';
```

**without any arguments:**

```typescript
const superface = new SuperfaceTest();
```

**with superface configuration:**

```typescript
const profile = await client.getProfile('profile');
const provider = await client.getProvider('provider');
const useCase = await profile.getUseCase('useCase');

const superface = new SuperfaceTest({
  profile,
  provider,
  useCase,
});
```

Given test configuration is stored in class and used later in `run()` method.

**with superface and nock configuration:**

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

Given nock configuration is also stored in class. Property `path` and `fixture` is used to configure location of recordings and property `enableReqheadersRecording` is used to enable/disable recording of request headers (This is turned off by default).

### Running

To test your capabilities, use method `run()`, which encapsulates nock recording and UseCase perform. It expects test configuration (similar to initializing `SuperfaceTest` class) and input. You don't need to specify `profile`, `provider` or `useCase` if you already specified them when initializing `SuperfaceTest` class.

```typescript
import { SuperfaceTest } from '@superfaceai/testing';

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
import { SuperfaceTest } from '@superfaceai/testing';

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

Method `run()` will initialize Superface client, transform all components that are represented by string to corresponding instances, check whether map is locally present based on super.json, runs perform for given usecase and returns **result** or **error** value from perform (More about perform in [One-SDK docs](https://github.com/superfaceai/one-sdk-js#performing-the-use-case)).

You can then use this return value to test your capabilities (We recommend you to use jest [snapshot testing](https://jestjs.io/docs/snapshot-testing) as seen in example above).

### Recording

Method `run()` also records HTTP traffic with `nock` library during UseCase perform and saves recorded traffic to json file. Before perform, library will decide to record HTTP traffic based on environmental variable `SUPERFACE_LIVE_API` and current test configuration.

Variable `SUPERFACE_LIVE_API` specifies configuration which needs to be matched to record HTTP traffic.

Its format is: `<profile>:<provider>:<UseCase>` where each component is optional and separated by `:`. It can start or/and end with wildcard `*`.

It will be then compared to current test configuration and start recording if they match.

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

Testing library process recordings to hide sensitive information that might get recorded based on security schemes and integration parameters from provider.json and super.json. To turn this off, specify boolean `processRecordings` in second parameter for method `run()`:

```typescript
superface.run(
  {
    profile: 'profile',
    provider: 'provider',
    useCase: 'useCase',
    input: {
      some: 'input',
    },
  },
  {
    processRecordings: false,
  }
);
```

You can enter your own processing functions along side `processRecordings` parameter. Both have same function signature and are called either before load or before save of recordings.

```typescript
import { RecordingDefinitions, SuperfaceTest } from '@superfaceai/testing';

const beforeRecordingLoad = (definitions: RecordingDefinitions) => {
  definitions.forEach(def => {
    def.path = def.path.replace('PLACEHOLDER', process.env.YOUR_SECRET);
  });
};

const beforeRecordingSave = (definitions: RecordingDefinitions) => {
  definitions.forEach(def => {
    def.path = def.path.replace(process.env.YOUR_SECRET, 'PLACEHOLDER');
  });
};

const superface = new SuperfaceTest();

superface.run(
  {
    profile: 'profile',
    provider: 'provider',
    useCase: 'useCase',
    input: {
      some: 'input',
    },
  },
  {
    processRecordings: false,
    beforeRecordingSave,
    beforeRecordingLoad,
  }
);
```

## Debug

You can use enviroment variable `DEBUG` to enable logging throughout testing process.

`DEBUG="superface:testing*"` will enable all logging

`DEBUG="superface:testing"` will enable logging in `SuperfaceTest` class, its methods and utility functions

`DEBUG="superface:testing:recordings"` will enable logging of processing sensitive information in recordings

`DEBUG="superface:testing:recordings*"` or `DEBUG="superface:testing:recordings:sensitive"` will enable logging of replacing actual credentials

## Known Limitations

### Multiple matching requests for the same use case

Recordings make it possible to run tests without calling the live API. This works by trying to match a request to the requests in the existing recordings. If a match is found, the recorded response is returned. However, since the testing client saves recording for each test run in a single file, it means multiple matching requests for the same use-case and input will overwrite each other.

A workaround is to use different inputs for each each test.

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
