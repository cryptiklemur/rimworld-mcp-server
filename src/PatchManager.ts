import { readdir, readFile } from 'fs/promises';
import { join, relative, basename } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ModInfo, PatchOperation, RimWorldDef, DefConflict, ServerData } from './types.js';

export class PatchManager {
    async scanModPatches(mod: ModInfo, data: ServerData): Promise<void> {
        const patchesPath = join(mod.path, 'Patches');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseTagValue: false,
            preserveOrder: false
        });

        if (await this.pathExists(patchesPath)) {
            await this.scanPatchDirectory(patchesPath, parser, mod, data);
        }
    }

    private async scanPatchDirectory(dir: string, parser: XMLParser, mod: ModInfo, data: ServerData): Promise<void> {
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
            const xmlTasks = xmlFiles.map(filePath => this.processPatchXMLFile(filePath, parser, mod, data));
            await this.processInBatches(xmlTasks, 5);

            // Recursively process subdirectories in parallel
            const dirTasks = directories.map(dirPath => this.scanPatchDirectory(dirPath, parser, mod, data));
            await Promise.all(dirTasks);

        } catch (error: any) {
            console.warn(`Failed to scan directory ${dir}:`, error.message);
        }
    }

    private async processPatchXMLFile(filePath: string, parser: XMLParser, mod: ModInfo, data: ServerData): Promise<void> {
        try {
            const content = await readFile(filePath, 'utf-8');
            const parsed = parser.parse(content);

            if (parsed.Patch) {
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
                    console.warn('Patch processing failed:', result.reason.message);
                }
            }
        }
        
        return results;
    }

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

    private async parsePatchOperation(op: any, filePath: string, mod: ModInfo, order: number): Promise<PatchOperation> {
        const operationClass = op['@_Class'] || 'PatchOperationReplace';

        const patch: PatchOperation = {
            id: `${mod.packageId}_${basename(filePath)}_${order}`,
            mod,
            filePath: relative(mod.path, filePath),
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

    applyPatches(data: ServerData): void {
        console.error(`Applying ${data.globalPatches.length} patches...`);

        data.globalPatches.sort((a, b) => {
            if (a.mod.loadOrder !== b.mod.loadOrder) {
                return a.mod.loadOrder - b.mod.loadOrder;
            }
            return a.order - b.order;
        });

        for (const patch of data.globalPatches) {
            if (!this.checkPatchConditions(patch, data)) {
                continue;
            }

            try {
                this.applyPatch(patch, data);
                patch.success = true;
            } catch (error: any) {
                patch.success = false;
                patch.error = error.message;

                data.conflicts.push({
                    type: 'incompatible_patch',
                    severity: 'error',
                    xpath: patch.xpath,
                    mods: [patch.mod],
                    description: `Patch failed: ${error.message}`,
                    resolution: 'Check patch xpath and target def existence'
                });
            }
        }

        this.detectPatchCollisions(data);
    }

    private checkPatchConditions(patch: PatchOperation, data: ServerData): boolean {
        if (!patch.conditions) return true;

        if (patch.conditions.modLoaded) {
            for (const modId of patch.conditions.modLoaded) {
                if (!data.mods.has(modId)) {
                    return false;
                }
            }
        }

        if (patch.conditions.modNotLoaded) {
            for (const modId of patch.conditions.modNotLoaded) {
                if (data.mods.has(modId)) {
                    return false;
                }
            }
        }

        return true;
    }

    private applyPatch(patch: PatchOperation, data: ServerData): void {
        if (patch.targetDef) {
            const def = data.defs.get(patch.targetDef);
            if (def) {
                this.applyPatchToDef(def, patch);
            }
        } else {
            for (const [defName, def] of data.defs.entries()) {
                if (this.matchesXPath(def, patch.xpath)) {
                    this.applyPatchToDef(def, patch);
                }
            }
        }
    }

    private applyPatchToDef(def: RimWorldDef, patch: PatchOperation): void {
        if (!def.originalContent) {
            def.originalContent = JSON.parse(JSON.stringify(def.content));
        }

        def.patchHistory.push(patch);
        patch.appliedTo?.add(def.defName);

        switch (patch.operation) {
            case 'Add':
            case 'PatchOperationAdd':
                this.addToContent(def.content, patch.xpath, patch.value);
                break;
            case 'Remove':
            case 'PatchOperationRemove':
                this.removeFromContent(def.content, patch.xpath);
                break;
            case 'Replace':
            case 'PatchOperationReplace':
                this.replaceInContent(def.content, patch.xpath, patch.value);
                break;
            case 'AddModExtension':
                if (!def.content.modExtensions) {
                    def.content.modExtensions = { li: [] };
                }
                if (!Array.isArray(def.content.modExtensions.li)) {
                    def.content.modExtensions.li = [def.content.modExtensions.li].filter(Boolean);
                }
                def.content.modExtensions.li.push(patch.value);
                break;
        }
    }

    private matchesXPath(def: RimWorldDef, xpath: string): boolean {
        return xpath.includes(def.type) ||
            xpath.includes(def.defName) ||
            xpath.includes(`defName="${def.defName}"`) ||
            xpath.includes(`defName='${def.defName}'`);
    }

    private addToContent(content: any, xpath: string, value: any): void {
        const path = this.xpathToPath(xpath);
        const parts = path.split('.');
        let current = content;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        const lastPart = parts[parts.length - 1];
        if (lastPart.endsWith('[]')) {
            const arrayName = lastPart.slice(0, -2);
            if (!current[arrayName]) {
                current[arrayName] = { li: [] };
            }
            if (!current[arrayName].li) {
                current[arrayName].li = [];
            }
            if (!Array.isArray(current[arrayName].li)) {
                current[arrayName].li = [current[arrayName].li];
            }
            current[arrayName].li.push(value);
        } else {
            current[lastPart] = value;
        }
    }

    private removeFromContent(content: any, xpath: string): void {
        const path = this.xpathToPath(xpath);
        const parts = path.split('.');
        let current = content;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) return;
            current = current[parts[i]];
        }

        delete current[parts[parts.length - 1]];
    }

    private replaceInContent(content: any, xpath: string, value: any): void {
        const path = this.xpathToPath(xpath);
        const parts = path.split('.');
        let current = content;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
    }

    private xpathToPath(xpath: string): string {
        return xpath
            .replace(/^\/+/, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\//g, '.')
            .replace(/\s+/g, '');
    }

    private detectPatchCollisions(data: ServerData): void {
        const patchesByTarget = new Map<string, PatchOperation[]>();

        for (const patch of data.globalPatches) {
            if (!patch.success) continue;

            const key = patch.targetDef || patch.xpath;
            if (!patchesByTarget.has(key)) {
                patchesByTarget.set(key, []);
            }
            patchesByTarget.get(key)!.push(patch);
        }

        for (const [target, patches] of patchesByTarget.entries()) {
            if (patches.length > 1) {
                const byXPath = new Map<string, PatchOperation[]>();
                for (const patch of patches) {
                    const xpathKey = `${patch.xpath}:${patch.operation}`;
                    if (!byXPath.has(xpathKey)) {
                        byXPath.set(xpathKey, []);
                    }
                    byXPath.get(xpathKey)!.push(patch);
                }

                for (const [xpath, xpathPatches] of byXPath.entries()) {
                    if (xpathPatches.length > 1) {
                        const mods = [...new Set(xpathPatches.map(p => p.mod))];

                        data.conflicts.push({
                            type: 'patch_collision',
                            severity: 'warning',
                            xpath: xpathPatches[0].xpath,
                            defName: xpathPatches[0].targetDef,
                            mods,
                            description: `Multiple mods patch the same location: ${xpath}`,
                            resolution: `Last patch wins (${mods[mods.length - 1].name}). Consider load order adjustments.`
                        });
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