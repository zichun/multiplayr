/**
 * iceservers.ts
 *
 * Builds the WebRTC ICE server list for the P2P host and join pages from build-time
 * environment variables (injected by webpack's DefinePlugin from the local, git-ignored
 * .env file). Nothing here is hardcoded:
 *
 *   TURN_URL         one or more TURN URLs, comma-separated, in order of preference
 *                    (e.g. a DNS name first, then the raw IP as a fallback)
 *   TURN_USERNAME    shared long-term credential username
 *   TURN_CREDENTIAL  shared long-term credential password
 *
 * The first TURN URL also gets a TCP variant (same host/port, ?transport=tcp) for
 * networks that block UDP, unless any URL already specifies a transport. The list is
 * kept short because browsers slow down ICE gathering with five or more servers.
 */

declare var process: any;

const PUBLIC_STUN = { urls: 'stun:stun.l.google.com:19302' };

export function getIceServersConfig(): RTCIceServer[] {
    const turnUrls = String(process.env.TURN_URL || '')
        .split(',')
        .map((u) => u.trim())
        .filter((u) => /^turns?:/i.test(u));
    const username = process.env.TURN_USERNAME || undefined;
    const credential = process.env.TURN_CREDENTIAL || undefined;

    if (turnUrls.length === 0) {
        console.log('No TURN server configured; using public STUN only.');
        return [
            PUBLIC_STUN,
            { urls: 'stun:stun1.l.google.com:19302' }
        ];
    }

    const explicitTransport = turnUrls.some((u) => /[?&]transport=/i.test(u));
    const servers: RTCIceServer[] = [PUBLIC_STUN];

    turnUrls.forEach((url, i) => {
        const urls = [url];
        if (i === 0 && !explicitTransport && /^turn:/i.test(url)) {
            urls.push(url + '?transport=tcp');
        }
        servers.push({ urls, username, credential });
    });

    console.log('Using TURN servers configured at build time:', turnUrls.join(', '));
    return servers;
}
