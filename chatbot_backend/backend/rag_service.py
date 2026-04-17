import os
from typing import List
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
from pypdf import PdfReader


load_dotenv()

class RAGService:
    def __init__(self):
        # Kết nối Qdrant
        self.qdrant_client = QdrantClient(
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY")
        )

        # Model embedding
        self.embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

        # Collection name
        self.collection_name = "demo_1"

        # Text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

    def create_collection(self):
        """Tạo collection trong Qdrant"""
        try:
            if self.qdrant_client.collection_exists(self.collection_name):
                self.qdrant_client.delete_collection(self.collection_name)

            self.qdrant_client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE)
            )
            print(f"Collection '{self.collection_name}' tạo thành công")
        except Exception as e:
            print(f"Lỗi tạo collection: {e}")

    def load_documents(self, folder_path: str = "documents"):
        """Đọc tất cả files .txt trong folder"""
        documents = []

        for filename in os.listdir(folder_path):
            file_path = os.path.join(folder_path, filename)
            if filename.endswith('.txt'):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    documents.append({
                        'content': content,
                        'source': filename
                    })

            elif filename.endswith('.pdf'):
                try:
                    reader = PdfReader(file_path)
                    content = ""
                    # Đọc từng trang
                    for page in reader.pages:
                        text = page.extract_text()
                        if text:
                            content += text + "\n"
                    if content.strip():
                        documents.append({
                            'content': content,
                            'source': filename
                        })
                        print(f"Loaded PDF: {filename} ({len(reader.pages)} pages)")
                    else:
                        print(f"PDF rỗng hoặc kh đọc được: {filename}")
                except Exception as e:
                    print(f"Lỗi khi đọc PDF {filename}: {e}")
        print(f"Loaded {len(documents)} documents")
        return documents

    def chunk_documents(self, documents: List[dict]):
        chunks = []

        for doc in documents:
            text_chunks = self.text_splitter.split_text(doc['content'])
            for i, chunk in enumerate(text_chunks):
                chunks.append({
                    'text': chunk,
                    'source': doc['source'],
                    'chunk_id': i
                })
        print(f"Split into {len(chunks)} chunks")
        return chunks

    def embed_and_upload(self, chunks: List[dict]):
        points = []
        for idx, chunk in enumerate(chunks):
            embedding = self.embedding_model.encode(chunk['text']).tolist()
            point = PointStruct(
                id = idx,
                vector=embedding,
                payload={
                    'text': chunk['text'],
                    'source': chunk['source'],
                    'chunk_id': chunk['chunk_id']
                }
            )
            points.append(point)

        self.qdrant_client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        print(f"Upload {len(points)} points to Qdrant")

    def search(self, query: str, limit: int = 3):
        query_embedding = self.embedding_model.encode(query).tolist()

        results = self.qdrant_client.query_points(
            collection_name=self.collection_name,
            query=query_embedding,
            limit=limit
        )

        context_chunks = []
        for result in results.points:
            context_chunks.append({
                'text': result.payload['text'],
                'source': result.payload['source'],
                'score': result.score
            })
        return context_chunks

    def list_documents(self):
        try:
            points,_ = self.qdrant_client.scroll(
                collection_name=self.collection_name,
                limit=1000,
                with_payload=True,
                with_vectors=False
            )

            docs_info = {}
            for point in points:
                source = point.payload.get('source', 'unknown')
                if source not in docs_info:
                    docs_info[source] = {
                        'source': source,
                        'chunk_count': 0,
                        'chunks': []
                    }
                docs_info[source]['chunk_count'] += 1
                docs_info[source]['chunks'].append(point.id)
            return list(docs_info.values())

        except Exception as e:
            print(f"Error listing documents: {e}")
            return []

    def add_document(self, file_path: str) -> int:
        try:
            filename = os.path.basename(file_path)
            if file_path.endswith('.pdf'):
                reader = PdfReader(file_path)
                content = ""
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        content += text + "\n"
            elif file_path.endswith('.txt'):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            else:
                raise ValueError("Chỉ hỗ trợ PDF hoặc TXT")

            if not content.strip():
                raise ValueError("File rỗng hoặc không đọc được")
            chunks = self.text_splitter.split_text(content)

            # Lấy ID lớn nhất hiện tại đêr tránh trùng
            existing_points, _ = self.qdrant_client.scroll(
                collection_name=self.collection_name,
                limit=10000,
                with_payload=False,
                with_vectors=False
            )
            max_id = max((p.id for p in existing_points), default=0)

            # Embed vaf upload
            points = []
            for i, chunk in enumerate(chunks):
                embedding = self.embedding_model.encode(chunk).tolist()
                points.append(PointStruct(
                    id = max_id + i + 1,
                    vector=embedding,
                    payload= {
                        'text': chunk,
                        'source': filename,
                        'chunk_id': i
                    }
                ))

            self.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=points
            )

            print(f"Đã thêm '{filename}' với {len(points)} chunks")
            return len(points)
        except Exception as e:
            print(f"Lỗi khi thêm document: {e}")
            raise

    def delete_document(self, source_filename: str):
        """Xóa tất cả chunks của 1 document"""
        try:
            # Tìm tất cả points có source = filename
            points,_ = self.qdrant_client.scroll(
                collection_name = self.collection_name,
                limit=1000,
                with_payload=True,
                with_vectors=False
            )

            # Lọc IDs cần xóa
            ids_to_delete = [
                point.id for point in points
                if point.payload.get('source') == source_filename
            ]

            if ids_to_delete:
                #Xóa points
                self.qdrant_client.delete(
                    collection_name=self.collection_name,
                    points_selector=ids_to_delete
                )

                print(f"Deleted {len(ids_to_delete)} chunks from '{source_filename}'")
                return len(ids_to_delete)
            else:
                print(f"No chunks found for '{source_filename}'")
                return 0
        except Exception as e:
            print(f"Error deleting document: {e}")
            return 0

    def get_collection_info(self):
        """Lấy thông tin collection"""
        try:
            info = self.qdrant_client.get_collection(self.collection_name)
            return {
                'total_points': info.points_count,
                'vector_size': info.config.params.vectors.size,
                'distance': info.config.params.vectors.distance.name
            }
        except Exception as e:
            print(f"Error getting collection info: {e}")
            return None

    def initialize_rag(self):
        print("Starting RAG initialization...")
        self.create_collection()
        documents = self.load_documents()
        chunks = self.chunk_documents(documents)
        self.embed_and_upload(chunks)
        print("RAG initialization completed!")


    def print_add_multiply_divide(self):
        total = 0

