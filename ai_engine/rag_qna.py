import os
import PyPDF2
import docx2txt
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from groq import Groq
from pptx import Presentation
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Groq
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("Warning: GROQ_API_KEY not found. Please set it in .env")

client = Groq(api_key=api_key)

def extract_text_from_pdf(file_path):
    text = ""
    try:
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        print(f"Error reading PDF {file_path}: {e}")
    return text

def extract_text_from_docx(file_path):
    try:
        return docx2txt.process(file_path)
    except Exception as e:
        print(f"Error reading DOCX {file_path}: {e}")
        return ""

def extract_text_from_pptx(file_path):
    text = ""
    try:
        prs = Presentation(file_path)
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text += shape.text + "\n"
    except Exception as e:
        print(f"Error reading PPTX {file_path}: {e}")
    return text

def extract_text(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    if file_path.endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    elif file_path.endswith(".docx"):
        return extract_text_from_docx(file_path)
    elif file_path.endswith(".pptx"):
        return extract_text_from_pptx(file_path)
    else:
        raise ValueError("Unsupported file type")

def chunk_text(text, chunk_size=300):
    words = text.split()
    chunks = []
    # Overlapping chunks for better context in retrieval
    step = int(chunk_size * 0.8) 
    for i in range(0, len(words), step):
        chunks.append(" ".join(words[i:i+chunk_size]))
    return chunks

def build_vector_store(chunks):
    # Use TF-IDF for lightweight, dependency-free retrieval
    try:
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(chunks)
        return {"vectorizer": vectorizer, "matrix": tfidf_matrix}, chunks
    except Exception as e:
        raise RuntimeError(f"Failed to build search index: {e}")

def retrieve(query, index, chunks, top_k=3):
    try:
        vectorizer = index["vectorizer"]
        tfidf_matrix = index["matrix"]
        
        query_vec = vectorizer.transform([query])
        
        # Calculate cosine similarity
        similarities = cosine_similarity(query_vec, tfidf_matrix).flatten()
        
        # Get top k indices
        top_indices = similarities.argsort()[-top_k:][::-1]
        
        return [chunks[i] for i in top_indices]
    except Exception as e:
        print(f"Retrieval failed: {e}")
        return []

def answer_question(query, index, chunks):
    retrieved_chunks = retrieve(query, index, chunks, top_k=3)
    if not retrieved_chunks:
        return "Could not retrieve context to answer the question."
        
    context = "\n---\n".join(retrieved_chunks)
    
    prompt = f"""
    Answer the question based only on the following content. Do not invent information. Be accurate and unbiased.

    Content: 
    {context}

    Question: {query}
    """
    
    max_retries = 3
    base_delay = 2
    import time

    for attempt in range(max_retries):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.2,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                if attempt < max_retries - 1:
                    wait_time = base_delay * (2 ** attempt)
                    print(f"Rate limit hit. Retrying in {wait_time} s...")
                    time.sleep(wait_time)
                    continue
                else:
                    return f"Error: API error: 429 (Rate Limit Exceeded)."
            return f"Error generating answer: {e}"

def main():
    file_path = "example.pdf"
    
    if not os.path.exists(file_path):
        print(f"Sample file '{file_path}' not found. Please provide a valid file.")
        return

    print(f"Extracting text from {file_path}...")
    text = extract_text(file_path)
    if not text:
        print("No text extracted.")
        return

    print("Chunking text...")
    chunks = chunk_text(text, chunk_size=300)

    print("Building search index (TF-IDF)...")
    try:
        index, chunks = build_vector_store(chunks)
    except Exception as e:
        print(f"Failed to build vector store: {e}")
        return

    query = "Explain the main process described in this document."
    print(f"Querying: {query}")
    answer = answer_question(query, index, chunks)
    print("Answer:", answer)

if __name__ == "__main__":
    main()