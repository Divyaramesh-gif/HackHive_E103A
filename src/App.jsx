import { useState, useEffect, useRef } from "react";
import {
  Copy,
  Send,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Share2,
  Check,
  Mic,
  MicOff,
  Upload,
  FileText,
  X,
  BookOpen,
  GraduationCap,
  Target,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import Footer from "./Footer";

const API_BASE = "http://localhost:3001/api";

function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [generatingAnswer, setGeneratingAnswer] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const chatEndRef = useRef(null);

  // RAG-related state
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  
  // Educational settings
  const [learnerLevel, setLearnerLevel] = useState("intermediate");
  const [subject, setSubject] = useState("General");
  const [learningObjective, setLearningObjective] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 500);
    fetchDocuments();
    
    if ("webkitSpeechRecognition" in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuestion(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    }
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/documents`);
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    const formData = new FormData();
    formData.append("document", file);

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadSuccess(data.message);
      fetchDocuments();
      setTimeout(() => setUploadSuccess(""), 5000);
    } catch (error) {
      setUploadError(error.message);
      setTimeout(() => setUploadError(""), 5000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const deleteDocument = async (docId) => {
    try {
      await fetch(`${API_BASE}/documents/${docId}`, { method: "DELETE" });
      fetchDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const toggleListening = () => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const toggleSpeaking = (text) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.onend = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const shareContent = async (text) => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        console.log("Share cancelled");
      }
    } else {
      copyToClipboard(text, -1);
    }
  };

  const handleSubmit = async () => {
    if (!question.trim() || generatingAnswer) return;

    setGeneratingAnswer(true);
    const userQuestion = question;
    setQuestion("");

    setChatHistory((prev) => [
      ...prev,
      { type: "question", text: userQuestion },
    ]);

    try {
      // Step 1: Get RAG context from backend
      const ragResponse = await fetch(`${API_BASE}/build-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userQuestion,
          learnerLevel,
          subject,
          learningObjective,
        }),
      });

      if (!ragResponse.ok) {
        throw new Error("Backend server not responding. Make sure the server is running on port 3001.");
      }

      const ragData = await ragResponse.json();

      // Step 2: Send to Gemini with RAG-enhanced prompt
      const apiKey = import.meta.env.VITE_API_GENERATIVE_LANGUAGE_CLIENT;
      
      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        throw new Error("API key not configured! Please add your Gemini API key to .env.local file.");
      }
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: ragData.prompt }] }],
            generationConfig: {
              temperature: 0.3, // Lower temperature for more factual responses
              topP: 0.8,
              topK: 40,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      if (data?.candidates?.length > 0) {
        const fullAnswer = data.candidates[0].content.parts[0].text;
        setChatHistory((prev) => [
          ...prev,
          { 
            type: "answer", 
            text: fullAnswer,
            sources: ragData.sources,
            hasContext: ragData.hasContext,
            level: learnerLevel
          },
        ]);
      } else {
        throw new Error("Invalid API response");
      }
    } catch (error) {
      console.error("Error:", error);
      setChatHistory((prev) => [
        ...prev,
        { type: "answer", text: `❌ Error: ${error.message}` },
      ]);
    }

    setGeneratingAnswer(false);
  };

  const bgGradient = darkMode
    ? "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900"
    : "bg-gradient-to-br from-blue-50 via-white to-indigo-50";
  const navBg = darkMode ? "bg-slate-900/80" : "bg-white/80";
  const chatBg = darkMode ? "bg-slate-800/50" : "bg-white/70";
  const userBubble = darkMode
    ? "bg-gradient-to-r from-blue-600 to-blue-500"
    : "bg-gradient-to-r from-blue-500 to-indigo-500";
  const aiBubble = darkMode ? "bg-slate-700/70" : "bg-slate-100";
  const textColor = darkMode ? "text-white" : "text-slate-900";
  const mutedText = darkMode ? "text-slate-400" : "text-slate-600";
  const panelBg = darkMode ? "bg-slate-800" : "bg-white";
  const borderColor = darkMode ? "border-slate-700" : "border-slate-200";

  return (
    <div
      className={`min-h-screen ${bgGradient} ${textColor} transition-all duration-700 ${
        isLoaded ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Navbar */}
      <nav
        className={`${navBg} backdrop-blur-md border-b ${borderColor} sticky top-0 z-50`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                  darkMode
                    ? "from-blue-500 to-purple-600"
                    : "from-blue-400 to-indigo-500"
                } flex items-center justify-center shadow-lg`}
              >
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Learning AI Assistant
                </h1>
                <p className={`text-xs ${mutedText}`}>
                  RAG-Powered Educational Content
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Documents indicator */}
              <div className={`px-3 py-1 rounded-full text-xs ${
                documents.length > 0 
                  ? "bg-green-500/20 text-green-400" 
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {documents.length} doc{documents.length !== 1 ? 's' : ''} loaded
              </div>
              
              {/* Upload button */}
              <button
                onClick={() => setShowUploadPanel(!showUploadPanel)}
                className={`p-2.5 rounded-lg ${
                  darkMode
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-slate-200 hover:bg-slate-300"
                } transition-all duration-300`}
                title="Upload curriculum documents"
              >
                <Upload className="w-5 h-5" />
              </button>

              {/* Settings button */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2.5 rounded-lg ${
                  darkMode
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-slate-200 hover:bg-slate-300"
                } transition-all duration-300`}
                title="Learning settings"
              >
                <Target className="w-5 h-5" />
              </button>

              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2.5 rounded-lg ${
                  darkMode
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-slate-200 hover:bg-slate-300"
                } transition-all duration-300`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Upload Panel */}
      {showUploadPanel && (
        <div className={`${panelBg} border-b ${borderColor} px-4 py-4`}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Curriculum Documents
              </h3>
              <button 
                onClick={() => setShowUploadPanel(false)}
                className={`p-1 rounded hover:bg-slate-600`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload area */}
            <div className={`border-2 border-dashed ${borderColor} rounded-xl p-6 text-center mb-4`}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                ) : (
                  <Upload className="w-8 h-8 text-blue-500" />
                )}
                <span className="font-medium">
                  {uploading ? "Processing..." : "Click to upload PDF, DOCX, or TXT"}
                </span>
                <span className={`text-sm ${mutedText}`}>
                  Upload curriculum materials, syllabi, or learning content
                </span>
              </label>
            </div>

            {/* Status messages */}
            {uploadError && (
              <div className="flex items-center gap-2 text-red-400 mb-4">
                <AlertCircle className="w-4 h-4" />
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="flex items-center gap-2 text-green-400 mb-4">
                <CheckCircle2 className="w-4 h-4" />
                {uploadSuccess}
              </div>
            )}

            {/* Document list */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm ${mutedText}`}>Uploaded Documents:</h4>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      darkMode ? "bg-slate-700" : "bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium text-sm">{doc.name}</p>
                        <p className={`text-xs ${mutedText}`}>
                          {doc.chunkCount} chunks • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className={`${panelBg} border-b ${borderColor} px-4 py-4`}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="w-5 h-5" />
                Learning Settings
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className={`p-1 rounded hover:bg-slate-600`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Learner Level */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${mutedText}`}>
                  Learner Level
                </label>
                <select
                  value={learnerLevel}
                  onChange={(e) => setLearnerLevel(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${borderColor} ${
                    darkMode ? "bg-slate-700" : "bg-white"
                  } ${textColor}`}
                >
                  <option value="beginner">🌱 Beginner</option>
                  <option value="intermediate">📚 Intermediate</option>
                  <option value="advanced">🎓 Advanced</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${mutedText}`}>
                  Subject Area
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics, Physics"
                  className={`w-full p-2 rounded-lg border ${borderColor} ${
                    darkMode ? "bg-slate-700" : "bg-white"
                  } ${textColor}`}
                />
              </div>

              {/* Learning Objective */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${mutedText}`}>
                  Learning Objective
                </label>
                <input
                  type="text"
                  value={learningObjective}
                  onChange={(e) => setLearningObjective(e.target.value)}
                  placeholder="e.g., Understand quadratic equations"
                  className={`w-full p-2 rounded-lg border ${borderColor} ${
                    darkMode ? "bg-slate-700" : "bg-white"
                  } ${textColor}`}
                />
              </div>
            </div>

            <div className={`mt-4 p-3 rounded-lg ${darkMode ? "bg-slate-700/50" : "bg-blue-50"}`}>
              <p className={`text-sm ${mutedText}`}>
                <strong>How it works:</strong> Upload your curriculum documents (PDF/DOCX), and the AI will use 
                Retrieval-Augmented Generation (RAG) to answer questions based on your materials, 
                preventing hallucinations and ensuring curriculum alignment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-32">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <div
              className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${
                darkMode
                  ? "from-blue-500 to-purple-600"
                  : "from-blue-400 to-indigo-500"
              } flex items-center justify-center shadow-2xl`}
            >
              <GraduationCap className="w-12 h-12 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-bold">
                Learning-Aware AI Assistant
              </h2>
              <p className={`${mutedText} text-lg mt-2`}>
                Upload curriculum documents and ask questions
              </p>
              <p className={`${mutedText} text-sm mt-1`}>
                RAG-powered responses • No hallucinations • Level-appropriate
              </p>
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
              <button
                onClick={() => setShowUploadPanel(true)}
                className={`p-6 rounded-xl ${chatBg} backdrop-blur-sm border shadow-md ${borderColor} hover:border-blue-500 transition-all duration-300 text-left hover:scale-105`}
              >
                <Upload className="w-8 h-8 text-blue-500 mb-3" />
                <p className="font-semibold">Upload Curriculum</p>
                <p className={`text-sm ${mutedText}`}>
                  Add PDF or Word documents with learning materials
                </p>
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className={`p-6 rounded-xl ${chatBg} backdrop-blur-sm border shadow-md ${borderColor} hover:border-purple-500 transition-all duration-300 text-left hover:scale-105`}
              >
                <Target className="w-8 h-8 text-purple-500 mb-3" />
                <p className="font-semibold">Set Learning Level</p>
                <p className={`text-sm ${mutedText}`}>
                  Configure learner level and subject area
                </p>
              </button>
            </div>

            {/* Example prompts */}
            <div className="w-full max-w-2xl mt-4">
              <p className={`text-sm ${mutedText} mb-3`}>Example questions:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Explain the concept from Chapter 1",
                  "Create practice questions on this topic",
                  "Summarize the key learning points",
                  "Give me examples for beginners"
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setQuestion(prompt)}
                    className={`px-4 py-2 rounded-full text-sm ${
                      darkMode 
                        ? "bg-slate-700 hover:bg-slate-600" 
                        : "bg-slate-200 hover:bg-slate-300"
                    } transition-all`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Area */
          <div className="chat-container space-y-6">
            {chatHistory.map((chat, index) => (
              <div
                key={index}
                className={`flex ${
                  chat.type === "question" ? "justify-end" : "justify-start"
                } animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-lg ${
                    chat.type === "question"
                      ? `${userBubble} text-white`
                      : `${aiBubble} ${darkMode ? "text-slate-100" : "text-slate-800"}`
                  }`}
                >
                  {chat.type === "answer" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{chat.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">
                      {chat.text}
                    </div>
                  )}
                  
                  {/* Source citations for RAG responses */}
                  {chat.type === "answer" && chat.sources && chat.sources.length > 0 && (
                    <div className={`mt-3 pt-3 border-t ${darkMode ? "border-slate-600" : "border-slate-300"}`}>
                      <p className={`text-xs font-semibold mb-2 ${mutedText}`}>
                        📚 Sources from uploaded documents:
                      </p>
                      <div className="space-y-1">
                        {chat.sources.map((source, i) => (
                          <div key={i} className={`text-xs ${mutedText} flex items-start gap-1`}>
                            <span className="text-blue-400">[{i + 1}]</span>
                            <span>{source.documentName}: "{source.excerpt}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Level indicator */}
                  {chat.type === "answer" && chat.level && (
                    <div className={`mt-2 text-xs ${mutedText}`}>
                      📊 Level: {chat.level} | {chat.hasContext ? "✅ RAG-grounded" : "⚠️ General knowledge"}
                    </div>
                  )}

                  {chat.type === "answer" && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-500/30">
                      <button
                        onClick={() => toggleSpeaking(chat.text)}
                        className={`p-2 rounded-lg transition-all ${
                          darkMode ? "hover:bg-slate-600" : "hover:bg-slate-200"
                        }`}
                        title={isSpeaking ? "Stop" : "Read aloud"}
                      >
                        {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(chat.text, index)}
                        className={`p-2 rounded-lg transition-all ${
                          darkMode ? "hover:bg-slate-600" : "hover:bg-slate-200"
                        }`}
                        title="Copy"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => shareContent(chat.text)}
                        className={`p-2 rounded-lg transition-all ${
                          darkMode ? "hover:bg-slate-600" : "hover:bg-slate-200"
                        }`}
                        title="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {generatingAnswer && (
              <div className="flex justify-start animate-fade-in">
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 ${aiBubble} shadow-lg`}>
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-2">
                      <div className={`w-2 h-2 rounded-full ${darkMode ? "bg-blue-400" : "bg-blue-500"} animate-bounce`} style={{ animationDelay: "0ms" }}></div>
                      <div className={`w-2 h-2 rounded-full ${darkMode ? "bg-blue-400" : "bg-blue-500"} animate-bounce`} style={{ animationDelay: "150ms" }}></div>
                      <div className={`w-2 h-2 rounded-full ${darkMode ? "bg-blue-400" : "bg-blue-500"} animate-bounce`} style={{ animationDelay: "300ms" }}></div>
                    </div>
                    <span className={`text-sm ${mutedText}`}>Searching curriculum & generating...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Chat Input */}
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Level indicator above input */}
            <div className={`flex items-center gap-2 mb-2 text-xs ${mutedText}`}>
              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                {learnerLevel === "beginner" ? "🌱" : learnerLevel === "advanced" ? "🎓" : "📚"} {learnerLevel}
              </span>
              {subject !== "General" && (
                <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400">
                  {subject}
                </span>
              )}
              {documents.length > 0 && (
                <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
                  RAG Active
                </span>
              )}
            </div>
            
            <div
              className={`flex items-center gap-3 px-4 py-2 rounded-2xl shadow-lg border transition-all duration-300 ${
                darkMode
                  ? "bg-slate-800/90 border-slate-700"
                  : "bg-white/90 border-slate-200"
              }`}
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={documents.length > 0 
                  ? "Ask about your curriculum materials..." 
                  : "Upload documents first for RAG, or ask general questions..."}
                rows={1}
                className={`flex-1 bg-transparent outline-none resize-none py-2 text-sm leading-relaxed ${textColor}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              {recognition && (
                <button
                  onClick={toggleListening}
                  className={`p-3 rounded-xl transition-all duration-300 shadow-md ${
                    isListening
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-slate-600 hover:bg-slate-500"
                  }`}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5 text-white" />
                  ) : (
                    <Mic className="w-5 h-5 text-white" />
                  )}
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={generatingAnswer || !question.trim()}
                className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all duration-300 shadow-md"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t bg-gradient-to-t from-black/20 to-transparent backdrop-blur-md"
        style={{
          borderColor: darkMode ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
        }}
      >
        <Footer darkMode={darkMode} />
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .chat-container {
          max-height: calc(100vh - 280px);
          overflow-y: auto;
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}

export default App;
