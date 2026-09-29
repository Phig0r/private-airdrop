/* tslint:disable */
/* eslint-disable */

export function addressToField(value: string): any;

export function buildTree(value: any): any;

export function circuitInputs(account: any, tree: any, index: number, recipient: string, public_key: string, signature: string): any;

export function deriveTierKey(master: string, context: string, nullifier: string): any;

export function findPath(value: any, leaf: string): any;

export function hashLeaf(value: any): any;

export function leafFromPhrase(address: string, phrase: string, seed: string, tier: string): any;

export function normalizeField(value: string): any;

export function nullifierHash(value: any): any;

export function recoverPublicKey(recipient: string, seed: string, signature: string): any;

export function set_pedersen_hasher(hasher: Function): void;

export function signMessage(private_key: string, recipient: string, seed: string): any;

export function signingMessage(recipient: string, seed: string): any;

export function textToField(value: string): any;

export function validateTree(value: any): any;

export function walletAddress(private_key: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly addressToField: (a: number, b: number) => [number, number, number];
    readonly buildTree: (a: any) => [number, number, number];
    readonly circuitInputs: (a: any, b: any, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number];
    readonly deriveTierKey: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly findPath: (a: any, b: number, c: number) => [number, number, number];
    readonly hashLeaf: (a: any) => [number, number, number];
    readonly leafFromPhrase: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
    readonly normalizeField: (a: number, b: number) => [number, number, number];
    readonly nullifierHash: (a: any) => [number, number, number];
    readonly recoverPublicKey: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly set_pedersen_hasher: (a: any) => void;
    readonly signMessage: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly signingMessage: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly textToField: (a: number, b: number) => [number, number, number];
    readonly validateTree: (a: any) => [number, number, number];
    readonly walletAddress: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
