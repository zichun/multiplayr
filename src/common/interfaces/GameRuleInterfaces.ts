/**
 * GameRuleInterfaces.ts
 */

import { IconObject } from '../../client/lib/card-renderer/types';

export type MPType = any;

export interface GameRuleInterface {
    name: string;
    hostAsPlayer?: boolean;
    plugins: { [gameName: string]: GameRuleInterface };
    globalData: { [varName: string]: any };
    playerData: { [varName: string]: any };
    onDataChange(mp: MPType, rule?: GameRuleInterface): boolean;
    methods: {[methodName: string]: (mb: any, clientId: string, ...args: any[]) => any};
    views: { [viewName: string]: any };
}

export interface GameRuleWrapperInterface {
    description: string;
    debug?: boolean;
    enabled?: boolean;     // host page hides rules set to false (default: enabled)
    rules: string[];
    rule: GameRuleInterface;
    icon?: string;         // emoji shortcut (legacy / compact contexts)
    glyph?: IconObject;    // geometric vector emblem from host-icons (GAME_ICONS)
    minPlayers?: number;
    maxPlayers?: number;
    mechanics?: string[];
}

export interface ViewPropsInterface {
    MP: MPType;
}

export interface MultiplayrAI {
    onPropsChange(props: ViewPropsInterface): void;
}
