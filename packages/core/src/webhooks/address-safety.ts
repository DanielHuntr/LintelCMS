import { BlockList, isIP } from "node:net";

/**
 * Which network addresses webhooks may not be sent to. Without this, anyone who can add
 * a webhook could make the server send requests into its own network: a database's admin
 * page, a cloud provider's metadata service (169.254.169.254), other machines in the office.
 *
 * The check runs on the address a name actually resolves to, at the moment of sending
 * (see webhook-sender.ts), so a name that points somewhere harmless when the webhook is
 * saved and somewhere private later is still caught.
 */
const privateAddresses = new BlockList();

const privateIpv4Ranges: [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, including cloud metadata services
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relays
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and broadcast
];
for (const [network, prefix] of privateIpv4Ranges) {
  privateAddresses.addSubnet(network, prefix, "ipv4");
}

const privateIpv6Ranges: [string, number][] = [
  ["::", 96], // unspecified, loopback, and the old IPv4-compatible form (::127.0.0.1)
  ["100::", 64], // discard
  ["2001::", 32], // Teredo tunnels, which can lead anywhere
  ["2001:db8::", 32], // documentation
  ["64:ff9b:1::", 48], // local-use translation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
];
for (const [network, prefix] of privateIpv6Ranges) {
  privateAddresses.addSubnet(network, prefix, "ipv6");
}

/** True for loopback, private, link-local and other addresses that aren't on the internet. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return privateAddresses.check(address, "ipv4");
  }
  if (version === 6) {
    const embeddedIpv4 = ipv4InsideIpv6(address);
    if (embeddedIpv4) {
      return privateAddresses.check(embeddedIpv4, "ipv4");
    }
    return privateAddresses.check(address, "ipv6");
  }
  // Not an address at all: refuse rather than guess.
  return true;
}

/**
 * "::ffff:127.0.0.1" and "::ffff:7f00:1" are both 127.0.0.1 written as IPv6; so are the
 * NAT64 forms under 64:ff9b::/96, and 6to4 addresses (2002:7f00:1::) carry one inside.
 * They're checked as the IPv4 address they really are.
 */
function ipv4InsideIpv6(address: string): string | undefined {
  const lower = address.toLowerCase();
  const sixToFour = /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(:|$)/.exec(lower);
  if (sixToFour) {
    return ipv4FromGroups(sixToFour[1] ?? "0", sixToFour[2] ?? "0");
  }
  const prefix = ["::ffff:", "64:ff9b::"].find((start) => lower.startsWith(start));
  if (!prefix) {
    return undefined;
  }
  const rest = lower.slice(prefix.length);
  if (isIP(rest) === 4) {
    return rest;
  }
  const groups = rest.split(":");
  if (groups.length !== 2 || !groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
    return undefined;
  }
  return ipv4FromGroups(groups[0] ?? "0", groups[1] ?? "0");
}

/** Two 16-bit hex groups, such as "7f00" and "1", as the IPv4 address they spell. */
function ipv4FromGroups(highGroup: string, lowGroup: string): string {
  const high = Number.parseInt(highGroup, 16);
  const low = Number.parseInt(lowGroup, 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

const loopbackAddresses = new BlockList();
loopbackAddresses.addSubnet("127.0.0.0", 8, "ipv4");
loopbackAddresses.addAddress("::1", "ipv6");

/**
 * True for this computer's own addresses only (127.x.x.x and ::1), not the rest of the
 * private network. Apps' development mode lets apps reach these and nothing else.
 */
export function isLoopbackAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return loopbackAddresses.check(address, "ipv4");
  }
  if (version === 6) {
    const embeddedIpv4 = ipv4InsideIpv6(address);
    return embeddedIpv4
      ? loopbackAddresses.check(embeddedIpv4, "ipv4")
      : loopbackAddresses.check(address, "ipv6");
  }
  return false;
}

/** "localhost", "app.localhost", 127.0.0.1 or [::1]: a web address on this computer. */
export function isLoopbackHost(url: URL): boolean {
  const host = bareHostname(url).toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") || isLoopbackAddress(host);
}

/** Host names that mean "this machine" whatever DNS says. */
export function isLocalHostName(hostname: string): boolean {
  const name = hostname.toLowerCase().replace(/\.$/, "");
  return name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local");
}

/** A URL's host without the brackets IPv6 addresses have in URLs. */
export function bareHostname(url: URL): string {
  return url.hostname.replace(/^\[(.*)\]$/, "$1");
}
