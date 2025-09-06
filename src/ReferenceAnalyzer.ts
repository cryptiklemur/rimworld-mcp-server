import { DefReference, RimWorldDef, ServerData } from './types.js';

export class ReferenceAnalyzer {
    extractReferences(data: ServerData): void {
        for (const def of data.defs.values()) {
            if (def.parent) {
                this.addReference(def.defName, def.parent, 'parent', '@ParentName', data);
            }

            this.scanObjectForReferences(def.content, def.defName, '', data);
        }
    }

    resolveInheritance(data: ServerData): void {
        const resolved = new Set<string>();

        const resolve = (defName: string): any => {
            if (resolved.has(defName)) {
                return data.defs.get(defName)?.content;
            }

            const def = data.defs.get(defName) || data.abstractDefs.get(defName);
            if (!def) return null;

            if (def.parent) {
                const parentContent = resolve(def.parent);
                if (parentContent) {
                    def.content = this.mergeWithParent(parentContent, def.content);
                }
            }

            resolved.add(defName);
            return def.content;
        };

        for (const defName of data.defs.keys()) {
            resolve(defName);
        }
    }

    private scanObjectForReferences(obj: any, fromDef: string, path: string, data: ServerData): void {
        if (!obj || typeof obj !== 'object') return;

        const referencePatterns = [
            { key: /thingDef$/i, type: 'thingDef' as const },
            { key: /recipe$/i, type: 'recipe' as const },
            { key: /researchPrerequisite/i, type: 'research' as const },
            { key: /building$/i, type: 'building' as const },
            { key: /weapon$/i, type: 'weapon' as const },
            { key: /apparel$/i, type: 'apparel' as const },
            { key: /hediff$/i, type: 'hediff' as const },
            { key: /trait$/i, type: 'trait' as const },
            { key: /workGiver/i, type: 'workGiver' as const },
            { key: /job$/i, type: 'job' as const },
            { key: /thought$/i, type: 'thought' as const },
            { key: /interaction$/i, type: 'interaction' as const },
        ];

        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;

            if (typeof value === 'string' && value.length > 0) {
                if (data.defs.has(value) || data.abstractDefs.has(value)) {
                    let refType: DefReference['referenceType'] = 'other';
                    for (const pattern of referencePatterns) {
                        if (pattern.key.test(key)) {
                            refType = pattern.type;
                            break;
                        }
                    }

                    this.addReference(fromDef, value, refType, currentPath, data);
                }
            } else if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    if (typeof item === 'string' && (data.defs.has(item) || data.abstractDefs.has(item))) {
                        this.addReference(fromDef, item, 'other', `${currentPath}[${i}]`, data);
                    } else if (typeof item === 'object' && item !== null) {
                        this.scanObjectForReferences(item, fromDef, `${currentPath}[${i}]`, data);
                    }
                }
            } else if (typeof value === 'object' && value !== null) {
                if (key === 'li' && value) {
                    const liArray = Array.isArray(value) ? value : [value];
                    for (const item of liArray) {
                        if (typeof item === 'string' && (data.defs.has(item) || data.abstractDefs.has(item))) {
                            this.addReference(fromDef, item, 'other', currentPath, data);
                        }
                    }
                } else {
                    this.scanObjectForReferences(value, fromDef, currentPath, data);
                }
            }
        }
    }

    private addReference(fromDef: string, toDef: string, type: DefReference['referenceType'], path: string, data: ServerData): void {
        const ref: DefReference = {
            fromDef,
            toDef,
            referenceType: type,
            path
        };

        const sourceDef = data.defs.get(fromDef);
        if (sourceDef) {
            sourceDef.outgoingRefs.add(ref);
        }

        const targetDef = data.defs.get(toDef) || data.abstractDefs.get(toDef);
        if (targetDef) {
            targetDef.incomingRefs.add(ref);
        }

        if (!data.referenceGraph.has(fromDef)) {
            data.referenceGraph.set(fromDef, new Set());
        }
        data.referenceGraph.get(fromDef)!.add(ref);
    }

    private mergeWithParent(parent: any, child: any): any {
        if (child === undefined || child === null) {
            return parent;
        }

        if (child === 'Inherit.Remove') {
            return undefined;
        }

        if (Array.isArray(parent)) {
            return Array.isArray(child) ? child : parent;
        }

        if (typeof parent !== 'object' || parent === null) {
            return child;
        }

        const merged: any = {};

        for (const key in parent) {
            if (parent.hasOwnProperty(key)) {
                merged[key] = parent[key];
            }
        }

        for (const key in child) {
            if (child.hasOwnProperty(key)) {
                if (child[key] === 'Inherit.Remove') {
                    delete merged[key];
                } else if (typeof child[key] === 'object' && !Array.isArray(child[key]) && child[key] !== null) {
                    merged[key] = this.mergeWithParent(merged[key] || {}, child[key]);
                } else {
                    merged[key] = child[key];
                }
            }
        }

        return merged;
    }
}