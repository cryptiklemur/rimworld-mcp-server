# RimWorld MCP Server

A high-performance MCP (Model Context Protocol) server for analyzing RimWorld XML definitions, patches, and mod interactions.

## Installation

### 🐳 Docker Installation (Recommended)

> **Note:** Docker must be installed on your system

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "rimworld": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "/path/to/your/rimworld:/rimworld:ro",
        "-v", "/path/to/your/workshop:/workshop:ro",
        "ghcr.io/cryptiklemur/rimworld-mcp-server:latest",
        "--rimworld-path=/rimworld",
        "--mod-dirs=/rimworld/Mods,/workshop"
      ]
    }
  }
}
```

<details>
<summary>Manual Installation</summary>

#### 1. Clone the repository

```bash
git clone https://github.com/cryptiklemur/rimworld-mcp-server.git
cd rimworld-mcp-server
```

#### 2. Build the project

```bash
npm install
npm run build
```

#### 3. Configure your AI client

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "rimworld": {
      "command": "node",
      "args": [
        "/path/to/rimworld-mcp-server/dist/index.js",
        "--rimworld-path=/path/to/your/rimworld",
        "--mod-dirs=/path/to/your/rimworld/Mods"
      ]
    }
  }
}
```

</details>

<details>
<summary>Claude Desktop Installation</summary>

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%/Claude/claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "rimworld": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "/path/to/your/rimworld:/rimworld:ro",
        "ghcr.io/cryptiklemur/rimworld-mcp-server:latest",
        "--mod-dirs=/rimworld/Mods"
      ]
    }
  }
}
```

</details>

<details>
<summary>Continue.dev Installation</summary>

Add to your Continue configuration:

```json
{
  "mcpServers": {
    "rimworld": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "/path/to/your/rimworld:/rimworld:ro",
        "ghcr.io/cryptiklemur/rimworld-mcp-server:latest",
        "--mod-dirs=/rimworld/Mods"
      ]
    }
  }
}
```

</details>

## Setup

### Docker (Recommended)

1. **Pull the image:**
   ```bash
   docker pull ghcr.io/cryptiklemur/rimworld-mcp-server:latest
   ```

2. **Run with Docker:**
   ```bash
   docker run -v "/path/to/rimworld:/rimworld:ro" ghcr.io/cryptiklemur/rimworld-mcp-server:latest
   ```

3. **With extra mod directories:**
   ```bash
   docker run \
     -v "/path/to/rimworld:/rimworld:ro" \
     -v "/path/to/workshop:/workshop:ro" \
     ghcr.io/cryptiklemur/rimworld-mcp-server:latest \
     --rimworld-path=/rimworld --extra-mod-dirs=/workshop
   ```

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the server:**
   ```bash
   npm run build
   ```

3. **Run the server:**
   ```bash
   tsx src/index.ts --rimworld-path="/path/to/rimworld"
   ```
   
   Or using Node with the built version:
   ```bash
   node dist/index.js --rimworld-path="/path/to/rimworld"
   ```

## Configuration

The server uses command-line arguments for configuration:

### Required Arguments

- **`--rimworld-path=<path>`** - Path to your RimWorld installation directory
  - Windows Steam: `"C:\Program Files (x86)\Steam\steamapps\common\RimWorld"`
  - Windows Epic: `"C:\Program Files\Epic Games\RimWorld"`
  - Linux Steam: `~/.steam/steam/steamapps/common/RimWorld`
  - macOS Steam: `~/Library/Application\ Support/Steam/steamapps/common/RimWorld`

### Optional Arguments

- **`--mod-dirs=<paths>`** - Comma-separated list of mod directories to scan
- **`--server-name=<name>`** - Server name (default: rimworld-defs)
- **`--server-version=<version>`** - Server version (default: 3.0.0)
- **`--mod-concurrency=<n>`** - Number of mods to process simultaneously (default: 4)
- **`--xml-batch-size=<n>`** - Number of XML files to process in parallel (default: 8)
- **`--mod-batch-size=<n>`** - Number of mods to load in parallel (default: 10)
- **`--log-level=<level>`** - Logging level: debug, info, warn, error (default: info)
- **`--disable-patch-validation`** - Disable patch validation
- **`--disable-conflict-detection`** - Disable conflict detection
- **`--disable-reference-analysis`** - Disable reference analysis
- **`--disable-inheritance-resolution`** - Disable inheritance resolution
- **`--help, -h`** - Show help message

### Examples

```bash
# Basic usage
tsx src/index.ts --rimworld-path="/path/to/rimworld"

# With mod directories
tsx src/index.ts --rimworld-path="/path/to/rimworld" --mod-dirs="/path/to/workshop,/path/to/custom"

# Performance tuning
tsx src/index.ts --rimworld-path="/path/to/rimworld" --mod-concurrency=8 --xml-batch-size=16

# Docker examples
docker run -v "/path/to/rimworld:/rimworld:ro" ghcr.io/cryptiklemur/rimworld-mcp-server:latest --mod-dirs=/rimworld/Mods

# Docker with custom arguments
docker run -v "/path/to/rimworld:/rimworld:ro" -v "/path/to/workshop:/workshop:ro" ghcr.io/cryptiklemur/rimworld-mcp-server:latest --rimworld-path=/rimworld --mod-dirs=/workshop --mod-concurrency=8
```

## Features

- **Parallel Processing**: Optimized for speed with configurable concurrency
- **Mod Loading**: Automatic discovery and loading of Core, DLC, and specified mod directories
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