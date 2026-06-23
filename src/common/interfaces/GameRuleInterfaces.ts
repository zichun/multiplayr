/**
 * GameRuleInterfaces.ts
 */

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
    rules: string[];
    rule: GameRuleInterface;
    icon?: string;
    minPlayers?: number;
    maxPlayers?: number;
}

export interface ViewPropsInterface {
    MP: MPType;
}

export interface MultiplayrAI {
    onPropsChange(props: ViewPropsInterface): void;
}
