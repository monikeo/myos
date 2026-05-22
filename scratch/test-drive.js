const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
  const driveId = "1hUZehApOMz3IcZc0jVYNLn3yD6Zayag9";
  const targetThumbnail = `https://drive.google.com/thumbnail?id=${driveId}&sz=w500`;
  console.log("Fetching:", targetThumbnail);
  try {
    const response = await fetch(targetThumbnail, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      }
    });
    console.log("Status:", response.status);
    console.log("Content-Type:", response.headers.get("content-type"));
    const text = await response.text();
    console.log("Body length:", text.length);
    console.log("Body start:", text.substring(0, 500));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
