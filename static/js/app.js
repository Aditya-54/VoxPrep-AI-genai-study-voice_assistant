// ==========================================
// GLOBALS & STATE
// ==========================================
let currentSection = 'library';
let quizMode = 'text'; // 'text' or 'viva'
let activeQuestion = null;
let activeNotes = [];
let mediaRecorder = null;
let audioChunks = [];
let recordInterval = null;
let recordSeconds = 0;
let isRecording = false;
let isFollowUpStep = false;
let originalAnswerText = "";
let audioContext = null;
let analyser = null;
let canvasContext = null;
let animationFrameId = null;

// ==========================================
// ON INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initRouting();
    initLibrary();
    initQuiz();
    initResearch();
    refreshAllData();
});

function refreshAllData() {
    fetchStats();
    fetchFiles();
    fetchNotes();
}

// ==========================================
// SPA ROUTING
// ==========================================
function initRouting() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = item.getAttribute('data-section');
            
            navItems.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(`section-${targetSection}`).classList.add('active');
            currentSection = targetSection;
            
            // Reload specific elements on view switch
            if (targetSection === 'library') {
                refreshAllData();
            } else if (targetSection === 'quiz') {
                populateTopicSelector();
            } else if (targetSection === 'research') {
                fetchNotes();
            }
        });
    });
}

// ==========================================
// SECTION 1: LIBRARY & STATS
// ==========================================
function initLibrary() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    // Drag and drop events
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });
}

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        document.getElementById('stat-attempts').textContent = data.total_attempts;
        document.getElementById('stat-accuracy').textContent = `${data.average_accuracy}%`;
        
        // Clean up weakest/strongest names
        const cleanName = (n) => {
            if (!n || n === 'N/A') return 'N/A';
            return n.length > 20 ? n.substring(0, 18) + '...' : n;
        };
        
        document.getElementById('stat-weakest').textContent = cleanName(data.weakest_topic);
        document.getElementById('stat-strongest').textContent = cleanName(data.strongest_topic);
    } catch (e) {
        console.error("Failed to fetch stats", e);
    }
}

async function fetchFiles() {
    try {
        const res = await fetch('/api/files');
        const files = await res.json();
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';

        if (files.length === 0) {
            fileList.innerHTML = '<li class="empty-list-msg">No files uploaded yet. Add files on the left!</li>';
            return;
        }

        files.forEach(f => {
            const li = document.createElement('li');
            const sizeKB = (f.size / 1024).toFixed(1);
            
            // Format icons
            let iconClass = 'fa-file-pdf';
            if (f.name.endsWith('.docx')) iconClass = 'fa-file-word';
            if (f.name.endsWith('.pptx')) iconClass = 'fa-file-powerpoint';
            
            li.innerHTML = `
                <div class="file-info">
                    <i class="fa-solid ${iconClass}"></i>
                    <span class="file-name" title="${f.name}">${f.name}</span>
                    <span class="file-size">(${sizeKB} KB)</span>
                </div>
                <button class="btn-icon btn-danger" onclick="deleteFile('${f.name}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            fileList.appendChild(li);
        });
    } catch (e) {
        console.error("Failed to fetch files", e);
    }
}

async function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete '${filename}'? This will remove its indexed content from the vector search database.`)) {
        return;
    }
    try {
        const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        const data = await res.json();
        
        showUploadStatus(data.message, 'success');
        refreshAllData();
    } catch (e) {
        showUploadStatus(`Failed to delete file: ${e}`, 'error');
    }
}

async function handleFileUpload(file) {
    const statusDiv = document.getElementById('upload-status');
    showUploadStatus("Uploading and indexing document... Please wait.", "info");

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            showUploadStatus(data.message, 'success');
            refreshAllData();
        } else {
            showUploadStatus(data.detail || "Upload failed.", 'error');
        }
    } catch (e) {
        showUploadStatus(`Network error during upload: ${e}`, 'error');
    }
}

function showUploadStatus(msg, type) {
    const statusDiv = document.getElementById('upload-status');
    statusDiv.textContent = msg;
    statusDiv.className = `status-msg ${type}`;
}

