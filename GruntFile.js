module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-open');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        ts: {
            app: {
                src: ["src/server/app.ts"],
                out: 'out/app.js'
            },
            rules: {
                src: ["src/rules/rules.ts"],
                out: 'out/rules.js',
                options: {
                    failOnTypeErrors: false
                }
            }
        },
        copy: {
            staticFiles: {
                files: [
                    {expand: true, cwd: 'src/client/', src:['**'], dest: 'out/public/'},
                    {expand: true, cwd: 'src/rules/gamerules/', src: ['**'], dest: 'out/public/gamerules/'}
                ]
            },
            transportLib: {
                files: [
                    {expand: true, cwd: 'src/server/transport/', src: ['**'], dest: 'out/transport/'}
                ]
            },
            tests: {
                files: [
                    {expand: true, cwd: 'tests/', src: ['**'], dest: 'out/tests/'}
                ]
            }
        },
        watch: {
            files: 'src/**/*.ts',
            tasks: ['ts', 'copy', 'open']
        }
    });

    grunt.registerTask('default', ['ts', 'copy']);
}