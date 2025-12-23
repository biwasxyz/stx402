/**
 * Converts a hex string to ASCII text
 *
 * @param hexString - Hex string or BigInt to convert
 * @returns ASCII string representation
 */
export function hexToAscii(hexString: string | bigint): string {
  try {
    // Convert BigInt to hex string if needed
    const hex = typeof hexString === 'bigint' ? hexString.toString(16) : hexString.replace('0x', '');
    // Convert each pair of hex digits directly to ASCII
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  } catch (error) {
    Logger.getInstance().error('Failed to convert hex to ASCII', error instanceof Error ? error : new Error(String(error)), {
      hexString: String(hexString),
    });
    // Return empty string on error rather than throwing
    // This is more graceful for display purposes
    return '';
  }
}