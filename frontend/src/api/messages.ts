import { api } from "../lib/api";
import type {
  Message,
  FollowUpRequest,
  FollowUpResponse,
} from "../types";

export const messagesApi = {
  /**
   * Get all messages for a case (conversation thread)
   */
  async list(caseId: string): Promise<Message[]> {
    const response = await api.get(`/cases/${caseId}/messages`);
    return response.data;
  },

  /**
   * Submit a follow-up question for async processing (HTTP 202 Accepted).
   *
   * Returns immediately with the user message. The assistant response is
   * generated in the background. Poll case status until "completed" to
   * get the assistant response via list().
   *
   * Flow:
   * 1. Submit follow-up → get back user message (202 Accepted)
   * 2. Case status changes to "processing"
   * 3. Background task generates assistant response
   * 4. Case status changes to "completed"
   * 5. Call list() to get all messages including assistant response
   */
  async followUp(
    caseId: string,
    data: FollowUpRequest,
  ): Promise<FollowUpResponse> {
    const response = await api.post(`/cases/${caseId}/follow-up`, data);
    return response.data;
  },
};
