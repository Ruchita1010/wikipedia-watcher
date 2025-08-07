import { EventSource } from 'eventsource';
import Queue from './utils/queue.js';

const STREAM_URL = 'https://stream.wikimedia.org/v2/stream/revision-create';
const REPORT_INTERVAL = 10 * 1000;
const TIME_WINDOW = 5 * 60 * 1000;

const eventSource = new EventSource(STREAM_URL);
// using queue instead of array as shift is O(n), so kinda slow (Tho it might be insignificant here).
const eventBuffer = new Queue();

eventSource.addEventListener('open', () => {
  console.info('The connection has been established.');
});

eventSource.addEventListener('error', () => {
  console.info('An error occured while attempting to connect.');
});

eventSource.addEventListener('message', (e) => {
  const {
    meta: { domain },
    page_title,
    performer: { user_text, user_is_bot, user_edit_count },
  } = JSON.parse(e.data);

  eventBuffer.enqueue({
    timestamp: Date.now(),
    domain,
    page_title,
    user_text,
    user_is_bot,
    user_edit_count,
  });
});

setInterval(() => {
  const domains = {};
  const users = {};

  const now = Date.now();
  while (eventBuffer.length && eventBuffer[0].timestamp < now - TIME_WINDOW) {
    eventBuffer.shift();
  }

  for (const event of eventBuffer) {
    const { domain, page_title, user_text, user_is_bot, user_edit_count } =
      event;

    if (!domains[domain]) {
      domains[domain] = new Set();
    }
    domains[domain].add(page_title);

    if (
      !user_is_bot &&
      domain === 'en.wikipedia.org' &&
      user_edit_count !== undefined
    ) {
      users[user_text] = user_edit_count;
    }
  }

  const domainEntries = Object.entries(domains)
    .map(([domain, pagesSet]) => [domain, pagesSet.size])
    .sort((a, b) => b[1] - a[1]);

  console.log(
    `\nTotal number of Wikipedia Domains updates: ${domainEntries.length}\n`
  );
  domainEntries.forEach(([domain, uniquePages]) => {
    console.log(`${domain}: ${uniquePages} updated`);
  });

  const sortedUsers = Object.entries(users).sort((a, b) => b[1] - a[1]);
  console.log('\nUsers who made changes to en.wikipedia.org\n');
  sortedUsers.forEach(([username, editCount]) => {
    console.log(`${username}: ${editCount}`);
  });

  console.log('\n--------------------------------------------------\n');
}, REPORT_INTERVAL);
