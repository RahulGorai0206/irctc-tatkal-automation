const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: '7afdkj',

  defaultCommandTimeout: 120000,
  // video: true,
  blockHosts: [
    '*google-analytics.com',
    '*googletagmanager.com',
    '*doubleclick.net',
    '*adform.net',
    '*youtube.com',
    '*cdn.jsdelivr.net',
    '*techlab-cdn.com',
    '*go-mpulse.net',
    '*unibotscdn.com',
    '*vdo.ai',
    '*adtrafficquality.google',
    '*cloudflareinsights.com',
    '*clarity.ms'
  ],

  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          // Then to see the log messages in the terminal
          //   cy.task("log", "my message");
          console.log(message + '\n\n');
          return null;
        },
      });
    },
    chromeWebSecurity: false,
    experimentalModifyObstructiveThirdPartyCode: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },
});


