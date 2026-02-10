let quizData = JSON.parse(localStorage.getItem("quizData_meter")) || [];
let currentQuestion = parseInt(localStorage.getItem("quiz_meter_current")) || 0;
let score = parseInt(localStorage.getItem("quiz_meter_score")) || 0;
let timeRemaining = parseInt(localStorage.getItem("quiz_meter_time")) || 3600;

function saveActiveState() {
  localStorage.setItem("quiz_meter_current", currentQuestion);
  localStorage.setItem("quiz_meter_score", score);
  localStorage.setItem("quiz_meter_time", timeRemaining);
}

function clearActiveState() {
  localStorage.removeItem("quiz_meter_current");
  localStorage.removeItem("quiz_meter_score");
  localStorage.removeItem("quiz_meter_time");
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function fetchQuizData() {
  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaajKOiG4ebCh0NkZEeugD6F9xj8WDpBOV3Ow3v01HxGYWDf3u8uWxaLOCvX2Izw4wDPeIi0I8evKw/pub?output=csv";

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
        correct: parseInt(row[5], 10) - 1
      };
    }).filter(q => q !== null && !isNaN(q.correct));

    document.getElementById("preloader").style.display = "none";

    if (currentQuestion === 0) {
      quizData = shuffleArray(quizData);
      localStorage.setItem("quizData_meter", JSON.stringify(quizData));
    }

    startTimer();
    loadQuestion();
  } catch (error) {
    console.error("Quiz Fetch Error:", error);
  }
}

function startTimer() {
  const timerElement = document.getElementById("timer");
  const timerInterval = setInterval(() => {
    timeRemaining--;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerElement.textContent = `${minutes}m ${seconds}s`;
    if (timeRemaining % 10 === 0) saveActiveState();
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
      const progressKey = 'meter_highscore';
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
