const gulp = require('gulp');
const mocha = require('gulp-mocha');

gulp.task('mocha', ['typescript'], function() {
    gulp.src('build/tests/test.js', {read: false})
        .pipe(mocha({reporter: 'nyan'}))
});