import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ModInfo, ServerData, RimWorldDef, DefConflict, DefReference } from './types.js';
import { DefParser } from './DefParser.js';
import { PatchManager } from './PatchManager.js';

export class CombinedScanner {
    private defParser: DefParser;
    private patchManager: PatchManager;
    private xmlBatchSize: number;

    constructor(xmlBatchSize: number = 8) {
        this.defParser = new DefParser();
        this.patchManager = new PatchManager();
        this.xmlBatchSize = xmlBatchSize;
    }

    async scanModContent(mod: ModInfo, data: ServerData): Promise<void> {
        const defsPath = join(mod.path, 'Defs');
        const patchesPath = join(mod.path, 'Patches');

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseTagValue: false,
            preserveOrder: false
        });

        const tasks: Promise<void>[] = [];

        // Scan both Defs and Patches directories in parallel
        if (await this.pathExists(defsPath)) {
            tasks.push(this.scanDirectory(defsPath, parser, mod, data, 'defs'));
        }

        if (await this.pathExists(patchesPath)) {
            tasks.push(this.scanDirectory(patchesPath, parser, mod, data, 'patches'));
        }

        await Promise.all(tasks);
    }

    private async scanDirectory(
        dir: string, 
        parser: XMLParser, 
        mod: ModInfo, 
        data: ServerData, 
        type: 'defs' | 'patches'
    ): Promise<void> {
        try {
            const entries = await readdir(dir, { withFileTypes: true });

            // Separate directories and XML files
            const directories: string[] = [];
            const xmlFiles: string[] = [];

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    directories.push(fullPath);
                } else if (entry.name.endsWith('.xml')) {
                    xmlFiles.push(fullPath);
                }
            }

            // Process XML files in parallel batches
            const xmlTasks = xmlFiles.map(filePath => 
                this.processXMLFile(filePath, parser, mod, data, type)
            );
            await this.processInBatches(xmlTasks, this.xmlBatchSize);

            // Recursively process subdirectories in parallel
            const dirTasks = directories.map(dirPath => 
                this.scanDirectory(dirPath, parser, mod, data, type)
            );
            await Promise.all(dirTasks);

        } catch (error: any) {
            console.warn(`Failed to scan directory ${dir}:`, error.message);
        }
    }

    private async processXMLFile(
        filePath: string, 
        parser: XMLParser, 
        mod: ModInfo, 
        data: ServerData, 
        type: 'defs' | 'patches'
    ): Promise<void> {
        try {
            const content = await readFile(filePath, 'utf-8');
            const parsed = parser.parse(content);

            if (type === 'defs' && parsed.Defs) {
                // Use DefParser's processDefsFile method directly
                await this.processDefsFile(parsed.Defs, filePath, mod, data);
            } else if (type === 'patches' && parsed.Patch) {
                // Use PatchManager's processPatchFile method directly
                await this.processPatchFile(parsed.Patch, filePath, mod, data);
            }
        } catch (error: any) {
            console.warn(`Failed to parse ${filePath}:`, error.message);
        }
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
                    console.warn('XML processing failed:', result.reason.message);
                }
            }
        }
        
        return results;
    }

    // Delegate to DefParser - we'll need to expose this method
    private async processDefsFile(defsData: any, filePath: string, mod: ModInfo, data: ServerData): Promise<void> {
        // This will be implemented by making DefParser.processDefsFile public
        // For now, we'll call the defParser's scanModDefs which handles this internally
        // But we need to refactor to avoid duplicate file reading
        
        // Temporary solution: duplicate the logic here or expose the method
        for (const [defType, defs] of Object.entries(defsData)) {
            if (typeof defs !== 'object') continue;

            const defArray = Array.isArray(defs) ? defs : [defs];

            for (const def of defArray) {
                if (!def || typeof def !== 'object') continue;

                const defName = def.defName || def['@_Name'];
                const isAbstract = def['@_Abstract'] === 'True' || def.Abstract === 'True';

                if (defName) {
                    const rimDef: RimWorldDef = {
                        defName,
                        type: defType,
                        parent: def['@_ParentName'] || def.ParentName,
                        abstract: isAbstract,
                        content: def,
                        originalContent: null,
                        filePath: filePath.replace(mod.path + '/', ''),
                        mod,
                        outgoingRefs: new Set<DefReference>(),
                        incomingRefs: new Set<DefReference>(),
                        patchHistory: [],
                        conflicts: []
                    };

                    // Check for override conflicts
                    const existing = data.defs.get(defName);
                    if (existing && existing.mod.packageId !== mod.packageId) {
                        const conflict: DefConflict = {
                            type: 'override',
                            severity: 'warning',
                            defName,
                            mods: [existing.mod, mod],
                            description: `${mod.name} overrides ${defName} from ${existing.mod.name}`,
                            resolution: mod.loadOrder > existing.mod.loadOrder
                                ? `${mod.name} wins due to load order`
                                : `${existing.mod.name} wins due to load order`
                        };

                        rimDef.conflicts.push(conflict);
                        data.conflicts.push(conflict);
                    }

                    if (isAbstract) {
                        data.abstractDefs.set(defName, rimDef);
                    }

                    if (!existing || existing.mod.loadOrder < mod.loadOrder) {
                        data.defs.set(defName, rimDef);

                        if (!data.defsByType.has(defType)) {
                            data.defsByType.set(defType, []);
                        }

                        if (existing) {
                            const typeList = data.defsByType.get(defType)!;
                            const index = typeList.findIndex(d => d.defName === defName);
                            if (index !== -1) {
                                typeList.splice(index, 1);
                            }
                        }

                        data.defsByType.get(defType)!.push(rimDef);

                        if (!data.defsByMod.has(mod.packageId)) {
                            data.defsByMod.set(mod.packageId, []);
                        }
                        data.defsByMod.get(mod.packageId)!.push(rimDef);
                    }
                }
            }
        }
    }

    // Delegate to PatchManager - similar approach
    private async processPatchFile(patchData: any, filePath: string, mod: ModInfo, data: ServerData): Promise<void> {
        const operations = patchData.Operation || patchData.operations?.li || [];
        const operationArray = Array.isArray(operations) ? operations : [operations];

        let patchOrder = 0;
        for (const op of operationArray) {
            if (!op) continue;

            const patch = await this.parsePatchOperation(op, filePath, mod, patchOrder++);

            if (!data.patches.has(mod.packageId)) {
                data.patches.set(mod.packageId, []);
            }
            data.patches.get(mod.packageId)!.push(patch);
            data.globalPatches.push(patch);
        }
    }

    private async parsePatchOperation(op: any, filePath: string, mod: ModInfo, order: number) {
        const operationClass = op['@_Class'] || 'PatchOperationReplace';

        const patch: any = {
            id: `${mod.packageId}_${filePath.split('/').pop()}_${order}`,
            mod,
            filePath: filePath.replace(mod.path + '/', ''),
            operation: operationClass.replace('PatchOperation', '') as any,
            xpath: op.xpath || '',
            value: op.value,
            order,
            appliedTo: new Set()
        };

        if (op.mods) {
            patch.conditions = {
                modLoaded: this.parseListField(op.mods)
            };
        }

        if (op.nomods) {
            if (!patch.conditions) patch.conditions = {};
            patch.conditions.modNotLoaded = this.parseListField(op.nomods);
        }

        const patterns = [
            /Defs\/([^\/\[]+)\[defName\s*=\s*["']([^"']+)["']\]/,
            /\/\/([^\/\[]+)\[defName\s*=\s*["']([^"']+)["']\]/,
            /Defs\/([^\/\[]+)\/defName\[text\(\)\s*=\s*["']([^"']+)["']\]/
        ];

        for (const pattern of patterns) {
            const match = patch.xpath.match(pattern);
            if (match) {
                patch.targetDef = match[2];
                break;
            }
        }

        return patch;
    }

    private parseListField(field: any): string[] | undefined {
        if (!field) return undefined;
        if (field.li) {
            return Array.isArray(field.li) ? field.li : [field.li];
        }
        if (Array.isArray(field)) {
            return field;
        }
        return undefined;
    }

    private async pathExists(path: string): Promise<boolean> {
        try {
            const { stat } = await import('fs/promises');
            await stat(path);
            return true;
        } catch {
            return false;
        }
    }
}