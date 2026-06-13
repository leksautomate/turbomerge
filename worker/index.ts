import "dotenv/config";
import type { Job } from "pg-boss";
import { getBoss } from "../lib/boss";
import { processImageJob } from "./image-worker";
import { processVideoJob } from "./video-worker";
import type { ImageJobData, VideoJobData } from "../types";

async function main() {
  const boss = await getBoss();
  console.log("[worker] pg-boss started");

  await boss.work<ImageJobData>("image-job", { localConcurrency: 5 }, async (jobs: Job<ImageJobData>[]) => {
    for (const job of jobs) {
      console.log(`[image-worker] processing job ${job.data.jobId}`);
      await processImageJob(job.data);
    }
  });

  await boss.work<VideoJobData>("video-job", { localConcurrency: 2 }, async (jobs: Job<VideoJobData>[]) => {
    for (const job of jobs) {
      console.log(`[video-worker] processing job ${job.data.jobId}`);
      await processVideoJob(job.data);
    }
  });

  console.log("[worker] listening for jobs...");
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
