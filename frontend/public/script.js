/**
 * Fashion AI Chatbot - Widget Script
 * Handles chat interactions, API calls, and UI updates
 */

(function () {
    'use strict';

    // DOM Elements
    const chatIcon = document.getElementById('chat-icon');
    const chatModal = document.getElementById('chat-modal');
    const closeModal = document.getElementById('close-modal');
    const modalOverlay = chatModal?.querySelector('.modal-overlay');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const imageUpload = document.getElementById('image-upload');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image');
    const exampleBtns = document.querySelectorAll('.example-btn');
    const genderFilter = document.getElementById('gender-filter');
    const newChatBtn = document.getElementById('new-chat-btn');
    const micBtn = document.getElementById('mic-btn');

    // State
    let selectedImage = null;
    let isLoading = false;
    let chatHistory = [];
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];

    // LocalStorage key
    const CHAT_HISTORY_KEY = 'dressify_chat_history';

    // API Configuration
    const API_BASE = '/api';

    // ==========================================================================
    // CHAT HISTORY MANAGEMENT
    // ==========================================================================

    function saveChatHistory() {
        try {
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
        } catch (e) {
            console.warn('Failed to save chat history:', e);
        }
    }

    function loadChatHistory() {
        try {
            const saved = localStorage.getItem(CHAT_HISTORY_KEY);
            if (saved) {
                chatHistory = JSON.parse(saved);
                restoreChatMessages();
            }
        } catch (e) {
            console.warn('Failed to load chat history:', e);
            chatHistory = [];
        }
    }

    function restoreChatMessages() {
        // Keep the welcome message, remove others
        const welcomeMsg = chatMessages.querySelector('.welcome-message');
        chatMessages.innerHTML = '';
        if (welcomeMsg) chatMessages.appendChild(welcomeMsg);

        // Restore saved messages
        chatHistory.forEach(msg => {
            if (msg.type === 'user') {
                addMessageFromHistory(msg.content, true);
            } else if (msg.type === 'bot') {
                addMessageFromHistory(msg.content, false);
            } else if (msg.type === 'results' && msg.results) {
                const resultsElement = renderResults(msg.results);
                if (resultsElement.children.length > 0) {
                    addMessageFromHistory(resultsElement, false);
                }
            }
        });
    }

    function addMessageFromHistory(content, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = isUser ? '👤' : '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (typeof content === 'string') {
            contentDiv.innerHTML = formatMessage(content);
        } else {
            contentDiv.appendChild(content);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
    }

    function clearChatHistory() {
        chatHistory = [];
        localStorage.removeItem(CHAT_HISTORY_KEY);

        // Reset chat UI to just welcome message
        chatMessages.innerHTML = `
            <div class="message bot-message welcome-message">
                <div class="message-avatar">✨</div>
                <div class="message-content">
                    <p>👋 <strong>Hello! I'm your AI Personal Stylist.</strong></p>
                    <p>I can help you find the perfect outfit, match items, or discover new trends.</p>
                    <p><em>Try asking me anything or upload a photo to get started! 📸</em></p>
                </div>
            </div>
        `;
    }

    // New Chat button handler
    newChatBtn?.addEventListener('click', () => {
        clearChatHistory();
    });

    // Load chat history on startup
    loadChatHistory();

    // ==========================================================================
    // VOICE RECORDING
    // ==========================================================================

    let audioContext = null;

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Initialize AudioContext for WAV conversion
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                // Create audio blob and convert to WAV
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const wavBlob = await convertToWav(audioBlob);

                // Send to backend for transcription
                await transcribeAudio(wavBlob);
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording');
            micBtn.title = 'Stop recording';

        } catch (err) {
            console.error('Microphone access denied:', err);
            addMessage('❌ Microphone access denied. Please allow microphone access to use voice input.', false, false);
        }
    }

    async function convertToWav(blob) {
        // Decode audio data
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Convert to WAV format
        const wavBuffer = audioBufferToWav(audioBuffer);
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    function audioBufferToWav(buffer) {
        const numChannels = 1; // Mono
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        // Get mono audio data
        const channelData = buffer.getChannelData(0);
        const samples = new Int16Array(channelData.length);

        // Convert float to int16
        for (let i = 0; i < channelData.length; i++) {
            const s = Math.max(-1, Math.min(1, channelData[i]));
            samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Create WAV file
        const dataLength = samples.length * 2;
        const buffer2 = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer2);

        // WAV header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true);
        view.setUint16(32, numChannels * bitDepth / 8, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write audio data
        const offset = 44;
        for (let i = 0; i < samples.length; i++) {
            view.setInt16(offset + i * 2, samples[i], true);
        }

        return buffer2;
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.title = 'Voice input';
    }

    async function transcribeAudio(audioBlob) {
        // Show transcribing indicator
        addMessage('🎤 Transcribing your voice...', false, false);

        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');

            const response = await fetch(`${API_BASE}/voice/transcribe`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            // Remove the transcribing message
            const lastMsg = chatMessages.lastElementChild;
            if (lastMsg && lastMsg.textContent.includes('Transcribing')) {
                lastMsg.remove();
            }

            if (data.success && data.text) {
                // Put transcribed text in input
                chatInput.value = data.text;
                updateSendButton();

                // Auto-send the transcribed text
                handleSend();
            } else {
                addMessage('❌ Could not transcribe audio. Please try again.', false, false);
            }

        } catch (err) {
            console.error('Transcription error:', err);
            addMessage('❌ Transcription failed. Please try again.', false, false);
        }
    }

    // Mic button click handler
    micBtn?.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // ==========================================================================
    // MODAL CONTROLS
    // ==========================================================================

    function openModal() {
        chatModal.classList.add('open');
        document.body.style.overflow = 'hidden';
        chatInput.focus();
    }

    function closeModalHandler() {
        chatModal.classList.remove('open');
        document.body.style.overflow = '';
    }

    chatIcon?.addEventListener('click', openModal);
    closeModal?.addEventListener('click', closeModalHandler);
    modalOverlay?.addEventListener('click', closeModalHandler);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && chatModal.classList.contains('open')) {
            closeModalHandler();
        }
    });

    // ==========================================================================
    // INPUT HANDLING
    // ==========================================================================

    function updateSendButton() {
        const hasText = chatInput.value.trim().length > 0;
        const hasImage = selectedImage !== null;
        sendBtn.disabled = !(hasText || hasImage) || isLoading;
    }

    chatInput?.addEventListener('input', updateSendButton);

    chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !sendBtn.disabled) {
            e.preventDefault();
            handleSend();
        }
    });

    sendBtn?.addEventListener('click', handleSend);

    // ==========================================================================
    // IMAGE UPLOAD
    // ==========================================================================

    imageUpload?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedImage = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreviewContainer.classList.add('show');
            };
            reader.readAsDataURL(file);
            updateSendButton();
        }
    });

    removeImageBtn?.addEventListener('click', () => {
        selectedImage = null;
        imagePreview.src = '';
        imagePreviewContainer.classList.remove('show');
        imageUpload.value = '';
        updateSendButton();
    });

    // ==========================================================================
    // EXAMPLE BUTTONS
    // ==========================================================================

    exampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.dataset.query;
            if (query) {
                openModal();
                chatInput.value = query;
                updateSendButton();
                setTimeout(() => handleSend(), 300);
            }
        });
    });

    // ==========================================================================
    // MESSAGE HANDLING
    // ==========================================================================

    function addMessage(content, isUser = false, saveToHistory = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = isUser ? '👤' : '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (typeof content === 'string') {
            contentDiv.innerHTML = formatMessage(content);
            // Save text messages to history
            if (saveToHistory) {
                chatHistory.push({ type: isUser ? 'user' : 'bot', content: content });
                saveChatHistory();
            }
        } else {
            contentDiv.appendChild(content);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        scrollToBottom();
        return messageDiv;
    }

    function addTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message typing-message';
        messageDiv.id = 'typing-indicator';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        scrollToBottom();
        return messageDiv;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function formatMessage(text) {
        // Convert markdown-like formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/• /g, '&bull; ')
            .replace(/└─/g, '&nbsp;&nbsp;└─');
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ==========================================================================
    // RESULTS RENDERING
    // ==========================================================================

    function renderResults(searchResults) {
        if (!searchResults || searchResults.length === 0) {
            return document.createElement('div');
        }

        const container = document.createElement('div');

        const categoryEmojis = {
            'top': '👕',
            'bottom': '👖',
            'footwear': '👟',
            'accessories': '👜',
            'watches': '⌚',
            'similar': '🔍',
            'general': '📦'
        };

        // Render each query group separately (not grouped by category)
        searchResults.forEach(group => {
            if (!group.items || group.items.length === 0) return;

            const cat = group.category || 'general';
            const queryText = group.query_text || cat;
            const items = group.items;

            // Query header
            const header = document.createElement('div');
            header.className = 'category-header';
            header.innerHTML = `
                <span class="category-icon">${categoryEmojis[cat] || '📦'}</span>
                <span>${queryText} (${items.length} items)</span>
            `;
            container.appendChild(header);

            // Results gallery - show up to 5 items per query
            const gallery = document.createElement('div');
            gallery.className = 'results-gallery';

            items.slice(0, 5).forEach(item => {
                const card = createResultCard(item);
                gallery.appendChild(card);
            });

            container.appendChild(gallery);
        });

        return container;
    }

    function createResultCard(item) {
        const card = document.createElement('div');
        card.className = 'result-card';

        // Get the correct product ID (could be item.id, image_id, or id field)
        const productId = item.image_id || item.id || item.product_id;

        // Add onclick handler to open product detail
        card.onclick = () => {
            console.log('Clicked product:', productId, item);
            if (window.app && window.app.showProductDetail) {
                // Close the chat modal first
                closeModalHandler();
                // Then navigate to product
                setTimeout(() => {
                    window.app.showProductDetail(productId);
                }, 100);
            }
        };

        // Image URL - use API endpoint or direct path
        const imageUrl = item.thumbnail_url
            ? `/images/${productId}.jpg`
            : '/assets/placeholder.jpg';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${item.title}" loading="lazy" 
                 onerror="this.src='data:image/svg+xml,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3e%3crect fill=%22%231a1a3e%22 width=%22100%22 height=%22100%22/%3e%3ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 fill=%22%236366f1%22 font-size=%2240%22%3e👗%3c/text%3e%3c/svg%3e'">
            <button class="tryon-button">✨ Try On</button>
            <div class="result-info">
                <div class="result-header">
                    <div class="result-title">${item.title || 'Fashion Item'}</div>
                    <div class="result-price">$${item.price || 'N/A'}</div>
                </div>
                <div class="result-meta">${item.brand || ''} ${item.color || ''}</div>
                <span class="result-score">${(item.score * 100).toFixed(0)}% match</span>
            </div>
        `;

        // Add Try On button click handler
        const tryOnBtn = card.querySelector('.tryon-button');
        if (tryOnBtn) {
            tryOnBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                
                // Open try-on modal
                if (window.openTryOnModal) {
                    window.openTryOnModal(productId, item.title || 'Fashion Item', imageUrl);
                } else {
                    console.error('Try-on modal not initialized');
                }
            });
        }

        return card;
    }

    // ==========================================================================
    // API COMMUNICATION
    // ==========================================================================

    async function handleSend() {
        if (isLoading) return;

        const query = chatInput.value.trim();
        const hasImage = selectedImage !== null;

        if (!query && !hasImage) return;

        isLoading = true;
        updateSendButton();

        // Show user message
        let userMessageText = query || '📸 [Image uploaded]';
        if (hasImage && query) {
            userMessageText = `📸 + "${query}"`;
        }
        addMessage(userMessageText, true);

        // Clear input
        chatInput.value = '';
        if (selectedImage) {
            imagePreviewContainer.classList.remove('show');
        }

        // Show typing indicator
        addTypingIndicator();

        try {
            // Prepare form data
            const formData = new FormData();
            formData.append('text_query', query);
            formData.append('gender_filter', genderFilter?.value || 'both');

            // Generate or retrieve session ID
            let sessionId = sessionStorage.getItem('dressify_session_id');
            if (!sessionId) {
                sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
                sessionStorage.setItem('dressify_session_id', sessionId);
            }
            formData.append('session_id', sessionId);

            if (selectedImage) {
                formData.append('image', selectedImage);
            }

            // Make API call
            const response = await fetch(`${API_BASE}/search`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            // Remove typing indicator
            removeTypingIndicator();

            if (data.success) {
                // Add text response
                addMessage(data.final_response || 'Search completed!');

                // Add results if available
                if (data.search_results_data && data.search_results_data.length > 0) {
                    const resultsElement = renderResults(data.search_results_data);
                    if (resultsElement.children.length > 0) {
                        addMessage(resultsElement);
                    }
                }
            } else {
                addMessage(`❌ ${data.final_response || 'Something went wrong. Please try again.'}`);
            }

        } catch (error) {
            console.error('Search error:', error);
            removeTypingIndicator();
            addMessage('❌ Connection error. Please make sure the backend is running.');
        }

        // Reset state
        selectedImage = null;
        imageUpload.value = '';
        isLoading = false;
        updateSendButton();
    }


    // ==========================================================================
    // VIRTUAL TRY-ON FUNCTIONALITY
    // ==========================================================================

    let tryOnModal = null;
    let selectedPersonImage = null;
    let currentGarmentId = null;

    function createTryOnModal() {
        const modal = document.createElement('div');
        modal.id = 'tryon-modal';
        modal.className = 'tryon-modal';
        modal.innerHTML = `
            <div class="tryon-overlay"></div>
            <div class="tryon-container">
                <div class="tryon-header">
                    <h2>✨ Virtual Try-On</h2>
                    <button class="tryon-close" id="tryon-close-btn">&times;</button>
                </div>
                <div class="tryon-content">
                    <div class="tryon-section">
                        <h3>Step 1: Upload Your Photo</h3>
                        <div class="person-upload-area" id="person-upload-area">
                            <input type="file" id="person-image-input" accept="image/*" style="display:none">
                            <div class="upload-placeholder" id="upload-placeholder">
                                <div class="upload-icon">📸</div>
                                <p>Click or drag to upload</p>
                                <small>Upload a photo of yourself</small>
                            </div>
                            <img id="person-preview" class="person-preview" style="display:none">
                        </div>
                    </div>
                    <div class="tryon-section">
                        <h3>Step 2: Selected Item</h3>
                        <div class="garment-preview-area">
                            <img id="garment-preview" class="garment-preview">
                            <p id="garment-title" class="garment-title"></p>
                        </div>
                    </div>
                    <div class="tryon-section full-width">
                        <h3>Result</h3>
                        <div class="result-area" id="tryon-result-area">
                            <div class="result-placeholder">
                                <p>Your try-on result will appear here</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tryon-footer">
                    <button class="btn-secondary" id="cancel-tryon-btn">Cancel</button>
                    <button class="btn-primary" id="generate-tryon-btn" disabled>
                        <span class="btn-text">Generate Try-On</span>
                        <span class="btn-loading" style="display:none">
                            <span class="spinner"></span> Processing...
                        </span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function openTryOnModal(productId, productTitle, productImageUrl) {
        if (!tryOnModal) {
            tryOnModal = createTryOnModal();
            setupTryOnListeners();
        }

        currentGarmentId = productId;
        selectedPersonImage = null;

        // Set garment preview
        const garmentPreview = document.getElementById('garment-preview');
        const garmentTitle = document.getElementById('garment-title');
        garmentPreview.src = productImageUrl;
        garmentTitle.textContent = productTitle;

        // Reset UI
        const personPreview = document.getElementById('person-preview');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const generateBtn = document.getElementById('generate-tryon-btn');
        const resultArea = document.getElementById('tryon-result-area');

        personPreview.style.display = 'none';
        personPreview.src = '';
        uploadPlaceholder.style.display = 'flex';
        generateBtn.disabled = true;
        resultArea.innerHTML = `
            <div class="result-placeholder">
                <p>Your try-on result will appear here</p>
            </div>
        `;

        // Show modal
        tryOnModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeTryOnModal() {
        if (tryOnModal) {
            tryOnModal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function setupTryOnListeners() {
        const personImageInput = document.getElementById('person-image-input');
        const uploadArea = document.getElementById('person-upload-area');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const personPreview = document.getElementById('person-preview');
        const closeBtn = document.getElementById('tryon-close-btn');
        const cancelBtn = document.getElementById('cancel-tryon-btn');
        const generateBtn = document.getElementById('generate-tryon-btn');
        const overlay = tryOnModal.querySelector('.tryon-overlay');

        // Click to upload
        uploadArea.addEventListener('click', () => {
            personImageInput.click();
        });

        // File input change
        personImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handlePersonImageUpload(file);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handlePersonImageUpload(file);
            }
        });

        // Close handlers
        closeBtn.addEventListener('click', closeTryOnModal);
        cancelBtn.addEventListener('click', closeTryOnModal);
        overlay.addEventListener('click', closeTryOnModal);

        // Generate button
        generateBtn.addEventListener('click', handleGenerateTryOn);
    }

    function handlePersonImageUpload(file) {
        selectedPersonImage = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            const personPreview = document.getElementById('person-preview');
            const uploadPlaceholder = document.getElementById('upload-placeholder');
            const generateBtn = document.getElementById('generate-tryon-btn');

            personPreview.src = e.target.result;
            personPreview.style.display = 'block';
            uploadPlaceholder.style.display = 'none';
            generateBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    async function handleGenerateTryOn() {
        if (!selectedPersonImage || !currentGarmentId) return;

        const generateBtn = document.getElementById('generate-tryon-btn');
        const btnText = generateBtn.querySelector('.btn-text');
        const btnLoading = generateBtn.querySelector('.btn-loading');
        const resultArea = document.getElementById('tryon-result-area');

        // Show loading state
        generateBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';

        resultArea.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Generating your virtual try-on...</p>
                <small>This may take up to 2 minutes</small>
            </div>
        `;

        try {
            const formData = new FormData();
            formData.append('person_image', selectedPersonImage);
            formData.append('garment_product_id', currentGarmentId);
            formData.append('randomize_seed', 'true');

            const response = await fetch(`${API_BASE}/tryon`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success && data.result_image) {
                // Display result
                resultArea.innerHTML = `
                    <div class="result-success">
                        <img src="data:image/jpeg;base64,${data.result_image}" alt="Try-on result" class="result-image">
                        <div class="result-actions">
                            <button class="btn-download" onclick="downloadTryOnResult('${data.result_image}')">
                                📥 Download
                            </button>
                            <button class="btn-share" onclick="shareTryOnResult()">
                                📤 Share
                            </button>
                        </div>
                    </div>
                `;
            } else {
                resultArea.innerHTML = `
                    <div class="result-error">
                        <p>❌ ${data.error || data.info || 'Failed to generate try-on'}</p>
                        <button class="btn-retry" onclick="document.getElementById('generate-tryon-btn').click()">
                            Try Again
                        </button>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Try-on error:', error);
            resultArea.innerHTML = `
                <div class="result-error">
                    <p>❌ Connection error. Make sure the Kolors service is running.</p>
                    <small>${error.message}</small>
                </div>
            `;
        } finally {
            // Reset button state
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
            generateBtn.disabled = false;
        }
    }

    // Make openTryOnModal globally accessible
    window.openTryOnModal = openTryOnModal;

    // Helper function for downloading result
    window.downloadTryOnResult = function(base64Image) {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64Image}`;
        link.download = `tryon-result-${Date.now()}.jpg`;
        link.click();
    };

    window.shareTryOnResult = function() {
        alert('Share functionality coming soon!');
    };

    // ==========================================================================
    // HEALTH CHECK
    // ==========================================================================

    async function checkHealth() {
        try {
            const response = await fetch(`${API_BASE}/health`);
            const data = await response.json();

            if (data.status === 'ready') {
                console.log('✅ Fashion AI Backend is ready');
                console.log(`   Index: ${data.index_size} items`);
                console.log(`   Vocabulary: ${data.vocabulary_items} items, ${data.vocabulary_colors} colors`);
            } else {
                console.log('⏳ Backend is initializing...');
            }
        } catch (error) {
            console.log('⚠️ Backend not available. Make sure to run the backend server.');
        }
    }

    // Run health check on load
    checkHealth();

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================

    console.log('🎨 Fashion AI Chatbot Widget loaded');
    updateSendButton();

})();
