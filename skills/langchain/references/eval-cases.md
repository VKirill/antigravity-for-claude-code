# Eval Cases

Routing prompts to verify the `langchain` skill loads on the right tasks and skips when another skill is a better fit.

## Should activate

- "How do I call a Claude model and an OpenAI model with the same interface in Python?"
- "Convert this `AgentExecutor` setup to LangChain v1."
- "Build a RAG chain with pgvector and Anthropic."
- "How do I stream tokens from `prompt | model | StrOutputParser` in FastAPI?"
- "Get typed JSON out of GPT-5 via LangChain — use Pydantic."
- "What's the difference between `RunnableParallel` and `RunnableLambda`?"
- "I'm getting `ImportError: cannot import name 'init_chat_model'` — what's wrong?"
- "How do I add chat history to a LangChain chain with Redis?"
- "Convert this `LLMChain(llm=..., prompt=..., memory=...)` to v1 idiom."
- "Set up LangSmith tracing for my chain in production."
- "Cache LLM calls in Postgres semantic cache."
- "Why does my retriever return zero docs? embeddings are openai 3-small."
- "Bind tools to a chat model and run the tool-calling loop manually."
- "Migrate `langgraph.prebuilt.create_react_agent` to `create_agent`."
- "How do I use `astream_events` to show tool-call progress in my UI?"

## Should NOT activate

- "Call the Anthropic API directly with the `anthropic` Python SDK, no LangChain." → `claude-api`
- "Build a custom LangGraph state machine with parallel branches and human-in-the-loop." → `langgraph` (separate skill)
- "Wrap my chain behind a FastAPI streaming endpoint." → primarily `fastapi`, this skill only for the chain itself
- "Pure prompt engineering — what's a better system prompt for code review?" → vendor skill
- "I'm using Pydantic v2 for request validation in FastAPI, no LLM." → `pydantic`
- "How do I deploy a model to AWS Bedrock?" → AWS skill, not LangChain
- "Train a deep learning model in PyTorch." → `pytorch`
- "Generic Python async / asyncio question with no LangChain involved." → `python`

## Disambiguation cases

- "How do I configure prompt caching with Claude in LangChain?" → loads `langchain` (orchestration framing) and possibly `claude-api`; this skill covers the LangChain-side knobs, `claude-api` covers Anthropic-native cache control. Both can be relevant.
- "Migrate from `langgraph.prebuilt.create_react_agent`." → this skill (because the target `create_agent` lives in `langchain.agents`); the `langgraph` skill is for graph-native code.
- "Build an agent with tools." → this skill (`create_agent`). If the user later asks "add a custom branching graph", drop to `langgraph`.
