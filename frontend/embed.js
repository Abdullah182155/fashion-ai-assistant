/**
 * Fashion AI Chatbot - Embeddable Widget Script
 * Add this script to any website to embed the chatbot
 * 
 * Usage: <script src="http://localhost:3000/embed.js"></script>
 */

(function () {
    'use strict';

    // Configuration
    const WIDGET_URL = 'http://localhost:3000';
    const WIDGET_ID = 'fashion-ai-chatbot-embed';

    // Check if already loaded
    if (document.getElementById(WIDGET_ID)) {
        console.log('Fashion AI Chatbot already loaded');
        return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = WIDGET_ID;

    // Inject styles
    const styles = document.createElement('style');
    styles.textContent = `
        #${WIDGET_ID} {
            position: fixed;
            bottom: 0;
            right: 0;
            z-index: 999999;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        #${WIDGET_ID} .fab-chat-icon {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);
            transition: all 0.3s ease;
            animation: fab-pulse 2s infinite;
        }

        #${WIDGET_ID} .fab-chat-icon:hover {
            transform: scale(1.1);
        }

        #${WIDGET_ID} .fab-chat-icon svg {
            width: 28px;
            height: 28px;
            color: white;
        }

        #${WIDGET_ID} .fab-badge {
            position: absolute;
            top: -4px;
            right: -4px;
            background: #ec4899;
            color: white;
            font-size: 10px;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 12px;
        }

        @keyframes fab-pulse {
            0%, 100% { box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4); }
            50% { box-shadow: 0 8px 48px rgba(99, 102, 241, 0.6); }
        }

        #${WIDGET_ID} .fab-iframe-container {
            position: fixed;
            bottom: 100px;
            right: 24px;
            width: 400px;
            height: 600px;
            max-width: calc(100vw - 48px);
            max-height: calc(100vh - 124px);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            display: none;
            background: #0f0f23;
        }

        #${WIDGET_ID} .fab-iframe-container.open {
            display: block;
            animation: fab-slide-up 0.3s ease;
        }

        @keyframes fab-slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        #${WIDGET_ID} .fab-iframe-container iframe {
            width: 100%;
            height: 100%;
            border: none;
        }

        @media (max-width: 480px) {
            #${WIDGET_ID} .fab-iframe-container {
                width: calc(100vw - 24px);
                height: calc(100vh - 100px);
                right: 12px;
                bottom: 88px;
                border-radius: 16px;
            }

            #${WIDGET_ID} .fab-chat-icon {
                width: 56px;
                height: 56px;
                right: 16px;
                bottom: 16px;
            }
        }
    `;

    // Create chat icon button
    const chatIcon = document.createElement('button');
    chatIcon.className = 'fab-chat-icon';
    chatIcon.setAttribute('aria-label', 'Open Fashion AI Chat');
    chatIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span class="fab-badge">AI</span>
    `;

    // Create iframe container
    const iframeContainer = document.createElement('div');
    iframeContainer.className = 'fab-iframe-container';

    // Create iframe (loads the full widget)
    const iframe = document.createElement('iframe');
    iframe.src = WIDGET_URL;
    iframe.title = 'Fashion AI Chatbot';
    iframe.allow = 'microphone; camera';

    // Toggle chat
    let isOpen = false;
    chatIcon.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
            iframeContainer.classList.add('open');
        } else {
            iframeContainer.classList.remove('open');
        }
    });

    // Listen for close messages from iframe
    window.addEventListener('message', (event) => {
        if (event.origin === WIDGET_URL && event.data === 'close-chat') {
            isOpen = false;
            iframeContainer.classList.remove('open');
        }
    });

    // Assemble widget
    iframeContainer.appendChild(iframe);
    container.appendChild(styles);
    container.appendChild(chatIcon);
    container.appendChild(iframeContainer);

    // Add to page
    document.body.appendChild(container);

    console.log('🎨 Fashion AI Chatbot Widget embedded');

})();
