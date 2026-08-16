'use strict';
const fs = require('fs');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const path = require('path');
const ForkTsCheckerNotifierWebpackPlugin = require('fork-ts-checker-notifier-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

// Custom .env loader to load local environment variables without introducing new dependencies
const dotenvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
    const dotenvConfig = fs.readFileSync(dotenvPath, 'utf8');
    dotenvConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value.trim();
        }
    });
}

// Build version stamp = local build time (YYYYMMDD-HHMM), with the short git commit
// appended when available. Injected into the static HTML pages by BuildVersionPlugin
// (replacing the __MP_BUILD_VERSION__ token) so every published distribution is
// identifiable and cache-busted.
function computeBuildVersion() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    let commit = '';
    try {
        commit = require('child_process')
            .execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim();
    } catch (e) {
        // git unavailable (e.g. building from a tarball) — the timestamp alone is fine.
    }
    // Keep it URL-safe (no spaces/parens) since it is also used as a ?v= cache-buster.
    return commit ? `${stamp}-${commit}` : stamp;
}

const BUILD_VERSION = computeBuildVersion();

// Replaces the __MP_BUILD_VERSION__ token in every HTML page emitted by
// html-webpack-plugin with the computed build version.
class BuildVersionPlugin {
    constructor(version) {
        this.version = version;
    }
    apply(compiler) {
        compiler.hooks.compilation.tap('BuildVersionPlugin', (compilation) => {
            const hooks = HtmlWebPackPlugin.getHooks(compilation);
            hooks.beforeEmit.tapAsync('BuildVersionPlugin', (data, cb) => {
                data.html = data.html.split('__MP_BUILD_VERSION__').join(this.version);
                cb(null, data);
            });
        });
    }
}

module.exports = (env, argv) => {
    const mode = (argv && argv.mode === 'production' ? 'production' : 'development');
    
    if (env && env.static) {
        const distPath = path.resolve(__dirname, './dist/');
        return [
            MultiplayrLibConfig(mode, distPath),
            HostJoinPages(mode, distPath, true),
            AllRulesConfig(distPath),
            DebuggerPages(distPath)
        ];
    }

    if (mode === 'production') {
        return [
            MultiplayrLibConfig(mode),
            ExpressServerConfig(mode),
            HostJoinPages(mode),
            AllRulesConfig()
        ];
    } else {
        return [
            DebuggerPages(),
            MultiplayrLibConfig(mode),
            ExpressServerConfig(mode),
            HostJoinPages(mode),
            AllRulesConfig()
        ];
    }
};

