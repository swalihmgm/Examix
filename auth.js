const firebaseConfig = {
    apiKey: "AIzaSyD20UgZpLxDtMWlQQmNchkCSesPZ0r4QCc",
    authDomain: "examix-platform.firebaseapp.com",
    projectId: "examix-platform",
    storageBucket: "examix-platform.firebasestorage.app",
    messagingSenderId: "1087192326321",
    appId: "1:1087192326321:web:f53eb91b99bfe1620f0290"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Persistent Session (30 days)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Elements
const errorMsg = document.getElementById('error-msg');

function showError(text) {
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

            // Save profile metadata to Firestore
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                enrolledCourses: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                progress: {}
            });

            // Send Verification Email
            await user.sendEmailVerification();
            alert("Verification email sent! Please check your inbox and verify your email to access all features.");

            // Save local copy for fast access
            localStorage.setItem('examix_user', JSON.stringify({ name, email, enrolledCourses: [] }));
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
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Fetch user metadata
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                localStorage.setItem('examix_user', JSON.stringify(doc.data()));
                handleAuthRedirect();
            }
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
let isSigningIn = false;
window.signInWithGoogle = async () => {
    if (isSigningIn) return;
    isSigningIn = true;

    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        // Check if user profile exists in Firestore
        let doc = await db.collection('users').doc(user.uid).get();

        if (!doc.exists) {
            const defaultProfile = {
                name: user.displayName,
                email: user.email,
                enrolledCourses: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                progress: {}
            };
            await db.collection('users').doc(user.uid).set(defaultProfile);
            doc = { data: () => defaultProfile };
        }

        localStorage.setItem('examix_user', JSON.stringify(doc.data()));
        handleAuthRedirect();
    } catch (error) {
        showError(error.message);
    } finally {
        isSigningIn = false;
    }
};

// Forgot Password
window.forgotPassword = async () => {
    const email = prompt("Please enter your email address for the reset link:");
    if (!email) return;
    try {
        await auth.sendPasswordResetEmail(email);
        alert("Reset link sent! Please check your inbox.");
    } catch (error) {
        alert(error.message);
    }
};

// Global Logout Helper 
window.logout = async () => {
    try {
        await auth.signOut();
        localStorage.removeItem('examix_user');

        // Determine the redirect path correctly regardless of where we are
        const isSubDir = window.location.pathname.includes('/pg/');
        const redirectPath = isSubDir ? '../landing.html' : 'landing.html';

        window.location.href = redirectPath;
    } catch (error) {
        console.error("Logout failed", error);
    }
};
