import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ModInfo, DefConflict, ServerData } from './types.js';

export class ModLoader {
    private rimworldPath: string;
    private modBatchSize: number;
    private modDirs: string[];

    constructor(rimworldPath: string, modBatchSize: number = 10, modDirs: string[] = []) {
        this.rimworldPath = rimworldPath;
        this.modBatchSize = modBatchSize;
        this.modDirs = modDirs;
    }

    async loadMods(data: ServerData): Promise<void> {
        console.error('Loading Core...');
        const corePath = join(this.rimworldPath, 'Data', 'Core');
        const coreInfo = await this.loadModInfo(corePath, 0, true, false);
        if (coreInfo) {
            data.mods.set('Core', coreInfo);
            data.loadOrder.push('Core');
        }

        console.error('Loading DLCs...');
        const dlcPaths = ['Royalty', 'Ideology', 'Biotech', 'Anomaly'];

        let loadOrderIndex = 1;
        for (const dlc of dlcPaths) {
            const dlcPath = join(this.rimworldPath, 'Data', dlc);
            if (await this.pathExists(dlcPath)) {
                const dlcInfo = await this.loadModInfo(dlcPath, loadOrderIndex++, false, true);
                if (dlcInfo) {
                    data.mods.set(dlc, dlcInfo);
                    data.loadOrder.push(dlc);
                    console.error(`  Loaded DLC: ${dlc}`);
                }
            }
        }

        if (this.modDirs.length > 0) {
            console.error('Loading additional mods...');
            await this.loadAdditionalMods(data, loadOrderIndex);
        } else {
            console.error('No additional mod directories specified');
        }

        console.error('Validating load order...');
        this.validateLoadOrder(data);
    }

