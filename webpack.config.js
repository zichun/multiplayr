'use strict';

var webpack = require('webpack');
var path = require('path');
let configs = [
    createConfigCommon(),
    createRuleSpecificConfig()
];

function createRuleSpecificConfig() {
    let commonConfig = createConfigCommon();

    // These files run code the moment they are included.
    // The target variable where the module exports are located
    // don't matter
    commonConfig.entry = {
        host: './client/js/host.ts',
        join: './client/js/join.ts',
        "avalon.local": './client/js/avalon.local.ts',
        "coup.local": './client/js/coup.local.ts',
        "theoddone.local": './client/js/oddone.local.ts',
    };
    commonConfig.output.library = "_unused";
    return commonConfig;
}

function createConfigCommon() {
    return {
        context: path.resolve(__dirname, 'src'),
        entry: {
            lib: './client/js/lib.ts',
            locallib: './client/js/locallib.ts'
        },
        module: {
            rules: [
                {
                    test: /\.(png|jpe?g|gif|mp3)$/i,
                    use: [
                      {
                        loader: 'file-loader',
                      },
                    ],
                    exclude: /node_modules/,
                },
                {
                    test: /\.scss$/i,
                    use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    "css-loader",
                    // Compiles Sass to CSS
                    "sass-loader",
                    ],
                    exclude: /node_modules/,
                },
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /test\.js$/,
                    use: 'mocha-loader',
                    exclude: /node_modules/,
                }
            ]
        },
        output: {
            path: path.resolve(__dirname, './build/client/js/'),
            publicPath: '/',
            filename: '[name].bundle.js',
            libraryTarget: 'var',
            library: '_mplib'
        },
        resolve: {
            alias: {
                jquery: "src/client/js/jquery.js",
                Q: "src/client/js/q"
            },
            extensions: [ '.tsx', '.ts', '.js' ],
        },
        externals: {
            jquery: "jQuery",
        },
        plugins: [
            new webpack.ProvidePlugin({
                $: "jquery",
                jQuery: "jquery"
            })
        ],
        optimization: {
            minimize: false
        },
    };
}

module.exports = configs;
