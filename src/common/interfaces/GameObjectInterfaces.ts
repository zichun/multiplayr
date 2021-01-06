/**
 *
 * GameObjectInterfaces.ts
 *
 * Interfaces for types used in Multiplayr's gameobject layer.
 *
 */

import { ViewPropsInterface } from './GameRuleInterfaces';

export interface DataStoreType {
    (variable: string): {
        getValue: () => any,
        setValue: (value: any) => any
    };
}

export type ViewCallbackType = (displayName: string, props: ViewPropsInterface) => void;
