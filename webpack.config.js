'use strict';
const fs = require('fs');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const path = require('path');
const ForkTsCheckerNotifierWebpackPlugin = require('fork-ts-checker-notifier-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const HtmlWebPackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const mode = (argv.mode === 'production' ? 'production' : 'development');
    if (mode === 'production') {
        return [
            MultiplayrLibConfig(mode),
            ExpressServerConfig(),
            HostJoinPages(),
            AllRulesConfig()
        ];
    } else {
        return [
            DebuggerPages(),
            IndividualRules(),
            MultiplayrLibConfig(mode),
            ExpressServerConfig()
        ];
    }
};

const localDebugPages = ['avalon', 'coup', 'theoddone', 'decrypto'];
function DebuggerPages() {
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
            path: path.resolve(__dirname, './build/client/'),
            publicPath: path.resolve(__dirname, './build/client/'),
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
            new webpack.NoEmitOnErrorsPlugin()
        ]
    };
}

function IndividualRules() {
    const entry = {};
    localDebugPages.forEach(debug => {
        entry[debug] = './src/rules/' + debug + '.ts';
    });
    return {
        entry: entry,
        output: {
            path: path.resolve(__dirname, './build/client/'),
            publicPath: path.resolve(__dirname, './build/client/'),
            pathinfo: true,
            filename: '[name].js',
            libraryTarget: 'var',
            library: '_mprules'
        },
        target: 'web',
        devtool: 'source-map',
        mode: 'development',
        optimization: { minimize: false },
        module: WebModule(true),
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        plugins: [
            ...ForkTsChecker,
            new webpack.NoEmitOnErrorsPlugin()
        ]
    };
}

function HostJoinPages() {
    return {
        entry: {
            host: './src/client/js/host.ts',
            join: './src/client/js/join.ts',
        },
        output: {
            path: path.resolve(__dirname, './build/client/'),
            publicPath: path.resolve(__dirname, './build/client/'),
            pathinfo: false,
            filename: '[name].bundle.js'
        },
        target: 'web',
        module: WebModule(false),
        mode: 'production',
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        plugins: [
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
            new webpack.NoEmitOnErrorsPlugin()
        ]
    };
}
function AllRulesConfig() {
    return {
        entry: {
            rules: './src/rules/rules.ts'
        },
        output: {
            path: path.resolve(__dirname, './build/client/'),
            publicPath: path.resolve(__dirname, './build/client/'),
            pathinfo: false,
            filename: '[name].bundle.js',
            libraryTarget: 'var',
            library: '_mprules'
        },
        target: 'web',
        module: WebModule(false),
        mode: 'production',
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        }
    };
}

function MultiplayrLibConfig(mode) {
    return {
        entry: {
            lib: './src/client/js/lib.ts',
            locallib: './src/client/js/locallib.ts',
        },
        output: {
            path: path.resolve(__dirname, './build/client/'),
            publicPath: path.resolve(__dirname, './build/client/'),
            pathinfo: true,
            filename: '[name].bundle.js',
            libraryTarget: 'var',
            library: '_mplib'
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
            ...ForkTsChecker
        ]
    };
}

function ExpressServerConfig() {
    return ({
        entry: './src/app.ts',
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
