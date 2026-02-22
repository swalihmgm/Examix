let quizData = JSON.parse(localStorage.getItem("quizData_tfqh")) || [];
let currentQuestion = parseInt(localStorage.getItem("quiz_tfqh_current")) || 0;
let score = parseInt(localStorage.getItem("quiz_tfqh_score")) || 0;
let timeRemaining = parseInt(localStorage.getItem("quiz_tfqh_time")) || 7200;

function saveActiveState() {
  localStorage.setItem("quiz_tfqh_current", currentQuestion);
  localStorage.setItem("quiz_tfqh_score", score);
  localStorage.setItem("quiz_tfqh_time", timeRemaining);
}

function clearActiveState() {
  localStorage.removeItem("quiz_tfqh_current");
  localStorage.removeItem("quiz_tfqh_score");
  localStorage.removeItem("quiz_tfqh_time");
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function fetchQuizData() {
  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRFm4LpG9GGJNS1JMRw-sZTB4agNgBx-7RT68U2zRNE4oNgbFxxRIYk61MXYaWK6GJ1mwlisq5JZC1V/pub?output=csv";

  try {
    const response = await fetch(csvUrl);
    const csvText = await response.text();
    const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== "").map(row => {
      return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.replace(/^"|"$/g, '').trim());
    });

    quizData = rows.slice(1).map((row, idx) => {
      if (row.length < 6) return null;
      return {
        question: row[0],
        options: row.slice(1, 5),
        correct: parseInt(row[5], 10) - 1,
        explanation: row[6] || "" // Added explanation field
      };
    }).filter(q => q !== null && !isNaN(q.correct));

    document.getElementById("preloader").style.display = "none";

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'review') {
      renderReviewMode();
      return;
    }

    // Recovery Logic: Only shuffle if we aren't resuming
    if (currentQuestion === 0) {
      quizData = shuffleArray(quizData);
      localStorage.setItem("quizData_tfqh", JSON.stringify(quizData));
    }

    startTimer();
    loadQuestion();
  } catch (error) {
    console.error("Quiz Fetch Error:", error);
  }
}

function renderReviewMode() {
  const container = document.getElementById('review-container');
  const quizContainer = document.querySelector('.quiz');
  const header = document.getElementById('quiz-header');

  if (quizContainer) quizContainer.style.display = 'none';
  if (header) header.style.display = 'none';
  container.style.display = 'block';

  const content = document.getElementById('review-content');
  const repeatQuestions = JSON.parse(localStorage.getItem('tfqh_repeat_questions') || '[]');

  if (repeatQuestions.length === 0) {
    content.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No questions saved yet.</p>';
    return;
  }

  content.innerHTML = repeatQuestions.map((q, i) => `
    <div style="position:relative; padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
      <p style="font-size:18px; margin-bottom:10px; padding-left:70px;"><strong>${i + 1}.</strong> ${q.question}</p>
      <p style="color:var(--success); font-weight:700; padding-left:70px;">✓ ${q.options[q.correct]}</p>
      <button onclick="removeFromRepeatReview(${i})" style="position:absolute; top:15px; left:0; background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.3); color:#EF4444; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:700;">Remove</button>
    </div>
  `).join('');
}

async function removeFromRepeatReview(idx) {
  const ok = await showPopup("Remove this question from Repeat Session?", "confirm");
  if (!ok) return;
  let repeatQuestions = JSON.parse(localStorage.getItem('tfqh_repeat_questions') || '[]');
  repeatQuestions.splice(idx, 1);
  localStorage.setItem('tfqh_repeat_questions', JSON.stringify(repeatQuestions));

  // Cloud Sync
  const user = auth.currentUser;
  if (user) {
    db.collection('users').doc(user.uid).get().then(doc => {
      let repeatMap = {};
      if (doc.exists) repeatMap = doc.data().repeatQuestions || {};
      repeatMap['tfqh_repeat_questions'] = repeatQuestions;
      db.collection('users').doc(user.uid).update({ repeatQuestions: repeatMap });
    });
  }

  renderReviewMode();
}

function startTimer() {
  const timerElement = document.getElementById("timer");
  const timerInterval = setInterval(() => {
    timeRemaining--;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerElement.textContent = `${minutes}m ${seconds}s`;
    if (timeRemaining % 10 === 0) saveActiveState(); // Periodic save
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      showResults();
    }
  }, 1000);
}

