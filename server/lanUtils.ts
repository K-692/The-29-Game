import os from 'os';

export interface LanInfo {
  primaryIp: string;
  allIps: string[];
  port: number;
  url: string;
}

/**
 * Discovers local network IPv4 addresses on LAN/Wi-Fi interfaces.
 */
export function getLanIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;

    for (const net of netList) {
      // Must be IPv4 and not loopback
      const isIpv4 = net.family === 'IPv4' || (net as unknown as { family: number }).family === 4;
      if (isIpv4 && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  // Prioritize standard private IP ranges (192.168.x.x > 10.x.x.x > 172.16-31.x.x)
  addresses.sort((a, b) => {
    const is192A = a.startsWith('192.168.');
    const is192B = b.startsWith('192.168.');
    if (is192A && !is192B) return -1;
    if (!is192A && is192B) return 1;

    const is10A = a.startsWith('10.');
    const is10B = b.startsWith('10.');
    if (is10A && !is10B) return -1;
    if (!is10A && is10B) return 1;

    return 0;
  });

  return addresses;
}

/**
 * Gets the primary LAN IPv4 address or falls back to localhost.
 */
export function getPrimaryLanIp(): string {
  const ips = getLanIpAddresses();
  return ips.length > 0 ? ips[0] : '127.0.0.1';
}

/**
 * Prints a clean, prominent banner in the terminal for the LAN Host.
 */
export function printHostBanner(port: number, primaryIp: string, allIps: string[]) {
  const primaryUrl = `http://${primaryIp}:${port}`;
  const localUrl = `http://localhost:${port}`;

  console.log('\n' + '═'.repeat(68));
  console.log('       ♠ ♥ ♦ ♣   THE 29 GAME — LAN MULTIPLAYER HOST   ♣ ♦ ♥ ♠');
  console.log('═'.repeat(68));
  console.log(`  Local Access:      ${localUrl}`);
  console.log(`  LAN / Wi-Fi URL:   ${primaryUrl}`);
  if (allIps.length > 1) {
    console.log(`  Alternative IPs:   ${allIps.slice(1).map(ip => `http://${ip}:${port}`).join(', ')}`);
  }
  console.log('─'.repeat(68));
  console.log('  HOW TO CONNECT PLAYERS ON YOUR LOCAL NETWORK:');
  console.log('  1. Ensure all laptops, phones, or tablets are on the same Wi-Fi.');
  console.log(`  2. Open ${primaryUrl} on any browser.`);
  console.log('  3. Join with your Room Code or scan the QR Code on screen.');
  console.log('═'.repeat(68) + '\n');
}
