import { getRecordings } from '../nock/recorder.utils';
import { RecordingType } from '../nock/recording.interfaces';
import { bold, whiteBright, bgGreen, black, red } from 'chalk';
import { inspect } from 'util';

export async function inspectRecordings(
  recordingsInfo: {
    path: string;
    type: RecordingType;
    key: string;
    hash: string;
  },
  testName: string
): Promise<void> {
  // try to load recording?
  const recordings = await getRecordings(
    recordingsInfo.path,
    recordingsInfo.type,
    recordingsInfo.key,
    recordingsInfo.hash
  );

  process.stdout.write(`${bold(black(bgGreen(`Inspect ${testName}:`)))}\n\n`);

  if (recordingsInfo.type !== RecordingType.MAIN) {
    process.stdout.write(red(`Test ${bold(recordingsInfo.type)} call\n\n`));
  }
  for (const call of recordings) {
    process.stdout.write(
      whiteBright(
        `HTTP ${bold(call.method ?? 'undefined')} call to ${bold(
          call.path
        )}:\n\n`
      )
    );


    if (call.body !== undefined) {
      if (call.body === '') {
        process.stdout.write(whiteBright(`Empty request body\n\n`));
      } else {
        process.stdout.write(
          whiteBright(`Request body:\n${inspect(call.body, true, 20)}:\n\n`)
        );
      }
    }

    // If there is decoded response use it
    if (call.decodedResponse !== undefined) {
      process.stdout.write(
        whiteBright(
          `Decoded response body with ${bold(
            call.status ?? 'undefined'
          )} status code:\n${JSON.stringify(
            call.decodedResponse,
            undefined,
            2
          )}`
        )
      );
    } else {
      process.stdout.write(
        whiteBright(
          `Response body with ${bold(
            call.status ?? 'undefined'
          )} status code:\n${JSON.stringify(call.response, undefined, 2)}`
        )
      );
    }
    process.stdout.write(`\n\n\n`);
  }
}
