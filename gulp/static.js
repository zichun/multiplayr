var gulp = require('gulp');

gulp.task('css', ['clean'], function() {
    return gulp.src("src/client/**/*.css")
               .pipe(gulp.dest('build/client/'));
});

gulp.task('html', ['clean'], function() {
    return gulp.src("src/client/**/*.html")
               .pipe(gulp.dest('build/client/'));
});

gulp.task('js', ['clean'], function() {
    return gulp.src("src/client/**/*.js")
               .pipe(gulp.dest('build/client/'));
});

gulp.task('rules', ['clean'], function() {
    return gulp.src("src/rules/gamerules/**/*.js")
               .pipe(gulp.dest('build/rules/gamerules/'));
});

gulp.task('rules-css', ['clean'], function() {
    return gulp.src("src/rules/gamerules/**/*.css")
               .pipe(gulp.dest('build/rules/gamerules/'));
});

gulp.task('static', ['js', 'css', 'html', 'rules', 'rules-css']);