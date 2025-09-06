import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ModInfo, ServerData } from './types.js';

export class ToolHandlers {
    private data: ServerData;

    constructor(data: ServerData) {
        this.data = data;
    }

    setupTools(server: Server): void {
        server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'getDef',
                    description: 'Get a specific definition by name',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            defName: { type: 'string', description: 'Name of the definition to retrieve' }
                        },
                        required: ['defName']
                    }
                },
                {
                    name: 'getDefsByType',
                    description: 'Get all definitions of a specific type',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            defType: { type: 'string', description: 'Type of definitions to retrieve' },
                            detailed: { type: 'boolean', description: 'Return detailed information' }
                        },
                        required: ['defType']
                    }
                },
                {
                    name: 'searchDefs',
                    description: 'Search definitions by content',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' },
                            limit: { type: 'number', description: 'Maximum results to return' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'getDefsByMod',
                    description: 'Get all definitions from a specific mod',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            modId: { type: 'string', description: 'Mod package ID' },
                            detailed: { type: 'boolean', description: 'Return detailed information' }
                        },
                        required: ['modId']
                    }
                },
                {
                    name: 'getReferences',
                    description: 'Get reference information for a definition',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            defName: { type: 'string', description: 'Definition name' }
                        },
                        required: ['defName']
                    }
                },
                {
                    name: 'getDependencyChain',
                    description: 'Get dependency chain for a definition',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            defName: { type: 'string', description: 'Definition name' },
                            maxDepth: { type: 'number', description: 'Maximum depth to traverse' },
                            referenceTypes: { type: 'array', items: { type: 'string' }, description: 'Types of references to follow' }
                        },
                        required: ['defName']
                    }
                },
                {
                    name: 'getPatchHistory',
                    description: 'Get patch history for a definition',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            defName: { type: 'string', description: 'Definition name' },
                            includeValues: { type: 'boolean', description: 'Include patch values' },
                            includeContent: { type: 'boolean', description: 'Include content' }
                        },
                        required: ['defName']
                    }
                },
                {
                    name: 'getConflicts',
                    description: 'Get conflict information',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            modId: { type: 'string', description: 'Filter by mod ID' },
                            severity: { type: 'string', description: 'Filter by severity' },
                            type: { type: 'string', description: 'Filter by conflict type' }
                        }
                    }
                },
                {
                    name: 'getPatchCoverage',
                    description: 'Get patch coverage for a mod',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            modId: { type: 'string', description: 'Mod package ID' },
                            includeDefNames: { type: 'boolean', description: 'Include def names' },
                            detailed: { type: 'boolean', description: 'Include detailed patch info' }
                        },
                        required: ['modId']
                    }
                },
                {
                    name: 'simulateModRemoval',
                    description: 'Simulate the impact of removing a mod',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            modId: { type: 'string', description: 'Mod package ID' }
                        },
                        required: ['modId']
                    }
                },
                {
                    name: 'suggestLoadOrder',
                    description: 'Get load order suggestions',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'getModList',
                    description: 'Get list of all loaded mods',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'getStatistics',
                    description: 'Get server statistics',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                }
            ]
        }));

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            
            try {
                let result;
                switch (name) {
                    case 'getDef':
                        result = this.handleGetDef(args as any);
                        break;
                    case 'getDefsByType':
                        result = this.handleGetDefsByType(args as any);
                        break;
                    case 'searchDefs':
                        result = this.handleSearchDefs(args as any);
                        break;
                    case 'getDefsByMod':
                        result = this.handleGetDefsByMod(args as any);
                        break;
                    case 'getReferences':
                        result = this.handleGetReferences(args as any);
                        break;
                    case 'getDependencyChain':
                        result = this.handleGetDependencyChain(args as any);
                        break;
                    case 'getPatchHistory':
                        result = this.handleGetPatchHistory(args as any);
                        break;
                    case 'getConflicts':
                        result = this.handleGetConflicts(args as any);
                        break;
                    case 'getPatchCoverage':
                        result = this.handleGetPatchCoverage(args as any);
                        break;
                    case 'simulateModRemoval':
                        result = this.handleSimulateModRemoval(args as any);
                        break;
                    case 'suggestLoadOrder':
                        result = this.handleSuggestLoadOrder(args as any);
                        break;
                    case 'getModList':
                        result = this.handleGetModList(args as any);
                        break;
                    case 'getStatistics':
                        result = this.handleGetStatistics(args as any);
                        break;
                    default:
                        result = { error: `Unknown tool: ${name}` };
                }

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error: ${error.message}`
                    }],
                    isError: true
                };
            }
        });
    }

    private handleGetDef(params: any) {
        const def = this.data.defs.get(params.defName) || this.data.abstractDefs.get(params.defName);
        if (!def) {
            return { error: `Def '${params.defName}' not found` };
        }

        return {
            defName: def.defName,
            type: def.type,
            mod: def.mod.name,
            abstract: def.abstract,
            parent: def.parent,
            filePath: def.filePath,
            content: def.content,
            originalContent: def.originalContent,
            outgoingRefs: Array.from(def.outgoingRefs),
            incomingRefs: Array.from(def.incomingRefs),
            patchHistory: def.patchHistory.map(p => ({
                mod: p.mod.name,
                operation: p.operation,
                xpath: p.xpath,
                success: p.success
            })),
            conflicts: def.conflicts
        };
    }

    private handleGetDefsByType(params: any) {
        const defs = this.data.defsByType.get(params.defType) || [];
        return {
            type: params.defType,
            count: defs.length,
            defs: params.detailed
                ? defs.map(d => ({
                    defName: d.defName,
                    mod: d.mod.name,
                    abstract: d.abstract,
                    parent: d.parent
                }))
                : defs.map(d => d.defName)
        };
    }

    private handleSearchDefs(params: any) {
        const results = [];
        const searchTerm = params.query.toLowerCase();
        const limit = params.limit || 20;

        for (const def of this.data.defs.values()) {
            if (JSON.stringify(def.content).toLowerCase().includes(searchTerm)) {
                results.push(def);
                if (results.length >= limit) break;
            }
        }

        return {
            query: params.query,
            count: results.length,
            results: results.map(d => ({
                defName: d.defName,
                type: d.type,
                mod: d.mod.name,
                matches: this.findMatches(d.content, searchTerm)
            }))
        };
    }

    private handleGetDefsByMod(params: any) {
        const mod = this.data.mods.get(params.modId);
        if (!mod) {
            return { error: `Mod '${params.modId}' not found` };
        }

        const defs = this.data.defsByMod.get(params.modId) || [];
        return {
            mod: {
                packageId: mod.packageId,
                name: mod.name,
                author: mod.author,
                loadOrder: mod.loadOrder,
                isCore: mod.isCore,
                isDLC: mod.isDLC
            },
            count: defs.length,
            defs: params.detailed
                ? defs.map(d => ({
                    defName: d.defName,
                    type: d.type,
                    parent: d.parent
                }))
                : defs.map(d => d.defName)
        };
    }

    private handleGetReferences(params: any) {
        const def = this.data.defs.get(params.defName);
        if (!def) return { error: 'Def not found' };

        return {
            defName: params.defName,
            mod: def.mod.name,
            outgoing: Array.from(def.outgoingRefs).map(ref => ({
                to: ref.toDef,
                type: ref.referenceType,
                path: ref.path,
                toMod: (this.data.defs.get(ref.toDef) || this.data.abstractDefs.get(ref.toDef))?.mod.name
            })),
            incoming: Array.from(def.incomingRefs).map(ref => ({
                from: ref.fromDef,
                type: ref.referenceType,
                path: ref.path,
                fromMod: this.data.defs.get(ref.fromDef)?.mod.name
            }))
        };
    }

    private handleGetDependencyChain(params: any) {
        const visited = new Set<string>();
        const chain: any[] = [];

        const traverse = (defName: string, depth: number = 0) => {
            if (visited.has(defName) || depth > (params.maxDepth || 10)) return;
            visited.add(defName);

            const def = this.data.defs.get(defName) || this.data.abstractDefs.get(defName);
            if (!def) return;

            const node = {
                defName,
                mod: def.mod.name,
                type: def.type,
                depth,
                dependencies: [] as string[]
            };

            for (const ref of def.outgoingRefs) {
                if (!params.referenceTypes || params.referenceTypes.includes(ref.referenceType)) {
                    node.dependencies.push(ref.toDef);
                    traverse(ref.toDef, depth + 1);
                }
            }

            chain.push(node);
        };

        traverse(params.defName);
        return { defName: params.defName, chain };
    }

    private handleGetPatchHistory(params: any) {
        const def = this.data.defs.get(params.defName);
        if (!def) return { error: 'Def not found' };

        return {
            defName: params.defName,
            mod: def.mod.name,
            hasOriginal: def.originalContent !== null,
            patchCount: def.patchHistory.length,
            patches: def.patchHistory.map(p => ({
                mod: p.mod.name,
                operation: p.operation,
                xpath: p.xpath,
                value: params.includeValues ? p.value : undefined,
                success: p.success,
                error: p.error,
                conditions: p.conditions
            })),
            originalContent: params.includeContent ? def.originalContent : undefined,
            currentContent: params.includeContent ? def.content : undefined
        };
    }

    private handleGetConflicts(params: any) {
        let conflicts = [...this.data.conflicts];

        if (params.modId) {
            conflicts = conflicts.filter(c =>
                c.mods.some(m => m.packageId === params.modId)
            );
        }

        if (params.severity) {
            conflicts = conflicts.filter(c => c.severity === params.severity);
        }

        if (params.type) {
            conflicts = conflicts.filter(c => c.type === params.type);
        }

        return {
            count: conflicts.length,
            conflicts: conflicts.map(c => ({
                type: c.type,
                severity: c.severity,
                defName: c.defName,
                xpath: c.xpath,
                mods: c.mods.map(m => m.name),
                description: c.description,
                resolution: c.resolution
            }))
        };
    }

    private handleGetPatchCoverage(params: any) {
        const modPatches = this.data.patches.get(params.modId) || [];

        const successful = modPatches.filter(p => p.success === true).length;
        const failed = modPatches.filter(p => p.success === false).length;
        const conditional = modPatches.filter(p => p.conditions).length;

        const targetedDefs = new Set<string>();
        for (const patch of modPatches) {
            if (patch.appliedTo) {
                patch.appliedTo.forEach(def => targetedDefs.add(def));
            }
        }

        return {
            mod: this.data.mods.get(params.modId)?.name,
            totalPatches: modPatches.length,
            successful,
            failed,
            conditional,
            defsModified: targetedDefs.size,
            modifiedDefs: params.includeDefNames ? Array.from(targetedDefs) : undefined,
            patches: params.detailed ? modPatches.map(p => ({
                operation: p.operation,
                xpath: p.xpath,
                targetDef: p.targetDef,
                success: p.success,
                error: p.error
            })) : undefined
        };
    }

    private handleSimulateModRemoval(params: any) {
        const mod = this.data.mods.get(params.modId);
        if (!mod) return { error: 'Mod not found' };

        const impacts = {
            mod: mod.name,
            defsRemoved: [] as string[],
            defsModified: [] as string[],
            brokenReferences: [] as any[],
            patchesLost: [] as any[]
        };

        const modDefs = this.data.defsByMod.get(params.modId) || [];
        impacts.defsRemoved = modDefs.map(d => d.defName);

        for (const defName of impacts.defsRemoved) {
            const def = this.data.defs.get(defName);
            if (def) {
                for (const ref of def.incomingRefs) {
                    impacts.brokenReferences.push({
                        from: ref.fromDef,
                        to: defName,
                        type: ref.referenceType,
                        fromMod: this.data.defs.get(ref.fromDef)?.mod.name
                    });
                }
            }
        }

        const modPatches = this.data.patches.get(params.modId) || [];
        for (const patch of modPatches) {
            if (patch.appliedTo) {
                for (const defName of patch.appliedTo) {
                    if (!impacts.defsModified.includes(defName)) {
                        impacts.defsModified.push(defName);
                    }
                    impacts.patchesLost.push({
                        def: defName,
                        operation: patch.operation,
                        xpath: patch.xpath
                    });
                }
            }
        }

        return impacts;
    }

    private handleSuggestLoadOrder(params: any) {
        const suggestions = [];

        for (const [modId, mod] of this.data.mods.entries()) {
            const score = this.calculateLoadOrderScore(mod);
            suggestions.push({
                packageId: mod.packageId,
                name: mod.name,
                currentOrder: mod.loadOrder,
                suggestedOrder: score,
                reason: this.getLoadOrderReason(mod),
                conflicts: this.data.conflicts.filter(c =>
                    c.mods.some(m => m.packageId === modId)
                ).length
            });
        }

        suggestions.sort((a, b) => a.suggestedOrder - b.suggestedOrder);

        return {
            suggestions,
            hasConflicts: this.data.conflicts.length > 0,
            conflictCount: this.data.conflicts.length
        };
    }

    private handleGetModList(params: any) {
        const mods = Array.from(this.data.mods.values())
            .sort((a, b) => a.loadOrder - b.loadOrder)
            .map(mod => ({
                packageId: mod.packageId,
                name: mod.name,
                author: mod.author,
                loadOrder: mod.loadOrder,
                isCore: mod.isCore,
                isDLC: mod.isDLC,
                defCount: (this.data.defsByMod.get(mod.packageId) || []).length,
                patchCount: (this.data.patches.get(mod.packageId) || []).length
            }));

        return {
            count: mods.length,
            mods
        };
    }

    private handleGetStatistics(params: any) {
        const stats = {
            totalMods: this.data.mods.size,
            totalDefs: this.data.defs.size,
            totalAbstractDefs: this.data.abstractDefs.size,
            totalPatches: this.data.globalPatches.length,
            successfulPatches: this.data.globalPatches.filter(p => p.success === true).length,
            failedPatches: this.data.globalPatches.filter(p => p.success === false).length,
            totalConflicts: this.data.conflicts.length,
            conflictsByType: {} as Record<string, number>,
            defsByType: {} as Record<string, number>,
            modsWithPatches: this.data.patches.size,
            totalReferences: 0
        };

        for (const conflict of this.data.conflicts) {
            stats.conflictsByType[conflict.type] = (stats.conflictsByType[conflict.type] || 0) + 1;
        }

        for (const [type, defs] of this.data.defsByType.entries()) {
            stats.defsByType[type] = defs.length;
        }

        for (const refs of this.data.referenceGraph.values()) {
            stats.totalReferences += refs.size;
        }

        return stats;
    }

    private findMatches(obj: any, searchTerm: string): string[] {
        const matches: string[] = [];
        const search = (o: any, path: string = '') => {
            if (!o) return;

            if (typeof o === 'string' && o.toLowerCase().includes(searchTerm)) {
                matches.push(path || 'value');
            } else if (Array.isArray(o)) {
                o.forEach((item, i) => search(item, `${path}[${i}]`));
            } else if (typeof o === 'object') {
                Object.entries(o).forEach(([key, value]) => {
                    search(value, path ? `${path}.${key}` : key);
                });
            }
        };

        search(obj);
        return matches.slice(0, 5);
    }

    private calculateLoadOrderScore(mod: ModInfo): number {
        let score = mod.isCore ? 0 : mod.isDLC ? 100 : 1000;

        if (mod.dependencies) {
            for (const dep of mod.dependencies) {
                const depMod = this.data.mods.get(dep);
                if (depMod) {
                    score = Math.max(score, this.calculateLoadOrderScore(depMod) + 1);
                }
            }
        }

        return score;
    }

    private getLoadOrderReason(mod: ModInfo): string {
        if (mod.isCore) return 'Core must load first';
        if (mod.isDLC) return 'DLC should load after Core';
        if (mod.dependencies?.length) {
            return `Depends on: ${mod.dependencies.join(', ')}`;
        }
        if (mod.loadAfter?.length) {
            return `Prefers to load after: ${mod.loadAfter.join(', ')}`;
        }
        return 'No specific requirements';
    }
}