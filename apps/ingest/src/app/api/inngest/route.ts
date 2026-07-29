import { serve } from "inngest/next";
import { inngest } from "@shootermarkt/queue";
import {
  cleanupExpiredPdfImports,
  processIssfDirectImport,
  processIssfImport,
  processPdfImport,
} from "@/lib/inngest/functions";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processPdfImport,
    cleanupExpiredPdfImports,
    processIssfImport,
    processIssfDirectImport,
  ],
});
