const dns = require('dns');
const { promisify } = require('util');
const lookup = promisify(dns.lookup);

async function isSafeUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    
    const hostname = parsed.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return false;
    
    // DNS resolution check to block spoofed/private loopbacks
    const { address } = await lookup(hostname);
    console.log("Resolved address for", hostname, "is", address);
    
    const isPrivate = 
      address.startsWith("127.") || 
      address.startsWith("10.") || 
      address.startsWith("192.168.") || 
      address.startsWith("169.254.") ||
      address === "0.0.0.0" ||
      address === "::1" ||
      address.startsWith("fc00:") ||
      address.startsWith("fe80:") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(address);
      
    return !isPrivate;
  } catch (err) {
    console.error("isSafeUrl error:", err);
    return false;
  }
}

async function run() {
  const driveUrl = "https://drive.google.com/thumbnail?id=1hUZehApOMz3IcZc0jVYNLn3yD6Zayag9&sz=w500";
  const result = await isSafeUrl(driveUrl);
  console.log("Result:", result);
}

run();
