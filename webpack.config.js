var webpack = require('webpack');
//var ExtractTextPlugin = require('extract-text-webpack-plugin');
//var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');

module.exports = {
    context: __dirname + '/build',
    entry: {
        host: './client/js/host',
        join: './client/js/join'
    },
    output: {
        path: __dirname + '/build/client/js/',
        publicPath: '/',
        filename: '[name].bundle.js'
    },
    resolve: {
        root: __dirname,
        extensions: ['', '.js'],
        alias: {
            jquery: "src/client/js/jquery",
            Q: "src/client/js/q"
        }
    },
    plugins: [
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery",
            Q: "Q"
        })
    ]
}