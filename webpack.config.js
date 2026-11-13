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

// ---------------------------------------------------------------------------
// Progressive Web App support
//
// PwaCollectPlugin runs in the lib / host-join / rules compilations and records
// what each one emitted (asset names + final HTML). The 'pwa' compilation is
// declared to depend on those, so by the time it runs PwaPlugin can derive the
// precache list from the emitted pages' own <script>/<link> references, then
// emit pwa.js (registration + update prompt), sw.js (from
// src/client/pwa/sw.template.js), manifest.webmanifest and the icons.
// ---------------------------------------------------------------------------

const PWA_COLLECTED = new Map(); // compilation name -> { assets: string[], html: { [name]: string } }
// CDN hosts whose (versioned) libraries the service worker may cache with
// stale-while-revalidate. Must match PWA CDN_HOSTS in sw.template.js.
const PWA_CDN_HOSTS = [
    'code.jquery.com',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'use.fontawesome.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];
const PWA_SHELL_DEPENDENCIES = ['multiplayr-lib', 'host-join-pages', 'all-rules'];
// cwd-relative like the entries and tsconfigPath: app_dev bundles this config into
// build/app.js, where __dirname is the bundle's folder rather than the repo root.
const PWA_ICON_DIR = path.resolve('./src/client/static/icons');
const PWA_SW_TEMPLATE = path.resolve('./src/client/pwa/sw.template.js');
// Debug / sandbox pages are local tools and are not part of the installable app.
const PWA_EXCLUDED_PAGES = ['debug.html', 'cards.html'];

class PwaCollectPlugin {
    apply(compiler) {
        // 'emit' (not afterEmit): sources are still readable here, after
        // html-webpack-plugin and BuildVersionPlugin have produced the final HTML.
        compiler.hooks.emit.tap('PwaCollectPlugin', (compilation) => {
            const html = {};
            const assets = [];
            for (const asset of compilation.getAssets()) {
                const name = asset.name.replace(/^\.\//, '');
                assets.push(name);
                if (name.endsWith('.html')) {
                    html[name] = asset.source.source().toString();
                }
            }
            PWA_COLLECTED.set(compiler.options.name, { assets, html });
        });
    }
}

class PwaPlugin {
    constructor(version) {
        this.version = version;
    }

    apply(compiler) {
        const { RawSource } = webpack.sources;
        compiler.hooks.thisCompilation.tap('PwaPlugin', (compilation) => {
            compilation.hooks.processAssets.tap(
                { name: 'PwaPlugin', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
                () => {
                    try {
                        this.emit(compilation, RawSource);
                    } catch (e) {
                        // Report rather than throw: a thrown hook error leaves
                        // webpack-dev-middleware waiting forever on every request.
                        compilation.errors.push(new webpack.WebpackError('PwaPlugin: ' + (e && e.message)));
                    }
                }
            );
        });
    }

    emit(compilation, RawSource) {
        compilation.fileDependencies.add(PWA_SW_TEMPLATE);
        compilation.contextDependencies.add(PWA_ICON_DIR);

        const allAssets = new Set();
        const pages = {};
        for (const name of PWA_SHELL_DEPENDENCIES) {
            const collected = PWA_COLLECTED.get(name);
            if (!collected) {
                compilation.warnings.push(new webpack.WebpackError(`PwaPlugin: no assets collected from '${name}'`));
                continue;
            }
            collected.assets.forEach((a) => allAssets.add(a));
            Object.assign(pages, collected.html);
        }

        const icons = fs.readdirSync(PWA_ICON_DIR).filter((f) => f.endsWith('.png')).sort();
        const own = ['pwa.js', 'manifest.webmanifest', ...icons.map((f) => 'icons/' + f)];

        // Precache = every app page + the same-origin files those pages load.
        // Per-game chunks and media are left to runtime caching in the worker.
        const precache = new Set();
        const cdn = new Map();
        const pageNames = Object.keys(pages).filter((p) => !PWA_EXCLUDED_PAGES.includes(p)).sort();
        for (const page of pageNames) {
            precache.add(page);
            const tagRe = /<(?:script|link)\b[^>]*>/gi;
            let tag;
            while ((tag = tagRe.exec(pages[page]))) {
                const ref = /\b(?:src|href)\s*=\s*["']([^"']+)["']/i.exec(tag[0]);
                if (!ref) { continue; }
                const url = ref[1];
                if (/^(?:https?:)?\/\//i.test(url)) {
                    const abs = url.startsWith('//') ? 'https:' + url : url;
                    let host;
                    try { host = new URL(abs).hostname; } catch (e) { continue; }
                    if (PWA_CDN_HOSTS.includes(host) && !/\brel\s*=\s*["']?(?:preconnect|dns-prefetch)/i.test(tag[0])) {
                        cdn.set(abs, { url: abs, cors: /\bcrossorigin\b/i.test(tag[0]) });
                    }
                    continue;
                }
                if (/^(?:data:|#|mailto:|javascript:)/i.test(url)) { continue; }
                const local = url.split(/[?#]/)[0].replace(/^\.\//, '');
                if (allAssets.has(local) || own.includes(local)) {
                    precache.add(local);
                }
            }
        }
        own.forEach((a) => precache.add(a));

        const hasIndex = pageNames.includes('index.html');
        const swConfig = {
            version: this.version,
            precache: Array.from(precache),
            cdn: Array.from(cdn.values()),
            offlinePage: hasIndex ? 'index.html' : null
        };
        const template = fs.readFileSync(PWA_SW_TEMPLATE, 'utf8');
        compilation.emitAsset('sw.js', new RawSource(
            template.replace('__MP_SW_CONFIG__', JSON.stringify(swConfig, null, 4))
        ));

        const manifest = {
            id: './',
            name: 'Multiplayr',
            short_name: 'Multiplayr',
            description: 'Play board and party games together in the browser.',
            // Relative URLs resolve against the manifest's own URL, so the app works
            // at a domain root and under a GitHub Pages sub-path. Always './': the
            // static build serves index.html there and the Node server redirects
            // '/' to /host. Never point at an extension-less route like './host' —
            // a static host 404s on it whenever the service worker isn't active
            // (first launch of an iOS home-screen app, cleared site data, ...).
            start_url: './',
            scope: './',
            display: 'standalone',
            background_color: '#ece4d3',
            theme_color: '#ece4d3',
            icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
        };
        compilation.emitAsset('manifest.webmanifest', new RawSource(JSON.stringify(manifest, null, 4)));

        for (const icon of icons) {
            compilation.emitAsset('icons/' + icon, new RawSource(fs.readFileSync(path.join(PWA_ICON_DIR, icon))));
        }
    }
}

function PwaConfig(mode, outputPath) {
    return {
        name: 'pwa',
        // Runs after these so PwaPlugin can see what they emitted.
        dependencies: PWA_SHELL_DEPENDENCIES,
        cache: {
            type: 'filesystem',
            name: 'pwa-' + mode,
            buildDependencies: {
                config: [__filename]
            }
        },
        entry: {
            pwa: './src/client/pwa/pwa-client.ts'
        },
        output: {
            path: outputPath || path.resolve(__dirname, './build/client/'),
            publicPath: '',
            pathinfo: false,
            filename: '[name].js'
        },
        target: 'web',
        mode: mode,
        devtool: false,
        module: WebModule(true),
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        plugins: [
            new PwaPlugin(BUILD_VERSION),
            ESLintPluginConfig()
        ]
    };
}

module.exports = (env, argv) => {
    const mode = (argv && argv.mode === 'production' ? 'production' : 'development');
    
    if (env && env.static) {
        const distPath = path.resolve(__dirname, './dist/');
        return [
            MultiplayrLibConfig(mode, distPath),
            HostJoinPages(mode, distPath, true),
            AllRulesConfig(distPath),
            PwaConfig(mode, distPath),
            DebuggerPages(distPath)
        ];
    }

    if (mode === 'production') {
        return [
            MultiplayrLibConfig(mode),
            ExpressServerConfig(mode),
            HostJoinPages(mode),
            AllRulesConfig(),
            PwaConfig(mode)
        ];
    } else {
        return [
            DebuggerPages(),
            MultiplayrLibConfig(mode),
            ExpressServerConfig(mode),
            HostJoinPages(mode),
            AllRulesConfig(),
            PwaConfig(mode)
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
        // Local debugging tools, deliberately unminified; bundle-size hints don't apply.
        performance: { hints: false },
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
            new BuildVersionPlugin(BUILD_VERSION),
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
            new PwaCollectPlugin(),
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
            // Per-game chunks MUST be content-hashed. Numeric chunk ids are reused across
            // builds, so a phone whose service worker still serves the previous build's
            // rules.bundle.js would otherwise fetch the NEW build's "650.bundle.js" from the
            // network for any game it hadn't cached yet, get the wrong modules, and render a
            // blank page. With hashes a stale shell always asks for its own chunks (deploys
            // copy with robocopy /E, so old chunk files stay on the server).
            chunkFilename: '[name].[contenthash:8].bundle.js',
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
            new PwaCollectPlugin(),
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
        optimization: { minimize: mode === 'production' },
        // locallib only backs the local debug page; keep the size budget on lib, which every host/join page loads.
        performance: { assetFilter: (file) => file.endsWith('.js') && !file.startsWith('locallib') },
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
            new PwaCollectPlugin(),
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