    private async loadModInfo(modPath: string, loadOrder: number, isCore: boolean, isDLC: boolean): Promise<ModInfo | null> {
        const aboutPath = join(modPath, 'About', 'About.xml');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseTagValue: false
        });

        try {
            const aboutContent = await readFile(aboutPath, 'utf-8');
            const parsed = parser.parse(aboutContent);
            const modMeta = parsed.ModMetaData || {};

            const modInfo: ModInfo = {
                packageId: modMeta.packageId || modMeta.name?.toLowerCase().replace(/\s/g, '') || basename(modPath),
                name: modMeta.name || basename(modPath),
                author: modMeta.author,
                supportedVersions: this.parseListField(modMeta.supportedVersions),
                loadOrder,
                path: modPath,
                isCore,
                isDLC,
                dependencies: this.parseListField(modMeta.modDependencies)?.map((d: any) =>
                    typeof d === 'string' ? d : d.packageId
                ),
                incompatibleWith: this.parseListField(modMeta.incompatibleWith),
                loadBefore: this.parseListField(modMeta.loadBefore),
                loadAfter: this.parseListField(modMeta.loadAfter)
            };

            return modInfo;
        } catch (error: any) {
            console.warn(`Failed to load About.xml for ${modPath}:`, error.message);
            
            // For core/DLC, we still want to load them even if About.xml is missing
            if (isCore || isDLC) {
                return {
                    packageId: `local.${basename(modPath)}`,
                    name: basename(modPath),
                    loadOrder,
                    path: modPath,
                    isCore,
                    isDLC
                };
            }
            
            // For workshop/local mods, skip if About.xml is missing or invalid
            return null;
        }
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

    private async loadAdditionalMods(data: ServerData, startIndex: number): Promise<void> {
        const loadTasks: Promise<ModInfo | null>[] = [];
        let currentIndex = startIndex;

        // Build list of all mod directories to scan (only specified directories)
        const modDirectoriesToScan: Array<{ path: string; name: string }> = [];

        // Include specified mod directories
        this.modDirs.forEach((dirPath, index) => {
            modDirectoriesToScan.push({ path: dirPath, name: `Mod Directory ${index + 1}` });
        });

        // Scan all directories in parallel
        for (const { path: dirPath, name: dirName } of modDirectoriesToScan) {
            if (await this.pathExists(dirPath)) {
                console.error(`  Scanning ${dirName}: ${dirPath}`);
                const modFolders = await readdir(dirPath, { withFileTypes: true });
                
                for (const folder of modFolders) {
                    if (folder.isDirectory()) {
                        const modPath = join(dirPath, folder.name);
                        loadTasks.push(this.loadModInfo(modPath, currentIndex++, false, false));
                    }
                }
            } else {
                console.error(`  Skipping ${dirName} (not found): ${dirPath}`);
            }
        }

        // Process all mods in parallel with controlled concurrency
        console.error(`  Processing ${loadTasks.length} mod directories...`);
        const results = await this.processInBatches(loadTasks, this.modBatchSize);
        
        let modsLoaded = 0;
        for (const modInfo of results) {
            if (modInfo && !data.mods.has(modInfo.packageId)) {
                data.mods.set(modInfo.packageId, modInfo);
                data.loadOrder.push(modInfo.packageId);
                console.error(`  ✓ Loaded ${modInfo.name} from: ${modInfo.path}`);
                modsLoaded++;
            }
        }
        
        console.error(`  ✓ Loaded ${modsLoaded} additional mods`);
    }

    private async processInBatches<T>(tasks: Promise<T>[], batchSize: number): Promise<T[]> {
        const results: T[] = [];
        
        for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(batch);
            
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    console.warn('Mod loading failed:', result.reason?.message);
                }
            }
        }
        
        return results;
    }

    private validateLoadOrder(data: ServerData): void {
        const issues: DefConflict[] = [];

        for (const [modId, mod] of data.mods.entries()) {
            if (mod.dependencies) {
                for (const dep of mod.dependencies) {
                    if (!data.mods.has(dep)) {
                        issues.push({
                            type: 'missing_dependency',
                            severity: 'error',
                            mods: [mod],
                            description: `${mod.name} requires ${dep} which is not loaded`,
                            resolution: `Install and enable ${dep}`
                        });
                    } else {
                        const depMod = data.mods.get(dep)!;
                        if (depMod.loadOrder > mod.loadOrder) {
                            issues.push({
                                type: 'missing_dependency',
                                severity: 'error',
                                mods: [mod, depMod],
                                description: `${mod.name} requires ${depMod.name} but loads before it`,
                                resolution: `Reorder mods so ${depMod.name} loads before ${mod.name}`
                            });
                        }
                    }
                }
            }

            if (mod.incompatibleWith) {
                for (const incompatId of mod.incompatibleWith) {
                    if (data.mods.has(incompatId)) {
                        const incompatMod = data.mods.get(incompatId)!;
                        issues.push({
                            type: 'override',
                            severity: 'error',
                            mods: [mod, incompatMod],
                            description: `${mod.name} is incompatible with ${incompatMod.name}`,
                            resolution: 'Disable one of these mods'
                        });
                    }
                }
            }

            if (mod.loadAfter) {
                for (const afterId of mod.loadAfter) {
                    if (data.mods.has(afterId)) {
                        const afterMod = data.mods.get(afterId)!;
                        if (afterMod.loadOrder > mod.loadOrder) {
                            issues.push({
                                type: 'override',
                                severity: 'warning',
                                mods: [mod, afterMod],
                                description: `${mod.name} should load after ${afterMod.name} but doesn't`,
                                resolution: `Consider reordering: ${afterMod.name} should come before ${mod.name}`
                            });
                        }
                    }
                }
            }

            if (mod.loadBefore) {
                for (const beforeId of mod.loadBefore) {
                    if (data.mods.has(beforeId)) {
                        const beforeMod = data.mods.get(beforeId)!;
                        if (beforeMod.loadOrder < mod.loadOrder) {
                            issues.push({
                                type: 'override',
                                severity: 'warning',
                                mods: [mod, beforeMod],
                                description: `${mod.name} should load before ${beforeMod.name} but doesn't`,
                                resolution: `Consider reordering: ${mod.name} should come before ${beforeMod.name}`
                            });
                        }
                    }
                }
            }
        }

        data.conflicts.push(...issues);
    }

    private async pathExists(path: string): Promise<boolean> {
        try {
            await stat(path);
            return true;
        } catch {
            return false;
        }
    }
}