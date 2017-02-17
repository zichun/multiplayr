/*global reload */
'use strict';

let build = require('node-web-build');
let gulp = require('gulp');
let webpack = require('webpack');

build.webpack.setConfig({ webpack: webpack });

build.postCopy.setConfig({
  copyTo: {
    'build': ['src/**/*.png', 'src/**/*.css'],
    'build/client/static': ['src/client/static/*.html']
  },
  shouldFlatten: false
});

build.typescript.setConfig({ 'libDir': 'build' });
build.mocha.setConfig({
  testMatch: 'build/tests/*.js'
});

var sourceMatch = [
  'src/**/*.{ts,tsx,scss,js,txt,html}',
  '!src/**/*.scss.ts'
];

build.setRigConfig({
    serveTask: function(config) {
        return {
            execute: function() {
                return build.serve.execute(config)
            },
            isEnabled: function() { return false; }
        };
    }
});

build.task(
    'mp-watch',
    build.watch(
        sourceMatch,
        build.serial(
            build.preCopy, build.sass, build.compileTsTasks,
            build.postCopy, build.webpack, build.postProcessSourceMapsTask, build.reload)));

// change the port of serve.
build.serve.setConfig({
  port: 3000,
  initialPage: '/'
});

let isProduction = process.argv.indexOf('--production') >= 0;
let isNuke = process.argv.indexOf('clean') >= 0;

if (isProduction || isNuke) {
  build.setConfig({
    libAMDFolder: 'lib-amd'
  });
}

/** @todo: Enable css modules when ready. */
// build.sass.setConfig({ useCSSModules: true });

// initialize tasks.
build.initialize(gulp);
