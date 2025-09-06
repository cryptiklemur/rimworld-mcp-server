export interface ModInfo {
    packageId: string;
    name: string;
    author?: string;
    supportedVersions?: string[];
    loadOrder: number;
    path: string;
    isCore: boolean;
    isDLC: boolean;
    dependencies?: string[];
    incompatibleWith?: string[];
    loadBefore?: string[];
    loadAfter?: string[];
}

export interface DefReference {
    fromDef: string;
    toDef: string;
    referenceType: 'parent' | 'thingDef' | 'recipe' | 'research' | 'building' |
        'weapon' | 'apparel' | 'hediff' | 'trait' | 'workGiver' |
        'job' | 'thought' | 'interaction' | 'other';
    path: string;
    context?: string;
}

export interface PatchOperation {
    id: string;
    mod: ModInfo;
    filePath: string;
    operation: 'Add' | 'Remove' | 'Replace' | 'AddModExtension' | 'SetName' |
        'Sequence' | 'Test' | 'Conditional' | 'PatchOperationFindMod' |
        'PatchOperationReplace' | 'PatchOperationAdd' | 'PatchOperationRemove';
    xpath: string;
    value?: any;
    success?: boolean;
    error?: string;
    targetDef?: string;
    order: number;
    conditions?: {
        modLoaded?: string[];
        modNotLoaded?: string[];
    };
    appliedTo?: Set<string>;
}

export interface DefConflict {
    type: 'override' | 'patch_collision' | 'missing_dependency' |
        'circular_dependency' | 'incompatible_patch' | 'xpath_conflict';
    severity: 'error' | 'warning' | 'info';
    defName?: string;
    xpath?: string;
    mods: ModInfo[];
    description: string;
    resolution?: string;
}

export interface RimWorldDef {
    defName: string;
    type: string;
    parent?: string;
    abstract?: boolean;
    content: any;
    originalContent: any;
    filePath: string;
    mod: ModInfo;
    outgoingRefs: Set<DefReference>;
    incomingRefs: Set<DefReference>;
    patchHistory: PatchOperation[];
    conflicts: DefConflict[];
}

export interface ServerData {
    defs: Map<string, RimWorldDef>;
    defsByType: Map<string, RimWorldDef[]>;
    defsByMod: Map<string, RimWorldDef[]>;
    mods: Map<string, ModInfo>;
    referenceGraph: Map<string, Set<DefReference>>;
    patches: Map<string, PatchOperation[]>;
    globalPatches: PatchOperation[];
    conflicts: DefConflict[];
    loadOrder: string[];
    abstractDefs: Map<string, RimWorldDef>;
}