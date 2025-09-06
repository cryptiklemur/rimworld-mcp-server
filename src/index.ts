import { join } from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ServerData } from './types.js';
import { ModLoader } from './ModLoader.js';
import { DefParser } from './DefParser.js';
import { PatchManager } from './PatchManager.js';
import { CombinedScanner } from './CombinedScanner.js';
import { ReferenceAnalyzer } from './ReferenceAnalyzer.js';
import { ConflictDetector } from './ConflictDetector.js';
import { ToolHandlers } from './ToolHandlers.js';

// Helper function to parse comma-separated paths
function parseModDirectories(dirs: string): string[] {
    if (!dirs || dirs.trim() === '') return [];
    return dirs.split(',').map(path => path.trim()).filter(path => path.length > 0);
}

// Helper function to auto-detect Steam workshop path
function detectSteamWorkshopPath(rimworldPath: string): string {
    if (!rimworldPath) return '';
    return join(rimworldPath, '../../workshop/content/294100');
}

// Command line argument parsing
function parseArgs(): {
    rimworldPath: string;
    extraModDirs: string[];
    steamWorkshopPath?: string;
    serverName: string;
    serverVersion: string;
    serverDescription: string;
    modConcurrency: number;
    xmlBatchSize: number;
    modBatchSize: number;
    logLevel: string;
    enablePatchValidation: boolean;
    enableConflictDetection: boolean;
    enableReferenceAnalysis: boolean;
    enableInheritanceResolution: boolean;
} {
    const args = process.argv.slice(2);
    let rimworldPath = '';
    let extraModDirs: string[] = [];
    let steamWorkshopPath = '';
    
    // Default configuration
    const config = {
        rimworldPath: '',
        extraModDirs: [] as string[],
        steamWorkshopPath: '',
        serverName: 'rimworld-defs',
        serverVersion: '3.0.0',
        serverDescription: 'MCP server for RimWorld XML definitions with full mod and patch support',
        modConcurrency: 4,
        xmlBatchSize: 8,
        modBatchSize: 10,
        logLevel: 'info',
        enablePatchValidation: true,
        enableConflictDetection: true,
        enableReferenceAnalysis: true,
        enableInheritanceResolution: true
    };
    
    for (const arg of args) {
        if (arg.startsWith('--rimworld-path=')) {
            config.rimworldPath = arg.substring('--rimworld-path='.length);
        } else if (arg.startsWith('--extra-mod-dirs=')) {
            config.extraModDirs = parseModDirectories(arg.substring('--extra-mod-dirs='.length));
        } else if (arg.startsWith('--steam-workshop-path=')) {
            config.steamWorkshopPath = arg.substring('--steam-workshop-path='.length);
        } else if (arg.startsWith('--server-name=')) {
            config.serverName = arg.substring('--server-name='.length);
        } else if (arg.startsWith('--server-version=')) {
            config.serverVersion = arg.substring('--server-version='.length);
        } else if (arg.startsWith('--mod-concurrency=')) {
            config.modConcurrency = parseInt(arg.substring('--mod-concurrency='.length));
        } else if (arg.startsWith('--xml-batch-size=')) {
            config.xmlBatchSize = parseInt(arg.substring('--xml-batch-size='.length));
        } else if (arg.startsWith('--mod-batch-size=')) {
            config.modBatchSize = parseInt(arg.substring('--mod-batch-size='.length));
        } else if (arg.startsWith('--log-level=')) {
            config.logLevel = arg.substring('--log-level='.length);
        } else if (arg === '--disable-patch-validation') {
            config.enablePatchValidation = false;
        } else if (arg === '--disable-conflict-detection') {
            config.enableConflictDetection = false;
        } else if (arg === '--disable-reference-analysis') {
            config.enableReferenceAnalysis = false;
        } else if (arg === '--disable-inheritance-resolution') {
            config.enableInheritanceResolution = false;
        } else if (arg === '--help' || arg === '-h') {
            console.error('RimWorld MCP Server');
            console.error('');
            console.error('Usage: tsx src/index.ts --rimworld-path=<path> [options]');
            console.error('');
            console.error('Required:');
            console.error('  --rimworld-path=<path>           Path to RimWorld installation');
            console.error('');
            console.error('Optional:');
            console.error('  --extra-mod-dirs=<paths>         Comma-separated list of additional mod directories');
            console.error('  --steam-workshop-path=<path>     Override Steam workshop path (auto-detected if not specified)');
            console.error('  --server-name=<name>             Server name (default: rimworld-defs)');
            console.error('  --server-version=<version>       Server version (default: 3.0.0)');
            console.error('  --mod-concurrency=<n>            Number of mods to process simultaneously (default: 4)');
            console.error('  --xml-batch-size=<n>             Number of XML files to process in parallel (default: 8)');
            console.error('  --mod-batch-size=<n>             Number of mods to load in parallel (default: 10)');
            console.error('  --log-level=<level>              Logging level: debug, info, warn, error (default: info)');
            console.error('  --disable-patch-validation       Disable patch validation');
            console.error('  --disable-conflict-detection     Disable conflict detection');
            console.error('  --disable-reference-analysis     Disable reference analysis');
            console.error('  --disable-inheritance-resolution Disable inheritance resolution');
            console.error('  --help, -h                       Show this help message');
            console.error('');
            console.error('Examples:');
            console.error('  tsx src/index.ts --rimworld-path="/path/to/rimworld"');
            console.error('  tsx src/index.ts --rimworld-path="/path/to/rimworld" --extra-mod-dirs="/path/to/workshop,/path/to/custom"');
            process.exit(0);
        }
    }
    
    // Auto-detect Steam workshop path if not specified
    if (!config.steamWorkshopPath && config.rimworldPath) {
        config.steamWorkshopPath = detectSteamWorkshopPath(config.rimworldPath);
    }
    
    return config;
}

