import server from "../dist/server.cjs";

export default async function handler(req: any, res: any) {
  try {
    const app = await server.appPromise;
    return app(req, res);
  } catch (err: any) {
    return res.status(500).json({
      error: "Vercel Serverless Function Crash during import/execution",
      message: err.message,
      stack: err.stack
    });
  }
}
