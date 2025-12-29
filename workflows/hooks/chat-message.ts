import { defineHook } from "workflow";
import { z } from "zod";

/**
 * Hook for chat messages
 */
export const chatMessageHook = defineHook({
  schema: z.object({
    message: z.string(),  
    conversationId: z.string(),
  }),
});