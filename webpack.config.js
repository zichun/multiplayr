'use strict';

var webpack = require('webpack');
//var ExtractTextPlugin = require('extract-text-webpack-plugin');
//var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');
let configs = [
    createConfig(),
    //createBackendConfig()
];

function createBackendConfig() {
    
}

function createConfig() {
    return {
        context: path.resolve(__dirname, 'src'),
        entry: {
            lib: './client/js/lib.ts',
            locallib: './client/js/locallib.ts'
        },
        module: {
            rules: [
                {
                    test: /\.(png|jpe?g|gif)$/i,
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
                },
                /*
                {
                    test: /\.js$/,
                    use: ['source-map-loader'],
                    enforce: 'pre'
                }
                */
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
                jquery: "src/client/js/jquery",
                Q: "src/client/js/q"
            },
            extensions: [ '.tsx', '.ts', '.js' ],
        },
        plugins: [
            new webpack.ProvidePlugin({
                $: "jquery",
                jQuery: "jquery"
            })
        ]
    };
}

module.exports = configs;
