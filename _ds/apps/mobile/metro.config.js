const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Monorepo aware: watch the shared @illuminate/tokens package and resolve
// dependencies from both the app and the repo root.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
