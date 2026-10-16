// Coverage thresholds for Karma.
// Ratchet: raise these when coverage goes up. Never lower them.
// Measured 2026-10-16 after importing every src/app TypeScript file.
// Floored baseline: lines 13.63, statements 13.07, branches 13.44, functions 6.53.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: require('path').join(__dirname, 'coverage/fdf-portal'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcov' },
        { type: 'json-summary' },
      ],
      includeAllSources: true,
      check: {
        global: {
          statements: 13,
          branches: 13,
          functions: 6,
          lines: 13,
        },
      },
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
