var gulp = require('gulp');
var less = require('gulp-less');
var path = require('path');

gulp.task('rules-less', ['static'], function () {
    return gulp.src('src/rules/**/*.less')
               .pipe(less({
                   paths: [ path.join(__dirname, 'less', 'includes') ]
               }))
               .pipe(gulp.dest('build/rules/'));
});

gulp.task('client-less', ['static'], function () {
    return gulp.src('src/client/**/*.less')
               .pipe(less({
                   paths: [ path.join(__dirname, 'less', 'includes') ]
               }))
               .pipe(gulp.dest('build/client/'));
});