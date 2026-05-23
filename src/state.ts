export interface SessionState {
  activeConversationId: string | null;
  pendingSystemPrompt: string | null;
  pendingRole: string | null;
}

export const sessionState: SessionState = {
  activeConversationId: null,
  pendingSystemPrompt: null,
  pendingRole: null,
};

export function resetTestState() {
  sessionState.activeConversationId = null;
  sessionState.pendingSystemPrompt = null;
  sessionState.pendingRole = null;
}
