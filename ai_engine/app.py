import streamlit as st
import os
import learning_ai
import rag_qna
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="Hacktide AI", page_icon="🌊", layout="wide")

st.title("🌊 Hacktide AI Assistant")

tab1, tab2 = st.tabs(["📚 Learning AI", "📄 Document Q&A"])

# --- TAB 1: LEARNING AI ---
with tab1:
    st.header("Generate Educational Content")
    
    col1, col2 = st.columns(2)
    with col1:
        topic = st.text_input("Topic", "Photosynthesis")
        level = st.selectbox("Level", ["Beginner", "Intermediate", "Advanced"])
    with col2:
        curriculum = st.text_input("Curriculum", "CBSE Class 7")
        objective = st.text_input("Learning Objective", "Understand the process")

    if st.button("Generate Content"):
        with st.spinner("Generating content..."):
            result = learning_ai.generate_content(topic, level, curriculum, objective)
            
            if result.startswith("Error:"):
                st.error(result)
            else:
                st.markdown(result)

# --- TAB 2: RAG Q&A ---
with tab2:
    st.header("Chat with your Documents")
    
    # Initialize session state for RAG
    if "rag_index" not in st.session_state:
        st.session_state.rag_index = None
    if "rag_chunks" not in st.session_state:
        st.session_state.rag_chunks = None
    if "messages" not in st.session_state:
        st.session_state["messages"] = [{"role": "assistant", "content": "Upload a document and ask me anything!"}]

    # File Uploader
    uploaded_file = st.file_uploader("Upload PDF, DOCX, or PPTX", type=["pdf", "docx", "pptx"])
    
    if uploaded_file is not None:
        # Save file locally to process
        file_path = os.path.join(os.getcwd(), uploaded_file.name)
        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        
        # Process file if not already processed
        if st.button("Process Document"):
            with st.spinner("Analyzing document..."):
                text = rag_qna.extract_text(file_path)
                if text:
                    chunks = rag_qna.chunk_text(text)
                    index, chunks = rag_qna.build_vector_store(chunks)
                    st.session_state.rag_index = index
                    st.session_state.rag_chunks = chunks
                    st.success("Document processed successfully!")
                else:
                    st.error("Could not extract text from document.")

    # Chat Interface
    for msg in st.session_state.messages:
        st.chat_message(msg["role"]).write(msg["content"])

    if prompt := st.chat_input():
        if not st.session_state.rag_index:
            st.error("Please upload and process a document first.")
        else:
            st.session_state.messages.append({"role": "user", "content": prompt})
            st.chat_message("user").write(prompt)
            
            with st.spinner("Thinking..."):
                response = rag_qna.answer_question(
                    prompt, 
                    st.session_state.rag_index, 
                    st.session_state.rag_chunks
                )
                
                if response.startswith("Error:"):
                    st.error(response)
                    # Don't add error to chat history if it's a system error, or do? 
                    # Let's add it so user sees the flow.
                    st.session_state.messages.append({"role": "assistant", "content": f"⚠️ {response}"})
                elif response == "Could not retrieve context to answer the question.":
                     st.error("The AI cannot answer this question based on the document.")
                     st.session_state.messages.append({"role": "assistant", "content": "I cannot answer this question based on the provided document."})
                else:
                    st.session_state.messages.append({"role": "assistant", "content": response})
                    st.chat_message("assistant").write(response)

