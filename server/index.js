import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, DOC, and TXT files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// In-memory document store with chunks
const documentStore = {
  documents: [],
  chunks: []
};

// Text chunking function for RAG
function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        id: chunkIndex++,
        text: currentChunk.trim(),
        charStart: text.indexOf(currentChunk.trim())
      });
      // Keep overlap from previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: chunkIndex,
      text: currentChunk.trim(),
      charStart: text.indexOf(currentChunk.trim())
    });
  }

  return chunks;
}

// Simple keyword-based similarity (can be upgraded to embeddings)
function calculateSimilarity(query, text) {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();
  
  let score = 0;
  let matchedWords = [];
  
  for (const word of queryWords) {
    if (textLower.includes(word)) {
      score += 1;
      matchedWords.push(word);
    }
    // Bonus for exact phrase matches
    if (textLower.includes(query.toLowerCase())) {
      score += 5;
    }
  }
  
  // Normalize by query length
  return {
    score: queryWords.length > 0 ? score / queryWords.length : 0,
    matchedWords
  };
}

// Retrieve relevant chunks for RAG
function retrieveRelevantChunks(query, topK = 5) {
  if (documentStore.chunks.length === 0) {
    return [];
  }

  const scored = documentStore.chunks.map(chunk => ({
    ...chunk,
    similarity: calculateSimilarity(query, chunk.text)
  }));

  scored.sort((a, b) => b.similarity.score - a.similarity.score);
  
  return scored.slice(0, topK).filter(chunk => chunk.similarity.score > 0.1);
}

// Extract text from PDF
async function extractTextFromPDF(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

// Extract text from DOCX
async function extractTextFromDOCX(filePath) {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Extract text from TXT
async function extractTextFromTXT(filePath) {
  return await fs.readFile(filePath, 'utf-8');
}

// API Routes

// Upload document endpoint
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const mimeType = req.file.mimetype;
    let text = '';

    // Extract text based on file type
    if (mimeType === 'application/pdf') {
      text = await extractTextFromPDF(filePath);
    } else if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
      text = await extractTextFromDOCX(filePath);
    } else if (mimeType === 'text/plain') {
      text = await extractTextFromTXT(filePath);
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from document' });
    }

    // Create document entry
    const docId = Date.now().toString();
    const doc = {
      id: docId,
      name: fileName,
      uploadedAt: new Date().toISOString(),
      textLength: text.length,
      chunkCount: 0
    };

    // Chunk the text
    const chunks = chunkText(text);
    const docChunks = chunks.map(chunk => ({
      ...chunk,
      documentId: docId,
      documentName: fileName
    }));

    doc.chunkCount = docChunks.length;
    documentStore.documents.push(doc);
    documentStore.chunks.push(...docChunks);

    // Clean up uploaded file after processing
    await fs.unlink(filePath);

    res.json({
      success: true,
      document: doc,
      message: `Document "${fileName}" processed successfully with ${docChunks.length} chunks`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process document: ' + error.message });
  }
});

// Get all uploaded documents
app.get('/api/documents', (req, res) => {
  res.json({
    documents: documentStore.documents,
    totalChunks: documentStore.chunks.length
  });
});

// Delete a document
app.delete('/api/documents/:id', (req, res) => {
  const docId = req.params.id;
  const docIndex = documentStore.documents.findIndex(d => d.id === docId);
  
  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' });
  }

  documentStore.documents.splice(docIndex, 1);
  documentStore.chunks = documentStore.chunks.filter(c => c.documentId !== docId);

  res.json({ success: true, message: 'Document deleted' });
});

