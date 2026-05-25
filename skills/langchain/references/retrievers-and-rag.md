# Retrievers and RAG

A retriever is a Runnable: `retriever.invoke("query")` returns `list[Document]`. RAG = (retriever | format | prompt | model | parser).

## Document

```python
from langchain_core.documents import Document

doc = Document(
    page_content="The quick brown fox...",
    metadata={"source": "wiki.md", "section": "intro"},
)
```

`page_content` is the text the model sees. `metadata` is filterable in most vector stores.

## Text splitters

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)
chunks: list[Document] = splitter.split_documents(docs)
```

Defaults that usually work:
- `chunk_size=1000` characters
- `chunk_overlap=100–200` characters
- Recursively splits on `\n\n`, `\n`, ` `, `""`

For Markdown / HTML, use the structured splitters:

```python
from langchain_text_splitters import MarkdownHeaderTextSplitter

splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")],
)
chunks = splitter.split_text(markdown_text)
# Each chunk carries h1/h2/h3 in metadata
```

## Embeddings

```python
from langchain_openai import OpenAIEmbeddings
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Or HuggingFace local
from langchain_huggingface import HuggingFaceEmbeddings
embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-m3")

v = embeddings.embed_query("hello")        # list[float]
vs = embeddings.embed_documents(["a", "b"]) # list[list[float]]
```

**Check the dimension early**: `len(embeddings.embed_query("x"))`. Mismatch with vector-store config raises at query time, not insert time.

## Vector stores

The `VectorStore` interface: `add_documents`, `similarity_search`, `as_retriever()`.

### Chroma (local / embedded)

```python
from langchain_chroma import Chroma

vs = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db",
    collection_name="docs",
)
```

### Qdrant

```python
from langchain_qdrant import QdrantVectorStore

vs = QdrantVectorStore.from_documents(
    chunks,
    embedding=embeddings,
    url="http://localhost:6333",
    collection_name="docs",
)
```

### FAISS (in-process)

```python
from langchain_community.vectorstores import FAISS

vs = FAISS.from_documents(chunks, embedding=embeddings)
vs.save_local("./faiss_index")
# Later:
vs = FAISS.load_local("./faiss_index", embeddings, allow_dangerous_deserialization=True)
```

### pgvector (Postgres)

```python
from langchain_postgres import PGVector

vs = PGVector(
    embeddings=embeddings,
    collection_name="docs",
    connection="postgresql+psycopg://user:pass@host/db",
    use_jsonb=True,
)
vs.add_documents(chunks)
```

## Retriever from a vector store

```python
retriever = vs.as_retriever(
    search_type="similarity",        # or "mmr", "similarity_score_threshold"
    search_kwargs={"k": 4, "filter": {"source": "wiki.md"}},
)

docs = retriever.invoke("what is recursion?")
```

`search_type="mmr"` (Maximal Marginal Relevance) is a good default for diversity. `search_kwargs={"k": 4, "fetch_k": 20}` retrieves 20 then re-ranks to 4 for MMR.

## RAG chain (LCEL)

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages([
    ("system", "Answer the question using only the provided context."),
    ("human", "Context:\n{context}\n\nQuestion: {question}"),
])

def format_docs(docs):
    return "\n\n".join(d.page_content for d in docs)

rag = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | model
    | StrOutputParser()
)

rag.invoke("What is recursion?")
```

## Advanced retrievers

### MultiQueryRetriever

```python
from langchain.retrievers.multi_query import MultiQueryRetriever

mqr = MultiQueryRetriever.from_llm(
    retriever=vs.as_retriever(),
    llm=model,
)
```

LLM rephrases the query N times, retrieves for each, unions. Better recall on ambiguous queries; costs extra LLM calls.

### ContextualCompressionRetriever

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor

compressor = LLMChainExtractor.from_llm(model)
compressed = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=vs.as_retriever(search_kwargs={"k": 20}),
)
```

Retrieves wide, then an LLM extracts only the relevant spans per doc. Reduces context length at the cost of an extra LLM hop per doc.

### Re-rankers

Pair retrieval (`k=20`) with a cross-encoder re-ranker (`k=4`):

```python
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain.retrievers.document_compressors import CrossEncoderReranker

encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
reranker = CrossEncoderReranker(model=encoder, top_n=4)

retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=vs.as_retriever(search_kwargs={"k": 20}),
)
```

Cheaper and usually higher quality than LLM-based compression.
