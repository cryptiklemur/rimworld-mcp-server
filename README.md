# RimWorld MCP Server

A high-performance MCP (Model Context Protocol) server for analyzing RimWorld XML definitions, patches, and mod interactions.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy `.env.example` to `.env` and set your RimWorld path:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file:**
   ```bash
   # Required: Set your RimWorld installation path
   RIMWORLD_PATH=/path/to/your/rimworld/installation
   ```

4. **Build the server:**
   ```bash
   npm run build
   ```

5. **Run the server:**
   ```bash
   node dist/index.js
   ```

## Configuration

The server uses environment variables for configuration. All settings can be customized in your `.env` file:

### Required Settings

- **`RIMWORLD_PATH`** - Path to your RimWorld installation directory
  - Windows Steam: `C:\Program Files (x86)\Steam\steamapps\common\RimWorld`
  - Windows Epic: `C:\Program Files\Epic Games\RimWorld`
  - Linux Steam: `~/.steam/steam/steamapps/common/RimWorld`
  - macOS Steam: `~/Library/Application Support/Steam/steamapps/common/RimWorld`

### Performance Settings

- **`MOD_CONCURRENCY=4`** - Number of mods to process simultaneously
- **`XML_BATCH_SIZE=8`** - Number of XML files to process in parallel per mod
- **`MOD_BATCH_SIZE=10`** - Number of mods to load in parallel during discovery

### Server Configuration

- **`SERVER_NAME=rimworld-defs`** - Server name
- **`SERVER_VERSION=3.0.0`** - Server version
- **`SERVER_DESCRIPTION=...`** - Server description

### Feature Toggles

- **`ENABLE_PATCH_VALIDATION=true`** - Enable patch validation
- **`ENABLE_CONFLICT_DETECTION=true`** - Enable conflict detection
- **`ENABLE_REFERENCE_ANALYSIS=true`** - Enable reference graph building
- **`ENABLE_INHERITANCE_RESOLUTION=true`** - Enable def inheritance resolution

### Logging

- **`LOG_LEVEL=info`** - Logging level (debug, info, warn, error)

## Features

- **Parallel Processing**: Optimized for speed with configurable concurrency
- **Mod Loading**: Automatic discovery and loading of Core, DLC, Workshop, and Local mods
- **Definition Parsing**: Full XML definition parsing with type categorization
- **Patch System**: Complete patch application with conflict detection
- **Reference Analysis**: Dependency graph building and circular dependency detection
- **Conflict Detection**: Comprehensive mod conflict analysis
- **Inheritance Resolution**: Parent-child definition resolution

## Tools Available

The MCP server provides the following tools:

- `getDef` - Get specific definition by name
- `getDefsByType` - Get all definitions of a specific type
- `searchDefs` - Search definitions by content
- `getDefsByMod` - Get all definitions from a specific mod
- `getReferences` - Get reference information for a definition
- `getDependencyChain` - Get dependency chain for a definition
- `getPatchHistory` - Get patch history for a definition
- `getConflicts` - Get conflict information
- `getPatchCoverage` - Get patch coverage for a mod
- `simulateModRemoval` - Simulate the impact of removing a mod
- `suggestLoadOrder` - Get load order suggestions
- `getModList` - Get list of all loaded mods
- `getStatistics` - Get server statistics

## Performance

The server is optimized for large mod collections:
- **Parallel mod loading**: Up to 10x faster for many mods
- **Parallel XML processing**: 5-8x faster per mod
- **Combined scanning**: 50% reduction in file system operations
- **Configurable concurrency**: Tunable for your system

## Development

Build the project:
```bash
npm run build
```

The compiled JavaScript will be in the `dist/` directory.