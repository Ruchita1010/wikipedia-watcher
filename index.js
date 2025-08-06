import { EventSource } from 'eventsource';

const STREAM_URL = 'https://stream.wikimedia.org/v2/stream/revision-create';
const INTERVAL = 10 * 1000;
const evtSource = new EventSource(STREAM_URL);

evtSource.addEventListener('open', () => {
  console.info('The connection has been established.');
});

evtSource.addEventListener('error', () => {
  console.info('An error occured while attempting to connect.');
});

evtSource.addEventListener('message', (e) => {
  console.log(JSON.parse(e.data));
});
