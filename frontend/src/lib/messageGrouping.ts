import type { Message, Output } from '../types';

export interface Exchange {
  user: Message;
  assistant: Message;
  output: Output | undefined;
}

/**
 * Groups messages into user-assistant exchanges.
 * Handles duplicate assistant messages from retries by taking the latest one.
 */
export function groupMessagesIntoExchanges(
  messages: Message[],
  outputs: Output[]
): Exchange[] {
  const getOutput = (outputId?: string) => outputs.find(o => o.id === outputId);

  const exchanges: Exchange[] = [];
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  userMessages.forEach((userMsg, idx) => {
    const nextUserMsg = userMessages[idx + 1];
    const relevantAssistants = assistantMessages.filter(a => {
      const afterUser = new Date(a.created_at) > new Date(userMsg.created_at);
      const beforeNextUser = !nextUserMsg || new Date(a.created_at) < new Date(nextUserMsg.created_at);
      return afterUser && beforeNextUser;
    });

    // Take the latest assistant message (handles retries)
    const latestAssistant = relevantAssistants.length > 0
      ? relevantAssistants.reduce((latest, curr) =>
          new Date(curr.created_at) > new Date(latest.created_at) ? curr : latest
        )
      : null;

    if (latestAssistant) {
      exchanges.push({
        user: userMsg,
        assistant: latestAssistant,
        output: getOutput(latestAssistant.output_id),
      });
    }
  });

  return exchanges;
}
