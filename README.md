# Helpmate AI 🤖

An intelligent AI-powered learning assistant with RAG (Retrieval-Augmented Generation) capabilities. Upload your documents and get contextual, educational responses tailored to your learning level.

## ✨ Features

- **🧠 AI-Powered Chat** - Intelligent responses using advanced AI models
- **📄 Document Upload (RAG)** - Upload PDF, DOCX, DOC, or TXT files for context-aware answers
- **🎓 Learning Levels** - Customize responses for Beginner, Intermediate, or Advanced learners
- **🎯 Subject Focus** - Set specific subjects for more targeted responses
- **🎤 Voice Input** - Speak your questions using speech recognition
- **🔊 Text-to-Speech** - Listen to AI responses
- **🌙 Dark/Light Mode** - Toggle between themes for comfortable viewing
- **📋 Copy & Share** - Easily copy responses or share via social media
- **📱 Responsive Design** - Works seamlessly on desktop and mobile

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **React Markdown** - Markdown rendering
- **Axios** - HTTP client

### Backend
- **Express.js** - Node.js web framework
- **Multer** - File upload handling
- **PDF-Parse** - PDF text extraction
- **Mammoth** - DOCX text extraction

## 📋 Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/Helpmate-AI.git
cd Helpmate-AI
```

### 2. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd server
npm install
cd ..
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
VITE_API_KEY=your_openai_api_key_here
```

### 4. Run the Application

**Start the Backend Server:**
```bash
cd server
npm run dev
```
The server will run on `http://localhost:3001`

**Start the Frontend (in a new terminal):**
```bash
npm run dev
```
The application will open at `http://localhost:5173`

## 📜 Available Scripts

### Frontend (Root Directory)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

### Backend (Server Directory)

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with auto-reload |

## 📁 Project Structure

```
Helpmate-AI/
├── public/              # Static assets
├── server/              # Backend server
│   ├── index.js         # Express server entry point
│   ├── package.json     # Server dependencies
│   └── uploads/         # Uploaded documents storage
├── src/                 # Frontend source code
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── Footer.jsx       # Footer component
│   ├── main.jsx         # React entry point
│   ├── index.css        # Global styles
│   ├── assets/          # Static assets
│   └── components/      # Reusable components
│       ├── LoadingScreen.jsx
│       └── ShareButtons.jsx
├── index.html           # HTML entry point
├── package.json         # Frontend dependencies
├── tailwind.config.js   # Tailwind CSS configuration
├── postcss.config.js    # PostCSS configuration
└── vite.config.js       # Vite configuration
```

## 🎮 Usage

1. **Ask Questions** - Type your question in the input field and press Enter or click Send
2. **Upload Documents** - Click the upload button to add PDF, DOCX, or TXT files for context
3. **Set Learning Level** - Adjust between Beginner, Intermediate, or Advanced
4. **Use Voice** - Click the microphone icon to speak your question
5. **Listen to Response** - Click the speaker icon to hear the AI response
6. **Copy/Share** - Use the copy or share buttons to save or share responses

## 📄 Supported File Types

- PDF (`.pdf`)
- Microsoft Word (`.docx`, `.doc`)
- Plain Text (`.txt`)
- Maximum file size: 10MB

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for AI capabilities
- [React](https://react.dev/) for the UI framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Vite](https://vitejs.dev/) for the build tool
