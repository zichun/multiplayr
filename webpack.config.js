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

module.exports = (env, argv) => {
    const mode = (argv && argv.mode === 'production' ? 'production' : 'development');
    
    if (env && env.static) {
        const distPath = path.resolve(__dirname, './dist/');
        return [
            MultiplayrLibConfig(mode, distPath),
            HostJoinPages(mode, distPath, true),
            AllRulesConfig(distPath),
            DebuggerPages(distPath),
            IndividualRules(distPath, true)
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
            IndividualRules(),
            MultiplayrLibConfig(mode),
            ExpressServerConfig(mode),
            HostJoinPages(mode),
            AllRulesConfig()
        ];
    }
};

const localDebugPages = ['avalon', 'coup', 'theoddone', 'decrypto', 'minesweeperflags', 'tictactoepoker', 'ito', 'drawing', 'catchsketch', 'durian', 'startups', 'clever'];
function DebuggerPages(outputPath) {
    const entry = {};
    const plugins = localDebugPages.map(debug => {
        entry[debug + '.local'] = './src/client/js/' + debug + '.local.ts'
        return (new HtmlWebPackPlugin({
            template: './src/client/static/' + debug + '.html',
            filename: './' + debug + '.html',
            inject: false
        }));
    });

    return {
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
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        module: WebModule(true),
        plugins: [
            ...plugins,
            ...ForkTsChecker,
            ESLintPluginConfig(),
            new webpack.NoEmitOnErrorsPlugin()
        ]
    };
}

function IndividualRules(outputPath, isStaticDist) {
    const entry = {};
    localDebugPages.forEach(debug => {
        entry[debug] = isStaticDist ? './src/rules/' + debug + '.ts' : [
            'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000',
            './src/rules/' + debug + '.ts'
        ];
    });

    const plugins = [
        ...ForkTsChecker,
        ESLintPluginConfig(),
        new webpack.NoEmitOnErrorsPlugin()
    ];

    if (!isStaticDist) {
        plugins.push(new webpack.HotModuleReplacementPlugin());
    }

    return {
        entry: entry,
        output: {
            path: outputPath || path.resolve(__dirname, './build/client/'),
            publicPath: '',
            pathinfo: true,
            filename: '[name].js',
            library: {
                name: '_mprules',
                type: 'var'
            }
        },
        target: 'web',
        devtool: 'source-map',
        mode: 'development',
        optimization: { minimize: false },
        module: WebModule(true),
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        plugins: plugins
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
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        plugins: [
            ...plugins,
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
        entry: {
            rules: './src/rules/rules.ts'
        },
        output: {
            path: outputPath || path.resolve(__dirname, './build/client/'),
            publicPath: '',
            pathinfo: false,
            filename: '[name].bundle.js',
            library: {
                name: '_mprules',
                type: 'var'
            }
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
    return ({
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
                    use: 'ts-loader',
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
    });
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
                        experimentalWatchApi: transpileOnly,
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
