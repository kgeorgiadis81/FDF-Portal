// Coverage thresholds for Karma, measured over every src/app TypeScript file.
// Ratchet: when a re-measure is higher, raise that threshold to the floor of
// the measured value. Never lower a threshold to make the suite pass.
// Re-measured after INT-82 (2026-10-17): statements 97.68, branches 89.50,
// functions 97.22, lines 98.34.
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
        { type: 'text' },
        { type: 'lcov' },
        { type: 'json-summary' },
      ],
      check: {
        global: {
          statements: 97,
          branches: 89,
          functions: 97,
          lines: 98,
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
