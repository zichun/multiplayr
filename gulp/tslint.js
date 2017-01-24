var gulp = require('gulp');
var tslint = require('gulp-tslint');

gulp.task("tslint", function() {
    gulp.src("src/**/*.ts")
        .pipe(tslint({
            configuration: (process.cwd() + '/tslint.json'),
            formatter: "verbose"
        }))
        .pipe(tslint.report())
});