// ==========================================
// SECTION 2: STUDY CENTER (QUIZ / VIVA)
// ==========================================
function initQuiz() {
    const modeTextBtn = document.getElementById('mode-text-btn');
    const modeVivaBtn = document.getElementById('mode-viva-btn');
    const inputTextContainer = document.getElementById('input-text-container');
    const inputVivaContainer = document.getElementById('input-viva-container');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    const audioSpeakBtn = document.getElementById('audio-speak-btn');
    const submitBtn = document.getElementById('submit-answer-btn');
    const recordBtn = document.getElementById('record-btn');

    modeTextBtn.addEventListener('click', () => {
        modeTextBtn.classList.add('active');
        modeVivaBtn.classList.remove('active');
        inputTextContainer.classList.remove('hidden');
        inputVivaContainer.classList.add('hidden');
        quizMode = 'text';
    });

    modeVivaBtn.addEventListener('click', () => {
        modeVivaBtn.classList.add('active');
        modeTextBtn.classList.remove('active');
        inputVivaContainer.classList.remove('hidden');
        inputTextContainer.classList.add('hidden');
        quizMode = 'viva';
    });

    startQuizBtn.addEventListener('click', generateQuestion);
    audioSpeakBtn.addEventListener('click', () => {
        if (activeQuestion) speakText(activeQuestion.question);
    });

    submitBtn.addEventListener('click', submitAnswer);
    recordBtn.addEventListener('click', toggleRecording);
}

async function populateTopicSelector() {
    try {
        const res = await fetch('/api/files');
        const files = await res.json();
        const selector = document.getElementById('quiz-topic-select');
        
        // Preserve selection or index
        const currentVal = selector.value;
        selector.innerHTML = '<option value="">Smart Weighted (Focuses on weaker areas)</option>';

        files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.name;
            opt.textContent = f.name;
            selector.appendChild(opt);
        });

        selector.value = currentVal;
    } catch (e) {
        console.error("Failed to populate topic selector", e);
    }
}

async function generateQuestion() {
    const topic = document.getElementById('quiz-topic-select').value;
    const startBtn = document.getElementById('start-quiz-btn');
    
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Retrieving...';

    // Hide old feedback
    document.getElementById('question-card').classList.add('hidden');
    document.getElementById('answer-card').classList.add('hidden');
    document.getElementById('feedback-card').classList.add('hidden');
    
    // Clear answer inputs
    document.getElementById('answer-text-input').value = "";
    isFollowUpStep = false;
    originalAnswerText = "";

    try {
        const res = await fetch(`/api/question?topic=${encodeURIComponent(topic)}`);
        const data = await res.json();

        if (data.status === 'success') {
            activeQuestion = data;
            
            // Populate Question Card
            document.getElementById('quest-text').textContent = data.question;
            document.getElementById('quest-topic-tag').textContent = data.source_metadata.source_file;
            document.getElementById('quest-page-tag').textContent = `Page/Slide ${data.source_metadata.page_number}`;
            
            document.getElementById('question-card').classList.remove('hidden');
            document.getElementById('answer-card').classList.remove('hidden');

            // Speak question if Viva Mode is selected
            if (quizMode === 'viva') {
                speakText(data.question);
            }
        } else {
            alert(data.message || "Failed to load question.");
        }
    } catch (e) {
        alert(`Error loading question: ${e}`);
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Generate Question';
    }
}

async function speakText(text) {
    try {
        const audio = new Audio(`/api/voice/speak?text=${encodeURIComponent(text)}`);
        audio.play();
    } catch (e) {
        console.error("Text-to-speech error", e);
    }
}

// Spoken Viva Voice recording controls
async function toggleRecording() {
    const recordBtn = document.getElementById('record-btn');
    const statusLabel = document.getElementById('record-status-label');
    
    if (isRecording) {
        // Stop recording
        stopRecordingAudio();
    } else {
        // Start recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            startRecordingAudio(stream);
        } catch (e) {
            alert("Microphone access denied or unavailable.");
        }
    }
}

