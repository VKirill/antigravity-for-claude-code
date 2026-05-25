# LangChain — Reference Index

Slim navigator across the LangChain v1 reference set. Open the most specific file for the active task.

## Package landscape

| Package | Role |
|---|---|
| `langchain-core` | Core abstractions: `Runnable`, `BaseMessage`, `BaseChatModel`, `BaseTool`, `BaseRetriever`, `Document`, `Embeddings`, prompt templates, output parsers. No third-party deps. |
| `langchain` | High-level wiring: `init_chat_model`, `langchain.agents.create_agent`, helpers that depend on core + at least one partner. |
| `langchain-community` | Community integrations (legacy/long-tail). Vector stores, loaders, tools maintained by community. Slowly being split into partner packages. |
| `langchain-anthropic` | First-party Anthropic integration — `ChatAnthropic`, tool calling, structured output. |
| `langchain-openai` | First-party OpenAI integration — `ChatOpenAI`, `OpenAIEmbeddings`. |
| `langchain-google-genai` / `langchain-aws` / `langchain-mistralai` / … | Other first-party provider integrations. |
| `langchain-postgres` | First-party Postgres (pgvector, chat history). |
| `langchain-text-splitters` | Text splitters factored out of core. |
| `langgraph` | **Separate package**. State-machine orchestrator. `create_agent` from `langchain.agents` is built on it. |
| `langsmith` | Observability/tracing SDK + client. |

## Decision map

| If you want to… | Open |
|---|---|
| Install and verify your env | [setup.md](setup.md) |
| Pick a chat model + call it | [models.md](models.md) |
| Compose chains with `|` | [lcel.md](lcel.md) |
| Build a prompt template | [prompts.md](prompts.md) |
| Get typed JSON back from the model | [structured-output.md](structured-output.md) |
| Let the LLM call your Python functions | [tools.md](tools.md) |
| Index documents and retrieve them | [retrievers-and-rag.md](retrievers-and-rag.md) |
| Build an agent (tool-using loop) | [agents.md](agents.md) |
| Stream tokens or LCEL events | [streaming.md](streaming.md) |
| Add per-thread chat history | [memory.md](memory.md) |
| Add LangSmith tracing | [observability.md](observability.md) |
| Cache LLM calls | [caching.md](caching.md) |
| Move a v0 codebase to v1 | [migration-from-v0.md](migration-from-v0.md) |
| Debug a failing chain / tool / retriever | [troubleshooting.md](troubleshooting.md) |
| Look up our standard defaults | [recommended-defaults.md](recommended-defaults.md) |
| Compare anti-pattern vs canonical | [wrong-vs-right.md](wrong-vs-right.md) |
| Verify the skill routes correctly | [eval-cases.md](eval-cases.md) |

## LangChain vs LangGraph at a glance

- **LangChain** = building blocks (Runnables, models, tools, retrievers, prompts) + the prebuilt `create_agent`.
- **LangGraph** = state-machine framework with checkpointers, time-travel, parallel branches, human-in-the-loop. Used under the hood by `create_agent`.
- Rule of thumb: start with LangChain. Drop to LangGraph when you need custom graph topology, branching, or persistent multi-actor state.
