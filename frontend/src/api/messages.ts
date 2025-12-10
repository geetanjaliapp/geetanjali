import { api } from "../lib/api";
import type { Message, MessageCreate, FollowUpRequest, FollowUpResponse } from "../types";

export const messagesApi = {
  /**
   * Get all messages for a case (conversation thread)
   */
  async list(caseId: string): Promise<Message[]> {
    const response = await api.get(`/cases/${caseId}/messages`);
    return response.data;
  },

  /**
   * Create a new user message (follow-up question)
   * @deprecated Use followUp() for lightweight conversational follow-ups
   */
  async create(caseId: string, data: MessageCreate): Promise<Message> {
    const response = await api.post(`/cases/${caseId}/messages`, data);
    return response.data;
  },

  /**
   * Submit a follow-up question and get a conversational response.
   * This is a lightweight endpoint that:
   * - Creates both user and assistant messages atomically
   * - Returns markdown prose (not structured JSON)
   * - Does NOT trigger full RAG pipeline or create a new Output
   * - Uses prior consultation context for grounded responses
   */
  async followUp(caseId: string, data: FollowUpRequest): Promise<FollowUpResponse> {
    const response = await api.post(`/cases/${caseId}/follow-up`, data);
    return response.data;
  },
};
