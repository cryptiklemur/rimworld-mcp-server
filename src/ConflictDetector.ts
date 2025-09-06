import { DefConflict, ServerData } from './types.js';

export class ConflictDetector {
    detectCircularDependencies(data: ServerData): void {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (defName: string, path: string[] = []): boolean => {
            if (recursionStack.has(defName)) {
                const cycleStart = path.indexOf(defName);
                const cycle = path.slice(cycleStart).concat(defName);

                const def = data.defs.get(defName);
                if (def) {
                    data.conflicts.push({
                        type: 'circular_dependency',
                        severity: 'error',
                        defName,
                        mods: [def.mod],
                        description: `Circular dependency: ${cycle.join(' -> ')}`,
                        resolution: 'Review and break the dependency cycle'
                    });
                }
                return true;
            }

            if (visited.has(defName)) {
                return false;
            }

            visited.add(defName);
            recursionStack.add(defName);

            const def = data.defs.get(defName);
            if (def) {
                for (const ref of def.outgoingRefs) {
                    if (hasCycle(ref.toDef, [...path, defName])) {
                        return true;
                    }
                }
            }

            recursionStack.delete(defName);
            return false;
        };

        for (const defName of data.defs.keys()) {
            if (!visited.has(defName)) {
                hasCycle(defName);
            }
        }
    }

    getConflictsByType(data: ServerData, type?: string): DefConflict[] {
        if (!type) return data.conflicts;
        return data.conflicts.filter(c => c.type === type);
    }

    getConflictsBySeverity(data: ServerData, severity?: string): DefConflict[] {
        if (!severity) return data.conflicts;
        return data.conflicts.filter(c => c.severity === severity);
    }

    getConflictsByMod(data: ServerData, modId: string): DefConflict[] {
        return data.conflicts.filter(c =>
            c.mods.some(m => m.packageId === modId)
        );
    }

    getConflictStats(data: ServerData): Record<string, number> {
        const stats: Record<string, number> = {};
        
        for (const conflict of data.conflicts) {
            stats[conflict.type] = (stats[conflict.type] || 0) + 1;
        }
        
        return stats;
    }
}