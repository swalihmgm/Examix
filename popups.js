(function () {
    // Inject CSS for the custom modal
    const style = document.createElement('style');
    style.textContent = `
        #custom-popup-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(8px);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }

        #custom-popup-card {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 30px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            transform: scale(0.95);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            text-align: center;
        }

        #custom-popup-overlay.active {
            display: flex;
        }

        #custom-popup-overlay.active #custom-popup-card {
            transform: scale(1);
        }

        #custom-popup-title {
            font-family: 'Outfit', sans-serif;
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #fff;
        }

        #custom-popup-message {
            color: #94A3B8;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 24px;
        }

        .popup-btn-container {
            display: flex;
            gap: 12px;
            justify-content: center;
        }

        .popup-btn {
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        }

        .popup-btn-primary {
            background: linear-gradient(135deg, #8B5CF6, #6D28D9);
            color: white;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        }

        .popup-btn-primary:hover {
            transform: translateY(-2px);
            filter: brightness(1.1);
        }

        .popup-btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            color: #94A3B8;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .popup-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    function injectPopup() {
        if (!document.body || document.getElementById('custom-popup-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'custom-popup-overlay';
        overlay.innerHTML = `
            <div id="custom-popup-card">
                <div id="custom-popup-title">Notification</div>
                <div id="custom-popup-message">Message text goes here.</div>
                <input type="text" id="custom-popup-input" style="display:none; width:100%; padding: 12px; margin-bottom: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; outline: none; transition: border-color 0.2s;" />
                <div class="popup-btn-container">
                    <button id="custom-popup-cancel" class="popup-btn popup-btn-secondary">Cancel</button>
                    <button id="custom-popup-ok" class="popup-btn popup-btn-primary">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const okBtn = overlay.querySelector('#custom-popup-ok');
        const cancelBtn = overlay.querySelector('#custom-popup-cancel');
        const inputEl = overlay.querySelector('#custom-popup-input');

        overlay.onclick = (e) => {
            if (e.target === overlay && cancelBtn.style.display !== 'none') {
                window._closePopup(null);
            }
        };

        okBtn.onclick = () => window._closePopup(true);
        cancelBtn.onclick = () => window._closePopup(false);

        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') window._closePopup(true);
            if (e.key === 'Escape') window._closePopup(false);
        };
    }

    let currentResolve = null;
    let currentPopupType = 'alert';

    window._closePopup = function (value) {
        const overlay = document.getElementById('custom-popup-overlay');
        const inputEl = document.getElementById('custom-popup-input');
        overlay.classList.remove('active');
        if (currentResolve) {
            const resolve = currentResolve;
            currentResolve = null;
            setTimeout(() => {
                if (currentPopupType === 'prompt' && value === true) {
                    resolve(inputEl.value);
                } else {
                    resolve(value);
                }
            }, 100);
        }
    };

    // Global exposed functions
    window.showPopup = function (message, type = 'alert', title = 'Examix') {
        if (!document.getElementById('custom-popup-overlay')) {
            injectPopup();
        }

        const overlay = document.getElementById('custom-popup-overlay');
        const titleEl = overlay.querySelector('#custom-popup-title');
        const messageEl = overlay.querySelector('#custom-popup-message');
        const inputEl = overlay.querySelector('#custom-popup-input');
        const okBtn = overlay.querySelector('#custom-popup-ok');
        const cancelBtn = overlay.querySelector('#custom-popup-cancel');

        return new Promise(resolve => {
            currentResolve = resolve;
            currentPopupType = type;
            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.style.display = (type === 'prompt') ? 'block' : 'none';
            if (type === 'prompt') {
                inputEl.value = '';
                setTimeout(() => inputEl.focus(), 150);
            } else {
                setTimeout(() => okBtn.focus(), 150);
            }

            if (type === 'alert') {
                cancelBtn.style.display = 'none';
                okBtn.textContent = 'OK';
            } else {
                cancelBtn.style.display = 'block';
                okBtn.textContent = (type === 'prompt') ? 'Submit' : 'Confirm';
                cancelBtn.textContent = 'Cancel';
            }

            overlay.classList.add('active');
        });
    };

    if (document.body) {
        injectPopup();
    } else {
        window.addEventListener('DOMContentLoaded', injectPopup);
    }

    // Replace default alert/confirm with async versions
    // Note: This won't work for synchronous code that expects blocking,
    // so we'll have to manually update the calls in other files.
    window.showToast = function (message) {
        // Just a simple alias for alert if needed
        return window.showPopup(message, 'alert');
    };
})();
