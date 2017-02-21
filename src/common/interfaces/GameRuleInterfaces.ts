/**
 * GameRuleInterfaces.ts
 */

export type MPType = any;

export interface GameRuleInterface {
    name: string;
    css: string[];
    plugins: { [gameName: string]: GameRuleInterface };
    globalData: { [varName: string]: any };
    playerData: { [varName: string]: any };
    onDataChange(mp: MPType, rule?: GameRuleInterface): boolean;
    methods: {[methodName: string]: (mb: any, clientId: string, ...args: any[]) => any};
    views: { [viewName: string]: any };
}

export interface ViewPropsInterface {
    MP: MPType
}
