const firebaseConfig = {
    apiKey: "AIzaSyD20UgZpLxDtMWlQQmNchkCSesPZ0r4QCc",
    authDomain: "examix-platform.firebaseapp.com",
    projectId: "examix-platform",
    storageBucket: "examix-platform.firebasestorage.app",
    messagingSenderId: "1087192326321",
    appId: "1:1087192326321:web:f53eb91b99bfe1620f0290"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Persistent Session (30 days)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Elements
const errorMsg = document.getElementById('error-msg');
let isSigningIn = false;

function showError(text) {
    if (!errorMsg) {
        console.error(text);
        return;
    }
    if (text.includes('auth/cancelled-popup-request')) {
        console.warn('Popup request cancelled - likely a duplicate click.');
        return;
    }
    errorMsg.textContent = text;
    errorMsg.classList.remove('hidden');
    setTimeout(() => errorMsg.classList.add('hidden'), 5000);
}

function handleAuthRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectCourse = urlParams.get('redirect');
    if (redirectCourse) {
        // Redirect to purchase page after auth
        window.location.href = 'purchase.html?course=' + redirectCourse;
    } else {
        window.location.href = 'index.html';
    }
}

// Global Auth State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in, fetch latest data from Firestore
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                const userData = doc.data();
                localStorage.setItem('examix_user', JSON.stringify(userData));

                // Sync Repeat Questions from Cloud to Local
                if (userData.repeatQuestions) {
                    Object.keys(userData.repeatQuestions).forEach(key => {
                        localStorage.setItem(key, JSON.stringify(userData.repeatQuestions[key]));
                    });
                }
            } else {
                // If doc doesn't exist, create it (e.g. first time login)
                const defaultProfile = {
                    name: user.displayName || 'Learner',
                    email: user.email,
                    enrolledCourses: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    progress: {}
                };
                await db.collection('users').doc(user.uid).set(defaultProfile);
                localStorage.setItem('examix_user', JSON.stringify(defaultProfile));
            }

            // If we are on landing or auth page, go to index
            if (window.location.pathname.includes('landing.html') || window.location.pathname.includes('auth.html')) {
                handleAuthRedirect();
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    } else {
        // User is signed out
        localStorage.removeItem('examix_user');
        // If we are on a protected page, redirect to landing
        const protectedPages = ['index.html', 'quiz.html', 'purchase.html', 'jlt.html', 'adb.html', 'tfqh.html'];
        const isProtected = protectedPages.some(page => window.location.pathname.includes(page));
        if (isProtected) {
            const isSubDir = window.location.pathname.includes('/pg/');
            window.location.href = isSubDir ? '../landing.html' : 'landing.html';
        }
    }
});

// Signup Logic
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSigningIn) return;
        isSigningIn = true;
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Creating Account...";
        submitBtn.disabled = true;

        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update display name
            await user.updateProfile({ displayName: name });

            // Profile creation is handled by onAuthStateChanged listener
            
            // Send Verification Email
            await user.sendEmailVerification();
            await showPopup("Account created! A verification email has been sent. Please verify your email to unlock all features.");

            handleAuthRedirect();
        } catch (error) {
            showError(error.message);
        } finally {
            isSigningIn = false;
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Login Logic
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSigningIn) return;
        isSigningIn = true;
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Signing In...";
        submitBtn.disabled = true;

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // Redirection is handled by onAuthStateChanged
        } catch (error) {
            showError(error.message);
        } finally {
            isSigningIn = false;
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Google Sign-In Logic
window.signInWithGoogle = async () => {
    if (isSigningIn) return;
    isSigningIn = true;

    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        // data fetching and redirection is handled by onAuthStateChanged
    } catch (error) {
        showError(error.message);
    } finally {
        isSigningIn = false;
    }
};

// Forgot Password
window.forgotPassword = async () => {
    const email = await showPopup("Please enter your email address for the reset link:", "prompt");
    if (!email) return;
    try {
        await auth.sendPasswordResetEmail(email);
        await showPopup("Reset link sent! Please check your inbox.");
    } catch (error) {
        await showPopup(error.message);
    }
};

// Global Logout Helper 
window.logout = async () => {
    try {
        await auth.signOut();
        localStorage.removeItem('examix_user');

        // Clear all session specific data
        Object.keys(localStorage).forEach(key => {
            if (key.includes('_repeat_questions') || key.startsWith('quiz_') || key.startsWith('quizData_')) {
                localStorage.removeItem(key);
            }
        });

        // Redirect is handled by onAuthStateChanged
    } catch (error) {
        console.error("Logout failed", error);
    }
};
