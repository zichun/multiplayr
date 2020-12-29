/**
 * GameRuleInterfaces.ts
 */

export type MPType = any;

export interface GameRuleInterface {
    name: string;
    plugins: { [gameName: string]: GameRuleInterface };
    globalData: { [varName: string]: any };
    playerData: { [varName: string]: any };
    onDataChange(mp: MPType, rule?: GameRuleInterface): boolean;
    methods: {[methodName: string]: (mb: any, clientId: string, ...args: any[]) => any};
    views: { [viewName: string]: any };
}

export interface GameRuleWrapperInterface {
    description: string;
    debug: boolean;
    rules: string[];
    rule: GameRuleInterface;
}

export interface ViewPropsInterface {
    MP: MPType;
}
