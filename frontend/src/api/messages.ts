import { api } from '../lib/api';
import type { Message, MessageCreate } from '../types';

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
   */
  async create(caseId: string, data: MessageCreate): Promise<Message> {
    const response = await api.post(`/cases/${caseId}/messages`, data);
    return response.data;
  },
};
