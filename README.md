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
    testInstance: expect,
  }
);
```

Since it uses `nock` to record HTTP traffic during perform, second parameter in SuperfaceTest constructor is nock configuration containing `path` and `fixture` to configure location of recordings, property `enableReqheadersRecording` to enable/disable recording of request headers (This is turned off by default) and also property `testInstance` to enable testing library accessing current test names to generate unique hashes for recordings (currently supported only Jest and Mocha).

### Running

To test your capabilities, use method `run()`, which encapsulates `nock` recording and `BoundProfileProvider` perform. It expects test configuration (similar to initializing `SuperfaceTest` class) and input. You don't need to specify `profile`, `provider` or `useCase` if you already specified them when initializing `SuperfaceTest` class.

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

  beforeAll(() => {
    superface = new SuperfaceTest({
      profile: 'profile',
      provider: 'provider',
      useCase: 'useCase',
    });
  });

  it('performs corretly', async () => {
    await expect(
      superface.run({
        input: {
          some: 'input',
        },
      })
    ).resolves.toMatchSnapshot();
  });
});
```

Method `run()` initializes `BoundProfileProvider` class, runs perform for given usecase and returns **result** or **error** value from perform (More about perform in [One-SDK docs](https://github.com/superfaceai/one-sdk-js#performing-the-use-case)). Since testing library don't use `SuperfaceClient` anymore, it is **limited to local use only**.

[OneSDK 2.0](https://github.com/superfaceai/one-sdk-js/releases/tag/v2.0.0) does not contain parser anymore, so it looks for compiled files `.ast.json` next to original ones. To support this, parser was added to testing library and can be used to parse files when no AST is found.

Method `run` also have second parameter, containing parameters to setup processing of recordings described bellow in [Recording](#recording).
Only one parameter from this group processes result of method `run` and that is `fullError`. It enables method `run` to return full error from OneSDK instead of string.

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
    fullError: true,
  }
);
```

You can then use this return value to test your capabilities (We recommend you to use jest [snapshot testing](https://jestjs.io/docs/snapshot-testing) as seen in example above).

### Recording

Method `run()` also records HTTP traffic as we mentioned above and saves recorded traffic to json file. Before perform, library will decide to record HTTP traffic based on environmental variable `SUPERFACE_LIVE_API` and current test configuration.

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

To hide sensitive information that are passed in method `run()` as `input`, you can use parameter `hideInput` to point to primitive values which will get replaced in recording fixture.

```typescript
const pass = 'secret';

superface.run(
  {
    profile: 'profile',
    provider: 'provider',
    useCase: 'useCase',
    input: {
      auth: {
        username: 'user',
        password: pass,
      },
    },
  },
  {
    // value found have to be one of following: string, number or boolean
    hideInput: ['auth.value', 'auth.password'],
  }
);
```

You can also enter your own processing functions along side `processRecordings` parameter. Both have same function signature and are called either before load or before save of recordings (see [this sequence diagram](./docs/sequence_diagram.png))

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

If you want to differentiate between runs that are used for preparation or teardown of test environment in recordings, you can use parameter `recordingsType` and recordings for that run will be grouped in recordings file as `prepare-profile/provider/useCase` or `teardown-profile/provider/useCase`:

```typescript
import { RecordingsType } from '@superfaceai/testing';

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
    recordingsType: RecordingsType.PREPARE,
  }
);
```

## Continuous testing

Testing library supports continuous testing with live provider's traffic. This means that you can run testing library in record mode without worrying that old recording of traffic gets rewritten. Testing library compares old recording with new one and determines changes. If it find changes, it will save new traffic next to old one with suffix `-new`.

This recording represents new traffic and you can test your capabilities with it. First time it records new traffic, it also uses it for map and therefore you can see if map works with it, but we can also setup environment variable `USE_NEW_TRAFFIC=true` to mock new traffic instead of old one when not in record mode (it looks for recording with suffix `-new` next to old one).

When you think the new recording is safe to use for testing, you can set it up as default with env variable `UPDATE_TRAFFIC=true`.

## Reporting

To report found changes in traffic, you can implement your own function for reporting and pass it to `SuperfaceTest.report()`. It's signiture should be:

```typescript
type TestReport = {
  impact: MatchImpact;
  profileId: string;
  providerName: string;
  useCaseName: string;
  recordingPath: string;
  input: NonPrimitive;
  result: TestingReturn;
  errors: ErrorCollection<string>;
}[];

type AlertFunction = (report: TestReport) => unknown | Promise<unknown>;
```

To disable collecting and also reporting these information, you can setup environment variable `DISABLE_PROVIDER_CHANGES_COVERAGE=true`.

## Debug

You can use enviroment variable `DEBUG` to enable logging throughout testing process.

- `DEBUG="superface:testing*"` will enable all logging
- `DEBUG="superface:testing"` will enable logging of:
  - perform results
  - start and end of recording/mocking HTTP traffic
  - start of `beforeRecordingLoad` and `beforeRecordingSave` functions
- `DEBUG=superface:testing:setup*` will enable logging of:
  - setup of recording paths and superface components (profile, provider, usecase)
  - setup of super.json and local map
- `DEBUG=superface:testing:hash*` will enable logging of hashing recordings
- `DEBUG="superface:testing:recordings"` will enable logging of processing sensitive information in recordings
- `DEBUG="superface:testing:recordings*"` or `DEBUG="superface:testing:recordings:sensitive"` will also enable logging of replacing actual credentials
- `DEBUG=superface:testing:matching*` enables logging of matching recordings
- `DEBUG=superface:testing:reporter*` enables logging of reporting

You can encounter `NetworkError` or `SdkExecutionError` during testing with mocked traffic, it usually means that request didn’t get through. If nock (used for loading mocked traffic) can’t match recording, request is denied. You can debug nock matching of recordings with `DEBUG=nock*` to see what went wrong.

## Known Limitations

### Multiple matching requests for the same use case

Recordings make it possible to run tests without calling the live API. This works by trying to match a request to the requests in the existing recordings. If a match is found, the recorded response is returned. However, since the testing client saves recording for each test run in a single file, it means multiple matching requests for the same use-case and input will overwrite each other.

To solve this, you can enter test instance (`expect` from jest) or specify custom hash phrase to differentiate between runs.
Also a workaround is to use different inputs for each each test.

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