// RAG Query endpoint - retrieves relevant context
app.post('/api/query', (req, res) => {
  const { query, topK = 5 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const relevantChunks = retrieveRelevantChunks(query, topK);
  
  res.json({
    query,
    chunks: relevantChunks,
    hasContext: relevantChunks.length > 0
  });
});

// Build RAG prompt endpoint
app.post('/api/build-prompt', (req, res) => {
  const { 
    query, 
    learnerLevel = 'intermediate',
    subject = 'General',
    learningObjective = ''
  } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const relevantChunks = retrieveRelevantChunks(query, 5);
  
  // Build context from retrieved chunks
  const context = relevantChunks.length > 0
    ? relevantChunks.map((chunk, i) => 
        `[Source ${i + 1} - ${chunk.documentName}]:\n${chunk.text}`
      ).join('\n\n')
    : '';

  // Build the hallucination-preventing educational prompt
  const systemPrompt = buildEducationalPrompt({
    context,
    query,
    learnerLevel,
    subject,
    learningObjective,
    hasContext: relevantChunks.length > 0
  });

  res.json({
    prompt: systemPrompt,
    context,
    sources: relevantChunks.map(c => ({
      documentName: c.documentName,
      excerpt: c.text.substring(0, 150) + '...',
      similarity: c.similarity.score
    })),
    hasContext: relevantChunks.length > 0
  });
});

// Build educational prompt with hallucination prevention
function buildEducationalPrompt({ context, query, learnerLevel, subject, learningObjective, hasContext }) {
  const levelGuidelines = {
    beginner: `
- Use simple, everyday language and avoid jargon
- Break down concepts into small, digestible steps
- Provide relatable analogies and real-world examples
- Define any technical terms when first introduced
- Use encouraging and supportive tone`,
    intermediate: `
- Balance technical accuracy with accessibility
- Assume basic foundational knowledge
- Provide moderate depth with practical examples
- Connect concepts to broader themes
- Include some technical terminology with brief explanations`,
    advanced: `
- Use precise technical language appropriate for the field
- Provide in-depth analysis and nuanced explanations
- Reference advanced concepts and interconnections
- Include edge cases and complex scenarios
- Encourage critical thinking and deeper exploration`
  };

  const basePrompt = `You are an expert educational content generator focused on creating accurate, curriculum-aligned learning material.

## CRITICAL INSTRUCTIONS FOR ACCURACY AND HALLUCINATION PREVENTION:
${hasContext ? `
1. **ONLY use information from the provided context** to answer the question
2. **DO NOT invent, fabricate, or assume any facts** not explicitly stated in the context
3. If the context doesn't contain enough information, clearly state: "Based on the provided materials, I don't have sufficient information to fully answer this question"
4. **Always cite your sources** by referencing [Source X] when using information from the context
5. If you need to provide general knowledge beyond the context, clearly distinguish it: "Additionally, from general knowledge..."
` : `
1. Since no curriculum documents have been uploaded, I will provide general educational content
2. I will clearly indicate when information is from general knowledge
3. I recommend uploading relevant curriculum documents for more accurate, curriculum-aligned responses
`}

## LEARNER LEVEL: ${learnerLevel.toUpperCase()}
${levelGuidelines[learnerLevel] || levelGuidelines.intermediate}

## SUBJECT AREA: ${subject}

${learningObjective ? `## LEARNING OBJECTIVE: ${learningObjective}
- Keep all content focused on achieving this objective
- Avoid tangential information that doesn't serve this goal
` : ''}

## BIAS PREVENTION GUIDELINES:
- Present information objectively and factually
- Avoid cultural, gender, or socioeconomic biases
- Use inclusive language and diverse examples
- Present multiple perspectives where appropriate
- Avoid stereotypes in examples and analogies

${hasContext ? `## PROVIDED CONTEXT (Curriculum/Learning Materials):
${context}

---` : '## NOTE: No curriculum documents uploaded yet. Please upload PDF or Word documents containing your curriculum materials for RAG-based accurate responses.'}

## STUDENT QUESTION:
${query}

## YOUR RESPONSE:
Provide a clear, educational response that:
1. ${hasContext ? 'Is grounded in the provided context with citations [Source X]' : 'Is accurate and educational'}
2. Matches the ${learnerLevel} level appropriately
3. Stays focused on the learning objective
4. Avoids hallucinations and unsupported claims
5. Is inclusive and unbiased

Response:`;

  return basePrompt;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    documentsLoaded: documentStore.documents.length,
    totalChunks: documentStore.chunks.length
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Learning-Aware RAG Server running on http://localhost:${PORT}`);
  console.log(`📚 Upload documents to /api/upload`);
  console.log(`🔍 Query with RAG at /api/build-prompt`);
});

export default app;
