import { expect, test as base } from '@playwright/test';

/* The browser specs test OUR code, so they must not depend on anyone else's
   servers. Left alone, every page.goto('/') asked gstatic.com for the Firebase
   SDK and Google Fonts for CSS, which meant:

   - a slow or unreachable CDN made a green build red for no reason in the code;
   - when the SDK did arrive it was the real one, free to initialise against the
     production Firebase project from a CI machine;
   - the specs behaved differently with and without a network, and only one of
     the two was ever the one being tested.

   playwright.config.js therefore resolves no host but the local server (a
   browser-level rule, so it costs nothing per request; routing every request
   through a handler made the 16-page role walk too slow). A spec that needs an
   external host answers it itself with page.route, which is served before any
   DNS lookup, as the App Check spec does with its stub SDK.

   `externalRequests` lists the external URLs the page asked for and could not get,
   so a test can assert on them and a new third-party dependency shows up by name. */
const LOCAL = /^(http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|data:|blob:|about:)/;

export const test = base.extend({
  externalRequests: [async ({ context }, use) => {
    const refused = [];
    context.on('requestfailed', (request) => {
      if (!LOCAL.test(request.url())) refused.push(request.url());
    });
    await use(refused);
  }, { auto: true }],
});

export { expect };
