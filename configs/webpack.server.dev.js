const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const StartServerPlugin = require('start-server-webpack-plugin');
const ReloadServerPlugin = require('reload-server-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const getLocalIdentPattern = require('./util/css-modules-local-ident');
const configs = require('./app-configs');
const babelConf = require('./babel-server');
const postcssConf = require('./postcss');
const applyOverrides = require('./util/apply-overrides');
const assetsIgnoreBanner = fs.readFileSync(require.resolve('./util/node-assets-ignore'), 'utf8');

// style files regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;

// This is the development configuration.
// It is focused on developer experience and fast rebuilds.
// The production configuration is different and lives in a separate file.
const config = {
    mode: 'development',
    // You may want 'eval' instead if you prefer to see the compiled output in DevTools.
    devtool: 'cheap-module-source-map',
    target: 'node',
    node: {
        __filename: true,
        __dirname: true
    },
    // These are the "entry points" to our application.
    // This means they will be the "root" imports that are included in JS bundle.
    // The first two entry points enable "hot" CSS and auto-refreshes for JS.
    entry: [
        // Finally, this is your app's code:
        configs.serverEntry,
        // We include the app code last so that if there is a runtime error during
        // initialization, it doesn't blow up the WebpackDevServer client, and
        // changing JS code would still trigger a refresh.
    ],
    context: configs.cwd,
    output: {
        // Add /* filename */ comments to generated require()s in the output.
        pathinfo: true,
        path: configs.serverOutputPath,
        publicPath: configs.publicPath,
        filename: configs.serverOutput,
        chunkFilename: '[name].js',
        // Point sourcemap entries to original disk location (format as URL on Windows)
        devtoolModuleFilenameTemplate: info =>
            path
                .relative(configs.appSrc, info.absoluteResourcePath)
                .replace(/\\/g, '/'),
    },
    externals: [nodeExternals({
        whitelist: [/^arui-feather/, /^arui-ft-private/, /^arui-private/, /^alfaform-core-ui/, /^#/]
    })],
    resolve: {
        // This allows you to set a fallback for where Webpack should look for modules.
        // We placed these paths second because we want `node_modules` to "win"
        // if there are any conflicts. This matches Node resolution mechanism.
        // https://github.com/facebookincubator/create-react-app/issues/253
        modules: ['node_modules', configs.appNodeModules],
        // These are the reasonable defaults supported by the Node ecosystem.
        // We also include JSX as a common component filename extension to support
        // some tools, although we do not recommend using it, see:
        // https://github.com/facebookincubator/create-react-app/issues/290
        // `web` extension prefixes have been added for better support
        // for React Native Web.
        extensions: ['.web.js', '.mjs', '.js', '.json', '.web.jsx', '.jsx', '.ts', '.tsx'],
        plugins: [
            new TsconfigPathsPlugin({
                configFile: './tsconfig.json'
            })
        ]
    },
    module: {
        // typescript interface will be removed from modules, and we will get an error on correct code
        // see https://github.com/webpack/webpack/issues/7378
        strictExportPresence: !configs.tsconfig,
        rules: [
            {
                oneOf: [
                    // Process JS with Babel.
                    {
                        test: configs.useTscLoader ? /\.(js|jsx|mjs)$/ : /\.(js|jsx|mjs|ts|tsx)$/,
                        include: configs.appSrc,
                        loader: require.resolve('babel-loader'),
                        options: Object.assign({
                            // This is a feature of `babel-loader` for webpack (not Babel itself).
                            // It enables caching results in ./node_modules/.cache/babel-loader/
                            // directory for faster rebuilds.
                            cacheDirectory: true,
                        }, babelConf),
                    },
                    (configs.tsconfig && configs.useTscLoader) && {
                        test: /\.tsx?$/,
                        use: [
                            {
                                loader: require.resolve('babel-loader'),
                                options: Object.assign({
                                    // This is a feature of `babel-loader` for webpack (not Babel itself).
                                    // It enables caching results in ./node_modules/.cache/babel-loader/
                                    // directory for faster rebuilds.
                                    cacheDirectory: true
                                }, babelConf)
                            },
                            {
                                loader: require.resolve('cache-loader')
                            },
                            {
                                loader: require.resolve('ts-loader'),
                                options: {
                                    onlyCompileBundledFiles: true,
                                    transpileOnly: true,
                                    happyPackMode: true,
                                    configFile: configs.tsconfig
                                }
                            }
                        ]
                    },
                    // replace css imports with empty files
                    {
                        test: cssRegex,
                        exclude: cssModuleRegex,
                        loader: require.resolve('null-loader')
                    },
                    {
                        test: cssModuleRegex,
                        use: [
                            {
                                loader: require.resolve('css-loader/locals'),
                                options: {
                                    modules: true,
                                    localIdentName: getLocalIdentPattern({ isProduction: false })
                                },
                            },
                            {
                                loader: require.resolve('postcss-loader'),
                                options: {
                                    // Necessary for external CSS imports to work
                                    // https://github.com/facebookincubator/create-react-app/issues/2677
                                    ident: 'postcss',
                                    plugins: () => postcssConf,
                                },
                            },
                        ],
                    },
                    // "file" loader makes sure those assets get served by WebpackDevServer.
                    // When you `import` an asset, you get its (virtual) filename.
                    // In production, they would get copied to the `build` folder.
                    // This loader doesn't use a "test" so it will catch all modules
                    // that fall through the other loaders.
                    {
                        // Exclude `js` files to keep "css" loader working as it injects
                        // its runtime that would otherwise processed through "file" loader.
                        // Also exclude `html` and `json` extensions so they get processed
                        // by webpacks internal loaders.
                        exclude: [/\.(js|jsx|mjs|ts|tsx)$/, /\.(html|ejs)$/, /\.json$/],
                        loader: require.resolve('file-loader'),
                        options: {
                            outputPath: configs.publicPath,
                            publicPath: configs.publicPath,
                            name: 'static/media/[name].[hash:8].[ext]',
                        },
                    },
                ].filter(Boolean),
            },
        ],
    },
    plugins: [
        configs.useServerHMR
            ? new StartServerPlugin(configs.serverOutput)
            : new ReloadServerPlugin({ script: path.join(configs.serverOutputPath, configs.serverOutput) }),
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.BannerPlugin({
            banner: assetsIgnoreBanner,
            raw: true,
            entryOnly: false
        }),
        new webpack.BannerPlugin({
            banner: 'require("source-map-support").install();',
            raw: true,
            entryOnly: false
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
        }),
        new webpack.NamedModulesPlugin(),
        // Watcher doesn't work well if you mistype casing in a path so we use
        // a plugin that prints an error when you attempt to do this.
        // See https://github.com/facebookincubator/create-react-app/issues/240
        new CaseSensitivePathsPlugin(),
        // If you require a missing module and then `npm install` it, you still have
        // to restart the development server for Webpack to discover it. This plugin
        // makes the discovery automatic so you don't have to restart.
        // See https://github.com/facebookincubator/create-react-app/issues/186
        new WatchMissingNodeModulesPlugin(configs.appNodeModules),
        configs.tsconfig !== null && new ForkTsCheckerWebpackPlugin(),
    ].filter(Boolean),
    // Turn off performance hints during development because we don't do any
    // splitting or minification in interest of speed. These warnings become
    // cumbersome.
    performance: {
        hints: false,
    },
};

if (configs.useServerHMR) {
    config.entry.unshift(`${require.resolve('webpack/hot/poll')}?1000`);
    config.plugins.push(new webpack.HotModuleReplacementPlugin())
}

module.exports = applyOverrides(['webpack', 'webpackServer', 'webpackDev', 'webpackServerDev'], config);