function startRecordingAudio(stream) {
    const recordBtn = document.getElementById('record-btn');
    const statusLabel = document.getElementById('record-status-label');
    const timerText = document.getElementById('record-timer');
    const canvas = document.getElementById('waveform-canvas');
    
    isRecording = true;
    recordBtn.classList.add('recording');
    statusLabel.textContent = "Listening... Press Enter (or click mic again) to stop.";
    canvas.style.display = "block";

    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            audioChunks.push(e.data);
        }
    };

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        
        // Auto transcribe
        await handleTranscription(audioBlob);
    };

    mediaRecorder.start();

    // Start timer stopwatch
    recordSeconds = 0;
    timerText.textContent = "00:00";
    recordInterval = setInterval(() => {
        recordSeconds++;
        const mins = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
        const secs = String(recordSeconds % 60).padStart(2, '0');
        timerText.textContent = `${mins}:${secs}`;
    }, 1000);

    // Dynamic wave visualizer
    initWaveformVisualizer(stream);
    
    // Add Enter key event listener to stop recording easily
    window.addEventListener('keydown', handleRecordingKeyPress);
}

function handleRecordingKeyPress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        stopRecordingAudio();
    }
}

function stopRecordingAudio() {
    if (!isRecording) return;
    
    const recordBtn = document.getElementById('record-btn');
    const statusLabel = document.getElementById('record-status-label');
    const canvas = document.getElementById('waveform-canvas');

    isRecording = false;
    recordBtn.classList.remove('recording');
    statusLabel.textContent = "Processing audio...";
    canvas.style.display = "none";

    if (mediaRecorder) {
        mediaRecorder.stop();
    }

    clearInterval(recordInterval);
    cancelAnimationFrame(animationFrameId);
    
    window.removeEventListener('keydown', handleRecordingKeyPress);
}

function initWaveformVisualizer(stream) {
    const canvas = document.getElementById('waveform-canvas');
    canvasContext = canvas.getContext('2d');
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        if (!isRecording) return;
        animationFrameId = requestAnimationFrame(draw);
        
        analyser.getByteFrequencyData(dataArray);
        
        canvasContext.fillStyle = '#12121f';
        canvasContext.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for(let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            
            // cyan to violet gradient bars
            canvasContext.fillStyle = `rgb(${barHeight+100}, ${50}, ${250})`;
            canvasContext.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    draw();
}

async function handleTranscription(audioBlob) {
    const statusLabel = document.getElementById('record-status-label');
    const formData = new FormData();
    formData.append('file', audioBlob, 'record.webm');

    try {
        const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.status === 'success' && data.transcription) {
            // Update input or submit
            if (quizMode === 'viva') {
                statusLabel.textContent = `Heard: "${data.transcription}"`;
                
                // Submit through Vague Check or Grading pipeline
                await processVivaTranscription(data.transcription);
            } else {
                // If user uses voice inside Text Quiz mode
                document.getElementById('answer-text-input').value = data.transcription;
                statusLabel.textContent = "Click mic to start recording";
            }
        } else {
            statusLabel.textContent = "Could not transcribe audio. Please type answer.";
        }
    } catch (e) {
        statusLabel.textContent = `Error transcribing: ${e}`;
    }
}

// Logic for spoken Viva evaluation
async function processVivaTranscription(answerText) {
    if (!isFollowUpStep) {
        // First answer step. Check if vague.
        originalAnswerText = answerText;
        
        const loader = document.getElementById('quiz-processing');
        loader.classList.remove('hidden');
        
        try {
            const res = await fetch('/api/vague_check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: activeQuestion.question, answer: answerText })
            });
            const data = await res.json();
            
            loader.classList.add('hidden');
            
            if (data.is_vague && data.follow_up) {
                // Vague! Ask follow-up question.
                isFollowUpStep = true;
                
                // Set UI state to follow-up
                document.getElementById('record-status-label').textContent = "Clarification needed...";
                speakText(data.follow_up);
                
                // Display the follow-up text next to the question in the UI
                const questBox = document.getElementById('quest-text');
                questBox.innerHTML = `${activeQuestion.question} <br><br><span style="color: var(--color-partial); font-size: 1.15rem;"><i class="fa-solid fa-circle-question"></i> Proctor Follow-up: ${data.follow_up}</span>`;
            } else {
                // Not vague. Submit for grading directly.
                await submitGrade(answerText);
            }
        } catch (e) {
            loader.classList.add('hidden');
            console.error("Vague check failed", e);
            await submitGrade(answerText); // Fallback to immediate grading
        }
    } else {
        // This is the second response (clarification input)
        const combinedAnswer = `${originalAnswerText} (Clarification: ${answerText})`;
        await submitGrade(combinedAnswer);
    }
}

