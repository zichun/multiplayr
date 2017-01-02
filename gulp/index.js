'use strict';

var gulp = require('gulp');

require('./tslint');
require('./typescript');
require('./webpack');
require('./mocha');
require('./clean');
require('./less');
require('./static');

gulp.task('default', ['tslint', 'clean', 'typescript', 'mocha', 'static', 'less', 'webpack']);