function loadQuestion(isPrevious = false) {
  const questionElement = document.getElementById("question");
  const answerButtons = document.querySelectorAll(".answer-btn");
  const questionNumberElement = document.getElementById("question-number");

  questionElement.textContent = quizData[currentQuestion].question;
  answerButtons.forEach((button, index) => {
    button.textContent = quizData[currentQuestion].options[index];
    button.classList.remove("correct", "wrong");
    button.disabled = false;
    if (isPrevious) {
      button.disabled = true;
      if (index === quizData[currentQuestion].correct) button.classList.add("correct");
    }
  });

  questionNumberElement.textContent = `Question ${currentQuestion + 1} of ${quizData.length}`;

  // Hide explanation
  document.getElementById("explanation-container").classList.add("hidden");

  document.getElementById("prev-btn").style.display = currentQuestion > 0 ? "block" : "none";
  document.getElementById("next-btn").style.display = "none";
}

function checkAnswer(button, index) {
  const correctAnswer = quizData[currentQuestion].correct;
  const allButtons = document.querySelectorAll(".answer-btn");
  if (index === correctAnswer) {
    button.classList.add("correct");
    score++;
  } else {
    button.classList.add("wrong");
    allButtons[correctAnswer].classList.add("correct");
  }
  allButtons.forEach(btn => btn.disabled = true);

  // Show explanation
  const q = quizData[currentQuestion];
  if (q.explanation) {
    document.getElementById("explanation-text").textContent = q.explanation;
    document.getElementById("explanation-container").classList.remove("hidden");
  }

  document.getElementById("next-btn").style.display = "block";
  saveActiveState();
}

function nextQuestion() {
  currentQuestion++;
  if (currentQuestion < quizData.length) {
    saveActiveState();
    loadQuestion();
  } else {
    showResults();
  }
}

function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    loadQuestion(true);
  }
}

function addToRepeat() {
  const q = quizData[currentQuestion];
  let repeatQuestions = JSON.parse(localStorage.getItem('tfqh_repeat_questions') || '[]');
  if (!repeatQuestions.some(item => item.question === q.question)) {
    repeatQuestions.push({
      question: q.question,
      options: q.options,
      correct: q.correct
    });
    localStorage.setItem('tfqh_repeat_questions', JSON.stringify(repeatQuestions));

    // Cloud Sync
    const user = auth.currentUser;
    if (user) {
      db.collection('users').doc(user.uid).get().then(doc => {
        let repeatMap = {};
        if (doc.exists) repeatMap = doc.data().repeatQuestions || {};
        repeatMap['tfqh_repeat_questions'] = repeatQuestions;
        db.collection('users').doc(user.uid).update({ repeatQuestions: repeatMap });
      });
    }

    const btn = document.getElementById('repeat-btn');
    btn.textContent = "✅ Added";
    btn.style.background = "var(--success)";
    btn.style.color = "white";
    setTimeout(() => {
      btn.textContent = "🔁 Add to Repeat";
      btn.style.background = "rgba(139, 92, 246, 0.1)";
      btn.style.color = "var(--primary)";
    }, 1000);
  } else {
    showPopup("Already added to repeat session.");
  }
}

function showResults() {
  document.getElementById("quiz-container").style.display = "none";
  document.getElementById("result-container").style.display = "block";
  const totalQuestions = quizData.length;
  document.getElementById("score").textContent = `You scored ${score} out of ${totalQuestions}`;

  const restartBtn = document.createElement("button");
  restartBtn.textContent = "Menu";
  restartBtn.onclick = () => { window.location.href = "index.html"; };
  document.getElementById("result-container").appendChild(restartBtn);

  clearActiveState();

  try {
    const user = auth.currentUser;
    if (user) {
      const progressKey = 'tfqh_highscore';
      db.collection('users').doc(user.uid).get().then(doc => {
        let progress = {};
        if (doc.exists) progress = doc.data().progress || {};
        const existing = progress[progressKey] || { highscore: 0, total: totalQuestions };
        if (score >= existing.highscore) {
          progress[progressKey] = { highscore: score, total: totalQuestions };
          db.collection('users').doc(user.uid).update({ progress });
        }
      });
    }
  } catch (e) { console.error(e); }
}

window.onload = fetchQuizData;
