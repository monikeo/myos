export default async function handler(req: any, res: any) {
  try {
    const { appPromise } = await import("../server.ts");
    const app = await appPromise;
    return app(req, res);
  } catch (err: any) {
    return res.status(500).json({
      error: "Vercel Serverless Function Crash during import/execution",
      message: err.message,
      stack: err.stack
    });
  }
}
