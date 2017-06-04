'use strict';

var webpack = require('webpack');
//var ExtractTextPlugin = require('extract-text-webpack-plugin');
//var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');
let configs = [
    createConfig()
];

function createConfig() {
    return {
        context: path.resolve(__dirname, 'build'),
        entry: {
            lib: './client/js/lib',
            locallib: './client/js/locallib'
        },
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        {
                            loader: 'style-loader'
                        }
                      // ,{
                      //       loader: 'css-loader',
                      //       options: { url: false }
                      //   }
                    ]
                },
                {
                    test: /\.js$/,
                    use: ['source-map-loader'],
                    enforce: 'pre'
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
                jquery: "src/client/js/jquery",
                Q: "src/client/js/q"
            }
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