function DebuggerPages(outputPath) {
    const entry = {
        'debug.local': './src/client/js/debug.local.ts',
        'cards.sandbox': './src/client/js/cards.sandbox.tsx'
    };

    return {
        name: 'debugger-pages',
        cache: {
            type: 'filesystem',
            name: 'debugger-pages-dev',
            buildDependencies: {
                config: [__filename]
            }
        },
        entry: entry,
        output: {
            path: outputPath || path.resolve(__dirname, './build/client/'),
            publicPath: '',
            pathinfo: true,
            filename: '[name].js'
        },
        target: 'web',
        devtool: 'source-map',
        mode: 'development',
        optimization: { minimize: false },
        externals: {
            react: 'React',
            'react-dom': 'ReactDOM'
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        module: WebModule(true),
        plugins: [
            new HtmlWebPackPlugin({
                template: './src/client/static/debug.html',
                filename: './debug.html',
                inject: false
            }),
            new HtmlWebPackPlugin({
                template: './src/client/static/cards.html',
                filename: './cards.html',
                inject: false
            }),
            ...ForkTsChecker,
            ESLintPluginConfig(),
            new webpack.NoEmitOnErrorsPlugin()
        ]
    };
}

function HostJoinPages(mode, outputPath, isStaticDist) {
    const entry = isStaticDist ? {
        host_p2p: './src/client/js/host_p2p.ts',
        join_p2p: './src/client/js/join_p2p.ts',
    } : {
        host: './src/client/js/host.ts',
        join: './src/client/js/join.ts',
        host_p2p: './src/client/js/host_p2p.ts',
        join_p2p: './src/client/js/join_p2p.ts',
    };

    const plugins = [];
    if (isStaticDist) {
        plugins.push(
            new HtmlWebPackPlugin({
                template: './src/client/static/index.html',
                filename: './index.html',
                inject: false
            }),
            new HtmlWebPackPlugin({
                template: './src/client/static/host_p2p.html',
                filename: './host_p2p.html',
                inject: false
            }),
            new HtmlWebPackPlugin({
                template: './src/client/static/join_p2p.html',
                filename: './join_p2p.html',
                inject: false
            })
        );
    } else {
        plugins.push(
            new HtmlWebPackPlugin({
                template: './src/client/static/host.html',
                filename: './host.html',
                inject: false
            }),
            new HtmlWebPackPlugin({
                template: './src/client/static/join.html',
                filename: './join.html',
                inject: false
            }),
            new HtmlWebPackPlugin({
                template: './src/client/static/host_p2p.html',
                filename: './host_p2p.html',
                inject: false
            }),
            new HtmlWebPackPlugin({
                template: './src/client/static/join_p2p.html',
                filename: './join_p2p.html',
                inject: false
            })
        );
    }

    return {
        name: 'host-join-pages',
        cache: {
            type: 'filesystem',
            name: 'host-join-pages-' + mode + (isStaticDist ? '-static' : ''),
            buildDependencies: {
                config: [__filename]
            }
        },
        entry: entry,
        output: {
            path: outputPath || path.resolve(__dirname, './build/client/'),
            publicPath: '',
            pathinfo: false,
            filename: '[name].bundle.js'
        },
        target: 'web',
        module: WebModule(false),
        mode: mode,
        externals: {
            react: 'React',
            'react-dom': 'ReactDOM'
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        plugins: [
            ...plugins,
            new BuildVersionPlugin(BUILD_VERSION),
            new webpack.DefinePlugin({
                'process.env.TURN_URL': JSON.stringify(process.env.TURN_URL || ''),
                'process.env.TURN_USERNAME': JSON.stringify(process.env.TURN_USERNAME || ''),
                'process.env.TURN_CREDENTIAL': JSON.stringify(process.env.TURN_CREDENTIAL || '')
            }),
            ESLintPluginConfig(),
            new webpack.NoEmitOnErrorsPlugin()
        ]
    };
}
function AllRulesConfig(outputPath) {
    return {
        name: 'all-rules',
        cache: {
            type: 'filesystem',
            name: 'all-rules-prod',
            buildDependencies: {
                config: [__filename]
            }
        },
        entry: {
            rules: './src/rules/rules.ts'
        },
        output: {
            path: outputPath || path.resolve(__dirname, './build/client/'),
            publicPath: 'auto',
            pathinfo: false,
            filename: '[name].bundle.js',
            library: {
                name: '_mprules',
                type: 'var'
            }
        },
        externals: {
            react: 'React',
            'react-dom': 'ReactDOM'
        },
        target: 'web',
        module: WebModule(false),
        mode: 'production',
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        plugins: [
            ESLintPluginConfig()
        ]
    };
}

function MultiplayrLibConfig(mode, outputPath) {
    return {
        name: 'multiplayr-lib',
        cache: {
            type: 'filesystem',
            name: 'multiplayr-lib-' + mode,
            buildDependencies: {
                config: [__filename]
            }
        },
        entry: {
            lib: './src/client/js/lib.ts',
            locallib: './src/client/js/locallib.ts',
        },
        output: {
            path: outputPath || path.resolve(__dirname, './build/client/'),
            publicPath: '',
            pathinfo: true,
            filename: '[name].bundle.js',
            library: {
                name: '_mplib',
                type: 'var'
            }
        },
        target: 'web',
        devtool: mode === 'production' ? false : 'source-map',
        mode: mode,
        optimization: { minimize: false },
        module: WebModule(true),
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            alias: {
                jquery: "src/client/js/jquery.js",
                Q: "src/client/js/q"
            }
        },
        plugins: [
            ...ForkTsChecker,
            ESLintPluginConfig()
        ]
    };
}

function ExpressServerConfig(mode) {
    const entry = mode === 'production' ? 'app.ts' : 'app_dev.ts';
    return {
        name: 'express-server',
        cache: {
            type: 'filesystem',
            name: 'express-server-' + mode,
            buildDependencies: {
                config: [__filename]
            }
        },
        entry: './src/' + entry,
        output: {
            path: path.resolve(__dirname, './build'),
            publicPath: '/',
            filename: 'app.js'
        },
        target: 'node',
        externals: [require('webpack-node-externals')()],
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            experimentalWatchApi: true,
                        }
                    },
                    exclude: /node_modules/,
                }
            ]
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js' ]
        },
        optimization: {
            minimize: false
        }
    };
}

const tsconfigPath = path.resolve('./tsconfig.json');
const ForkTsChecker = [
    new ForkTsCheckerWebpackPlugin({
        typescript: { configFile: tsconfigPath }
    }),
    new ForkTsCheckerNotifierWebpackPlugin({ title: 'TypeScript', excludeWarnings: false })
];

const ESLintPluginConfig = () => {
    return new ESLintPlugin({
        extensions: ['js', 'ts', 'tsx'],
        exclude: 'node_modules',
        emitWarning: true,
        failOnError: true,
        failOnWarning: false
    });
};

const WebModule = (transpileOnly) => {
    return {
        rules: [
            {
                test: /\.html$/i,
                loader: 'html-loader',
                options: {
                    attributes: false
                }
            },
            {
                test: /\.tsx?$/i,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: transpileOnly,
                        experimentalWatchApi: true,
                        compilerOptions: {
                            module: "esnext"
                        }
                    }
                },
                exclude: /node_modules/,
            },
            {
                test: /\.(png|jpe?g|gif|mp3)$/i,
                loader: 'file-loader',
                options: {
                    publicPath: '/'
                },
                exclude: /node_modules/
            },
            {
                test: /\.scss$/i,
                use: [
                    "style-loader",
                    "css-loader",
                    "sass-loader",
                ],
                exclude: /node_modules/,
            }
        ],
    };
};
