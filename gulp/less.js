var gulp = require('gulp');
var less = require('gulp-less');
var path = require('path');

gulp.task('less', ['static'], function () {
    return gulp.src('src/rules/gamerules/**/*.less')
               .pipe(less({
                   paths: [ path.join(__dirname, 'less', 'includes') ]
               }))
               .pipe(gulp.dest('build/rules/gamerules/'));
});