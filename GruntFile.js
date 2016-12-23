module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-open');
    grunt.loadNpmTasks('grunt-tslint');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        tslint: {
            options: {
                rulesDirectory: 'node_modules/tslint-microsoft-contrib',
                configuration: grunt.file.readJSON("tslint.json")
            },
            files: {
                src: ['src/**/*.ts', '!src/**/*.d.ts']
            }
        },
        ts: {
            app: {
                src: ["src/server/app.ts"],
                outDir: 'out/',
                options: {
                    module: "commonjs",
                    target: "es6"
                }
            },
            rules: {
                src: ["src/rules/rules.ts"],
                outDir: 'out/',
                options: {
                    failOnTypeErrors: false
                }
            },
            serverLib: {
                src: ["src/server/lib/*.ts"],
                outDir: 'out/lib/',
                options: {
                    module: "commonjs",
                    target: "es6"
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
            tests: {
                files: [
                    {expand: true, cwd: 'tests/', src: ['**'], dest: 'out/tests/'}
                ]
            }
        },
        watch: {
            files: 'src/**/*.ts',
            tasks: ['tslint', 'ts', 'copy']
        }
    });

    grunt.registerTask('default', ['tslint', 'ts', 'copy']);
}