async function submitAnswer() {
    let answerText = "";
    if (quizMode === 'text') {
        answerText = document.getElementById('answer-text-input').value.trim();
        if (!answerText) {
            alert("Please type an answer first.");
            return;
        }
        await submitGrade(answerText);
    } else {
        // Spoken answer submission fallback
        const recordLabel = document.getElementById('record-status-label').textContent;
        // Check if transcription text is available
        const match = recordLabel.match(/Heard: "(.*?)"/);
        if (match && match[1]) {
            if (isFollowUpStep) {
                const combined = `${originalAnswerText} (Clarification: ${match[1]})`;
                await submitGrade(combined);
            } else {
                await submitGrade(match[1]);
            }
        } else {
            alert("No spoken answer captured. Please record or type your answer.");
        }
    }
}

async function submitGrade(answerText) {
    const submitBtn = document.getElementById('submit-answer-btn');
    const loader = document.getElementById('quiz-processing');
    const feedbackCard = document.getElementById('feedback-card');
    
    submitBtn.disabled = true;
    loader.classList.remove('hidden');
    feedbackCard.classList.add('hidden');

    try {
        const res = await fetch('/api/grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_dict: activeQuestion, user_answer: answerText })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            // Apply verdict styles
            feedbackCard.className = `glass-card feedback-card ${data.verdict.toLowerCase().replace(' ', '')}-style`;
            
            document.getElementById('feedback-verdict-badge').textContent = data.verdict;
            document.getElementById('feedback-explanation').textContent = data.explanation;
            document.getElementById('feedback-citation').textContent = data.cited_source;
            
            feedbackCard.classList.remove('hidden');
            
            // Speak grade aloud in Viva Mode
            if (quizMode === 'viva') {
                const voiceSpeech = `Your answer was graded as ${data.verdict}. ${data.explanation}`;
                speakText(voiceSpeech);
            }
            
            // Refresh stats
            fetchStats();
        } else {
            alert(data.explanation || "Failed to grade answer.");
        }
    } catch (e) {
        alert(`Error grading answer: ${e}`);
    } finally {
        submitBtn.disabled = false;
        loader.classList.add('hidden');
    }
}

// ==========================================
// SECTION 3: RESEARCH & NOTES
// ==========================================
function initResearch() {
    const chatTextInput = document.getElementById('chat-text-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMicBtn = document.getElementById('chat-record-btn');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const deleteNoteBtn = document.getElementById('delete-note-btn');
    const noteSelect = document.getElementById('editor-note-select');

    chatSendBtn.addEventListener('click', sendResearchMessage);
    chatTextInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendResearchMessage();
    });

    chatMicBtn.addEventListener('click', toggleChatRecording);

    saveNoteBtn.addEventListener('click', saveNote);
    deleteNoteBtn.addEventListener('click', deleteNote);
    noteSelect.addEventListener('change', loadSelectedNote);
}

// Spoken chat query recording
async function toggleChatRecording() {
    const micBtn = document.getElementById('chat-record-btn');
    const statusDiv = document.getElementById('chat-status');
    
    if (isRecording) {
        // Stop recording
        isRecording = false;
        micBtn.classList.remove('recording');
        statusDiv.textContent = "Processing speech...";
        
        if (mediaRecorder) mediaRecorder.stop();
        clearInterval(recordInterval);
    } else {
        // Start recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            isRecording = true;
            micBtn.classList.add('recording');
            statusDiv.classList.remove('hidden');
            statusDiv.textContent = "Listening... Click mic again to stop.";
            
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                stream.getTracks().forEach(t => t.stop());
                
                // Transcribe and populate input
                statusDiv.textContent = "Transcribing query...";
                const formData = new FormData();
                formData.append('file', audioBlob, 'record.webm');
                
                try {
                    const res = await fetch('/api/voice/transcribe', { method: 'POST', body: formData });
                    const data = await res.json();
                    
                    statusDiv.classList.add('hidden');
                    if (data.status === 'success' && data.transcription) {
                        document.getElementById('chat-text-input').value = data.transcription;
                        sendResearchMessage(); // Auto-send
                    }
                } catch(e) {
                    statusDiv.textContent = "ASR Failed.";
                }
            };
            
            mediaRecorder.start();
        } catch (e) {
            alert("Microphone error.");
        }
    }
}

