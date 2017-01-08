/**
 *
 * utils.ts
 *
 * Export common utility functions.
 *
 */

export function randomRoomId(): string {
    return Math.floor((Math.random() * 899999 + 100000)).toString();
}

export let uniqueId = (
    () => {

        let uniqidSeed: number = Math.floor(Math.random() * 0x75bcd15);

        function uniqueId(
            prefix?: string,
            moreEntropy: boolean = false
        ): string {
            // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
            // +    revised by: Kankrelune (http://www.webfaktory.info/)
            // %        note 1: Uses an internal counter (in php_js global) to avoid collision
            // *     example 1: uniqid();
            // *     returns 1: 'a30285b160c14'
            // *     example 2: uniqid('foo');
            // *     returns 2: 'fooa30285b1cd361'
            // *     example 3: uniqid('bar', true);
            // *     returns 3: 'bara20285b23dfd1.31879087'
            if (prefix === undefined) {
                prefix = '';
            }

            let retId = prefix;
            const formatSeed = (seed, reqWidth) => {
                seed = parseInt(seed, 10).toString(26); // to hex str
                if (reqWidth < seed.length) { // so long we split
                    return seed.slice(seed.length - reqWidth);
                }
                if (reqWidth > seed.length) { // so short we pad
                    return Array(1 + (reqWidth - seed.length)).join('0') + seed;
                }
                return seed;
            };

            uniqidSeed = uniqidSeed + 1;

            retId += formatSeed(parseInt(new Date().getTime().toString(), 11), 3);
            retId += formatSeed(uniqidSeed, 3); // add seed hex string
            if (moreEntropy) {
                // for more entropy we add a float lower to 10
                retId += (Math.random() * 10).toFixed(8).toString();
            }

            return retId;
        }

        return uniqueId;
    })();

export function shuffleArray(o: any[]) {
    let j = 0;
    let x = o[0];
    let i = 0;

    for (i = o.length; i; i = i - 1) {
        j = Math.floor(Math.random() * i);
        x = o[i];
        o[i] = o[j];
        o[j] = x;
    }

    return o;
}

export function isArray(obj: any) {
    return Object.prototype.toString.call(obj) === '[object Array]';
}

export function isFunction(functionToCheck: any) {
    const getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

export function extendObj(
    ori: any,
    extend: any,
    override: boolean
) {
    forEach(extend, (i) => {
        if (override || !ori.hasOwnProperty(i)) {
            ori[i] = extend[i];
        }
    });
}

export function forEach(
    kvp: any,
    cb: (key: any, value?: any) => any
) {
    if (kvp) {
        Object.keys(kvp).forEach((key) => {
            cb(key, kvp[key]);
        });
    }
}