const config = parseArgs();

class RimWorldDefsServer {
    private server: Server;
    private data: ServerData;
    private modLoader: ModLoader;
    private defParser: DefParser;
    private patchManager: PatchManager;
    private combinedScanner: CombinedScanner;
    private referenceAnalyzer: ReferenceAnalyzer;
    private conflictDetector: ConflictDetector;
    private toolHandlers: ToolHandlers;
    private rimworldPath: string;

    constructor(rimworldPath: string) {
        this.rimworldPath = rimworldPath;
        
        this.data = {
            defs: new Map(),
            defsByType: new Map(),
            defsByMod: new Map(),
            mods: new Map(),
            referenceGraph: new Map(),
            patches: new Map(),
            globalPatches: [],
            conflicts: [],
            loadOrder: [],
            abstractDefs: new Map()
        };

        this.modLoader = new ModLoader(rimworldPath, config.modBatchSize, config.extraModDirs, config.steamWorkshopPath);
        this.defParser = new DefParser();
        this.patchManager = new PatchManager();
        this.combinedScanner = new CombinedScanner(config.xmlBatchSize);
        this.referenceAnalyzer = new ReferenceAnalyzer();
        this.conflictDetector = new ConflictDetector();
        this.toolHandlers = new ToolHandlers(this.data);

        this.server = new Server(
            {
                name: config.serverName,
                version: config.serverVersion,
                description: config.serverDescription
            },
            {
                capabilities: {
                    tools: {},
                    resources: {}
                }
            }
        );

        this.setupTools();
    }

    private setupTools(): void {
        this.toolHandlers.setupTools(this.server);
    }

    private async processInBatches<T>(tasks: Promise<T>[], batchSize: number): Promise<T[]> {
        const results: T[] = [];
        
        for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(batch);
            
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else if (result.reason) {
                    console.warn('Mod scanning failed:', result.reason.message);
                }
            }
        }
        
        return results;
    }

    async start(): Promise<void> {
        try {
            console.error('='.repeat(60));
            console.error(`${config.serverName.toUpperCase()} v${config.serverVersion}`);
            console.error('='.repeat(60));

            console.error('\n📁 Loading mods...');
            await this.modLoader.loadMods(this.data);
            console.error(`   ✓ Loaded ${this.data.mods.size} mods`);

            console.error('\n📄 Scanning defs and patches...');
            
            // Process all mods in parallel with controlled concurrency
            const modScanTasks = Array.from(this.data.mods.values()).map(mod => 
                this.combinedScanner.scanModContent(mod, this.data)
            );
            
            await this.processInBatches(modScanTasks, config.modConcurrency);
            
            console.error(`   ✓ Found ${this.data.defs.size} defs`);
            console.error(`   ✓ Found ${this.data.globalPatches.length} patches`);

            console.error('\n🔧 Applying patches...');
            this.patchManager.applyPatches(this.data);
            const successfulPatches = this.data.globalPatches.filter(p => p.success === true).length;
            console.error(`   ✓ Applied ${successfulPatches}/${this.data.globalPatches.length} patches`);

            if (config.enableInheritanceResolution) {
                console.error('\n🧬 Resolving inheritance...');
                this.referenceAnalyzer.resolveInheritance(this.data);
                console.error('   ✓ Inheritance resolved');
            }

            if (config.enableReferenceAnalysis) {
                console.error('\n🔗 Building reference graph...');
                this.referenceAnalyzer.extractReferences(this.data);
                console.error(`   ✓ Found ${this.data.referenceGraph.size} defs with references`);
            }

            if (config.enableConflictDetection) {
                console.error('\n⚠️  Detecting conflicts...');
                this.conflictDetector.detectCircularDependencies(this.data);
                console.error(`   ✓ Found ${this.data.conflicts.length} potential conflicts`);
            }

            console.error('\n' + '='.repeat(60));
            console.error('Summary:');
            console.error(`  • Mods: ${this.data.mods.size}`);
            console.error(`  • Defs: ${this.data.defs.size}`);
            console.error(`  • Patches: ${successfulPatches}/${this.data.globalPatches.length} successful`);
            console.error(`  • Conflicts: ${this.data.conflicts.length}`);
            console.error('='.repeat(60));

            console.error('\n🚀 Starting MCP server...');
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error('✓ Server ready!\n');

        } catch (error: any) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
}

// ============================================================================
// Entry Point
// ============================================================================

if (!config.rimworldPath) {
    console.error('❌ --rimworld-path argument is required!');
    console.error('');
    console.error('Usage: tsx src/index.ts --rimworld-path=<path>');
    console.error('');
    console.error('Common paths:');
    console.error('  Windows Steam: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\RimWorld"');
    console.error('  Windows Epic:  "C:\\Program Files\\Epic Games\\RimWorld"');
    console.error('  Linux Steam:   ~/.steam/steam/steamapps/common/RimWorld');
    console.error('  macOS Steam:   ~/Library/Application\\ Support/Steam/steamapps/common/RimWorld');
    console.error('');
    console.error('Examples:');
    console.error('  tsx src/index.ts --rimworld-path="/path/to/rimworld"');
    console.error('  tsx src/index.ts --rimworld-path="/path/to/rimworld" --extra-mod-dirs="/workshop,/custom"');
    console.error('');
    console.error('Use --help for full options list');
    process.exit(1);
}

const server = new RimWorldDefsServer(config.rimworldPath);

// Graceful shutdown handling for development
process.on('SIGINT', () => {
    console.error('\n🛑 Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.error('\n🛑 Shutting down server...');
    process.exit(0);
});

server.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});