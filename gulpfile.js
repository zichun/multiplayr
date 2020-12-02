/*global reload */
//https://github.com/zichun/multiplayr/commit/9b87d4db666da98151c52c625877a6cb00b7be0b#diff-25789e3ba4c2adf4a68996260eb693a441b4a834c38b76167a120f0b51b969f7
//https://gulpjs.com/docs/en/getting-started/creating-tasks
'use strict';

const { src, dest, series, parallel, watch } = require('gulp');
const webpack = require('webpack');
const del = require('del');
const ts = require('gulp-typescript');
const tslint = require('gulp-tslint');
const mocha = require('gulp-mocha');
const run = require('gulp-run');

function tslintTask(cb)
{
    return src('src/**/*.ts')
        .pipe(tslint({
            configuration: (process.cwd() + '/tslint.json'),
            formatter: 'verbose'
        }))
        .pipe(tslint.report());
}

function cleanTask(cb)
{
    del(['build']);

    cb();
}

function typescriptTask(cb)
{
    const tsconfig = require(process.cwd() + '/tsconfig.json');
    const tsProject = ts.createProject('tsconfig.json');
    const tsResult = tsProject.src().pipe(tsProject());
    return tsResult.js.pipe(dest(tsconfig.compilerOptions.outDir));
}

function mochaTask(cb)
{
    return src('build/tests/test.js', { read: false })
        .pipe(mocha({ reporter: 'nyan' }));
}

function webpackTask(cb)
{
    const webpackConfig = require(process.cwd() + '/webpack.config');
    webpack(webpackConfig, (err, stats) => {
        if (err)
        {
            throw err;
        }
        cb();
    });
}

const staticTask = (() => {
    function cssTask(cb) {
        return src('src/client/**/*.css')
            .pipe(dest('build/client'));
    }
    function htmlTask(cb) {
        return src('src/client/**/*.html')
            .pipe(dest('build/client'));
    }
    function jsTask(cb) {
        return src('src/client/**/*.js')
            .pipe(dest('build/client'));
    }
    function rulesTask(cb) {
        return src('src/rules/gamerules/**/*.js')
            .pipe(dest('build/rules/gamerules/'));
    }
    function rulesCssTask(cb) {
        return src('src/rules/gamerules/**/*.css')
            .pipe(dest('build/rules/gamerules/'));
    }

    return parallel(cssTask, htmlTask, jsTask, rulesTask, rulesCssTask);
})();


exports.clean = cleanTask;
exports.check = tslintTask;
exports.test = series(typescriptTask, mochaTask);
exports.default = series(cleanTask, tslintTask, typescriptTask, mochaTask, staticTask, webpackTask);

exports.watch = () => {
    watch('src/**/*.css', staticTask);
    watch('src/**/*.html', staticTask);
    watch('src/**/*.ts', { delay: 750 }, series(tslintTask, typescriptTask, mochaTask, webpackTask));
    watch('src/**/*.tsx', { delay: 750 }, series(tslintTask, typescriptTask, mochaTask, webpackTask));
    watch('src/**/*.scss', { delay: 750 }, series(tslintTask, typescriptTask, mochaTask, webpackTask));

    run('node build/app.js').exec();
};