async function sendResearchMessage() {
    const chatInput = document.getElementById('chat-text-input');
    const queryText = chatInput.value.trim();
    if (!queryText) return;

    chatInput.value = "";
    appendChatMessage(queryText, 'user');

    const chatStatus = document.getElementById('chat-status');
    chatStatus.classList.remove('hidden');
    chatStatus.textContent = "Searching documents knowledge base...";

    try {
        const res = await fetch('/api/research/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryText })
        });
        const data = await res.json();
        
        chatStatus.classList.add('hidden');
        
        // Format RAG Response in Chat bubbles
        let textAnswer = formatMarkdownToHTML(data.answer);
        
        // Append citations
        if (data.citations && data.citations.length > 0) {
            const uniqueCitations = getUniqueCitations(data.citations);
            textAnswer += `<div style="margin-top: 10px;">`;
            uniqueCitations.forEach(c => {
                textAnswer += `<span class="chat-citation-tag"><i class="fa-solid fa-file-invoice"></i> ${c.source} (Page: ${c.page})</span> `;
            });
            textAnswer += `</div>`;
        }

        appendChatMessage(textAnswer, 'assistant');
        
    } catch (e) {
        chatStatus.textContent = "RAG search failed.";
        appendChatMessage(`Failed to retrieve research query: ${e}`, 'assistant');
    }
}

function getUniqueCitations(citations) {
    const seen = new Set();
    const unique = [];
    citations.forEach(c => {
        const key = `${c.source}_${c.page}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(c);
        }
    });
    return unique;
}

function appendChatMessage(html, sender) {
    const chatBox = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;
    msgDiv.innerHTML = html;
    
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatMarkdownToHTML(md) {
    // Simple markdown formatting helper
    let html = md
        .replace(/\n\n/g, '<p></p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^- (.*?)(?:<br>|$)/gm, '<li>$1</li>');
        
    // Wrap lists
    html = html.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
    return html;
}

// Notes Editor CRUD logic
async function fetchNotes() {
    try {
        const res = await fetch('/api/notes');
        activeNotes = await res.json();
        
        const noteSelect = document.getElementById('editor-note-select');
        const selectedId = noteSelect.value;
        
        noteSelect.innerHTML = '<option value="">-- Start a New Note --</option>';
        activeNotes.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n.id;
            opt.textContent = n.title;
            noteSelect.appendChild(opt);
        });
        
        noteSelect.value = selectedId;
    } catch (e) {
        console.error("Failed to load notes choices", e);
    }
}

function loadSelectedNote() {
    const noteId = document.getElementById('editor-note-select').value;
    const deleteBtn = document.getElementById('delete-note-btn');

    if (!noteId) {
        // Reset Editor
        document.getElementById('note-title').value = "";
        document.getElementById('note-topic').value = "";
        document.getElementById('note-content').value = "";
        deleteBtn.classList.add('hidden');
        return;
    }

    const note = activeNotes.find(n => n.id == noteId);
    if (note) {
        document.getElementById('note-title').value = note.title;
        document.getElementById('note-topic').value = note.topic;
        document.getElementById('note-content').value = note.content;
        deleteBtn.classList.remove('hidden');
    }
}

async function saveNote() {
    const title = document.getElementById('note-title').value.trim();
    const topic = document.getElementById('note-topic').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const noteSelect = document.getElementById('editor-note-select');
    const noteId = noteSelect.value ? parseInt(noteSelect.value) : null;

    if (!title || !content) {
        alert("Note must contain a Title and Content body.");
        return;
    }

    const saveBtn = document.getElementById('save-note-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving & Indexing...';

    try {
        const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, topic, note_id: noteId })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            await fetchNotes();
            
            // Set selection to the saved note
            document.getElementById('editor-note-select').value = data.note_id;
            document.getElementById('delete-note-btn').classList.remove('hidden');
            
            alert(data.message);
        }
    } catch (e) {
        alert(`Error saving note: ${e}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save & Index Note';
    }
}

async function deleteNote() {
    const noteSelect = document.getElementById('editor-note-select');
    const noteId = noteSelect.value;
    if (!noteId) return;

    if (!confirm("Are you sure you want to delete this study note? It will be removed from your RAG search indexes.")) {
        return;
    }

    try {
        const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
        const data = await res.json();
        
        alert(data.message);
        noteSelect.value = "";
        loadSelectedNote(); // Reset editor fields
        await fetchNotes();
    } catch (e) {
        alert(`Failed to delete note: ${e}`);
    }
}
