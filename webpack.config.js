'use strict';
const fs = require('fs');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const path = require('path');
const ForkTsCheckerNotifierWebpackPlugin = require('fork-ts-checker-notifier-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const HtmlWebPackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    return [
        DebuggerPages(),
        IndividualRules(),
        MultiplayrLibConfig()
    ];
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
            extensions: [ '.tsx', '.ts', '.js'],
        },
        module: WebModule,
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
        module: WebModule,
        resolve: {
            extensions: [ '.tsx', '.ts', '.js'],
        },
        plugins: [
            ...ForkTsChecker
        ]
    };
}

function AllRulesConfig() {
    return {
        entry: {
            rules: './rules/rules.ts',
            host: './client/js/host.ts',
            join: './client/js/join.ts',
        },
        output: {
            path: path.resolve(__dirname, './build/client/'),
            publicPath: path.resolve(__dirname, './build/client/'),
            pathinfo: true,
            filename: '[name].bundle.js',
            libraryTarget: 'var',
            library: '_rules'
        },
        target: 'web',
        devtool: 'source-map',
        module: WebModule,
        resolve: {
            extensions: [ '.tsx', '.ts', '.js'],
        },
        plugins: [
            ...ForkTsChecker,
            new webpack.NoEmitOnErrorsPlugin()
        ]
    };
}

function MultiplayrLibConfig() {
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
        devtool: 'source-map',
        mode: 'development',
        optimization: { minimize: false },
        module: WebModule,
        resolve: {
            extensions: [ '.tsx', '.ts', '.js'],
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

const tsconfigPath = path.resolve('./tsconfig.json');
const ForkTsChecker = [
    new ForkTsCheckerWebpackPlugin({
        typescript: { configFile: tsconfigPath }
    }),
    new ForkTsCheckerNotifierWebpackPlugin({ title: 'TypeScript', excludeWarnings: false })
];

const WebModule = {
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
                    transpileOnly: true,
                    experimentalWatchApi: true,
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
