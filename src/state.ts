export interface SessionState {
  activeConversationId: string | null;
  pendingSystemPrompt: string | null;
}

export const sessionState: SessionState = {
  activeConversationId: null,
  pendingSystemPrompt: null,
};

export function resetTestState() {
  sessionState.activeConversationId = null;
  sessionState.pendingSystemPrompt = null;
}
