/**
 *
 * GameObjectInterfaces.ts
 *
 * Interfaces for types used in Multiplayr's gameobject layer.
 *
 */

export interface DataStoreType {
    (variable: string): {
        getValue: () => any,
        setValue: (value: any) => any
    }
}
