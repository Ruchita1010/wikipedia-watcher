import { EventSource } from 'eventsource';
import colors from 'yoctocolors';
import Queue from './utils/queue.js';

const STREAM_URL = 'https://stream.wikimedia.org/v2/stream/revision-create';
const REPORT_INTERVAL = 60 * 1000;
const TIME_WINDOW = 5 * 60 * 1000;

const eventSource = new EventSource(STREAM_URL);
// using queue instead of array as shift is O(n), so kinda slow (Tho it might be insignificant here).
const eventBuffer = new Queue();

eventSource.addEventListener('open', () => {
  console.log(colors.greenBright('✓ The connection has been established.'));
});

eventSource.addEventListener('error', () => {
  console.error(
    colors.redBright('✗ An error occured while attempting to connect.')
  );
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

function getReportData() {
  const domains = {};
  const users = {};

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

  const sortedDomains = Object.entries(domains)
    .map(([domain, pages]) => [domain, pages.size])
    .sort((a, b) => b[1] - a[1]);

  const sortedUsers = Object.entries(users).sort((a, b) => b[1] - a[1]);

  return { domains: sortedDomains, users: sortedUsers };
}

function displayDomainsReport(domains) {
  console.log(colors.bold(colors.magentaBright('\n\n──DOMAINS REPORT──')));
  console.log(
    colors.bold(
      `Total number of Wikipedia Domains updated: ${colors.yellow(
        domains.length
      )}`
    )
  );

  domains.forEach(([domain, pages]) => {
    console.log(`${domain}: ${colors.yellow(pages)} updated`);
  });
}

function displayUsersReport(users) {
  console.log(colors.bold(colors.magentaBright('\n\n──USERS REPORT──')));
  console.log(colors.whiteBright('Users who made changes to en.wikipedia.org'));

  users.forEach(([username, editCount]) => {
    console.log(`${username}: ${colors.yellow(editCount)}`);
  });
}

setInterval(() => {
  const now = Date.now();
  while (eventBuffer.length && eventBuffer[0].timestamp < now - TIME_WINDOW) {
    eventBuffer.dequeue();
  }

  const { domains, users } = getReportData();
  displayDomainsReport(domains);
  displayUsersReport(users);

  console.log(colors.gray('─'.repeat(57)));
}, REPORT_INTERVAL);
