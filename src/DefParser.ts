import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ModInfo, RimWorldDef, DefConflict, ServerData } from './types.js';

export class DefParser {
    async scanModDefs(mod: ModInfo, data: ServerData): Promise<void> {
        const defsPath = join(mod.path, 'Defs');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseTagValue: false,
            preserveOrder: false
        });

        if (await this.pathExists(defsPath)) {
            await this.scanDirectory(defsPath, parser, mod, data);
        }
    }

    private async scanDirectory(dir: string, parser: XMLParser, mod: ModInfo, data: ServerData): Promise<void> {
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
            const xmlTasks = xmlFiles.map(filePath => this.processXMLFile(filePath, parser, mod, data));
            await this.processInBatches(xmlTasks, 5);

            // Recursively process subdirectories in parallel
            const dirTasks = directories.map(dirPath => this.scanDirectory(dirPath, parser, mod, data));
            await Promise.all(dirTasks);

        } catch (error: any) {
            console.warn(`Failed to scan directory ${dir}:`, error.message);
        }
    }

    private async processXMLFile(filePath: string, parser: XMLParser, mod: ModInfo, data: ServerData): Promise<void> {
        try {
            const content = await readFile(filePath, 'utf-8');
            const parsed = parser.parse(content);

            if (parsed.Defs) {
                await this.processDefsFile(parsed.Defs, filePath, mod, data);
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

    private async processDefsFile(defsData: any, filePath: string, mod: ModInfo, data: ServerData): Promise<void> {
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
                        filePath: relative(mod.path, filePath),
                        mod,
                        outgoingRefs: new Set(),
                        incomingRefs: new Set(),
                        patchHistory: [],
                        conflicts: []
                    };

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