let quizData = JSON.parse(localStorage.getItem("quizData")) || [];
let currentQuestion = 0;
let score = 0;  // Initialize score
let timeRemaining = 7200; // 1 hour in seconds (3600 seconds)

// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Random index between 0 and i
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

// Fetch quiz data from the published CSV link
async function fetchQuizData() {
  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRFm4LpG9GGJNS1JMRw-sZTB4agNgBx-7RT68U2zRNE4oNgbFxxRIYk61MXYaWK6GJ1mwlisq5JZC1V/pub?output=csv";

  if (window.location.protocol === 'file:') {
    console.warn("Hint: You are running this via file://. Remote fetching may be blocked by your browser's security (CORS) policy. Consider using a local server (like VS Code Live Server).");
  }

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();
    
    // Improved CSV parsing to handle common spreadsheet edge cases
    const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== "").map(row => {
      // Simple regex to split by comma but ignore commas inside quotes if they exist
      return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.replace(/^"|"$/g, '').trim());
    });

    if (rows.length < 2) throw new Error("CSV file appeared empty or invalid.");

    quizData = rows.slice(1).map((row, idx) => {
      if (row.length < 6) {
        console.warn(`Row ${idx + 2} is missing columns:`, row);
        return null;
      }
      return {
        question: row[0],
        options: row.slice(1, 5),
        correct: parseInt(row[5], 10) - 1
      };
    }).filter(q => q !== null && !isNaN(q.correct));

    if (quizData.length === 0) throw new Error("No valid questions parsed from CSV.");

    document.getElementById("preloader").style.display = "none";
    quizData = shuffleArray(quizData);
    localStorage.setItem("quizData_tfqh", JSON.stringify(quizData));
    startTimer();
    loadQuestion();
  } catch (error) {
    console.error("Quiz Fetch Error:", error);
    const preloaderText = document.querySelector("#preloader p");
    if (preloaderText) preloaderText.innerHTML = `<span style="color: #ef4444">Error: ${error.message}</span><br><small>Check console for details or ensure you're using a local server.</small>`;
    alert("Failed to load quiz data. This usually happens when opening the file directly (file://) instead of using a server, or if the CSV link is unreachable.");
  }
}

// Timer function for a 1-hour quiz
function startTimer() {
  const timerElement = document.getElementById("timer");

  const timerInterval = setInterval(() => {
    timeRemaining--;

    // Convert seconds into minutes and seconds for display
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerElement.textContent = `${minutes}m ${seconds}s`;

    if (timeRemaining <= 0) {
      clearInterval(timerInterval); // Stop the timer
      endQuiz(); // End the quiz when time runs out
    }
  }, 1000); // Update every second
}

// End the quiz when time runs out
function endQuiz() {
  alert("Time is up! Submitting your quiz.");
  showResults(); // Show the results when time runs out
}

// Load the current question
function loadQuestion(isPrevious = false) {
  if (quizData.length === 0) {
    alert("No questions found. Please add questions first!");
    window.location.href = "form.html"; // Optional: redirect if no questions
    return;
  }

  const questionElement = document.getElementById("question");
  const answerButtons = document.querySelectorAll(".answer-btn");
  const questionNumberElement = document.getElementById("question-number"); // Get question number element


  questionElement.textContent = quizData[currentQuestion].question;
  answerButtons.forEach((button, index) => {
    button.textContent = quizData[currentQuestion].options[index];
    button.classList.remove("correct", "wrong");
    button.disabled = false;

    // If viewing a previous question, disable the buttons to prevent changes
    if (isPrevious) {
      button.disabled = true;

      // Highlight the selected answer
      if (index === quizData[currentQuestion].correct) {
        button.classList.add("correct");
      } else {
        button.classList.add("wrong");
      }
    }
  });

  questionNumberElement.textContent = `Question ${currentQuestion + 1} of ${quizData.length}`;

  // Show or hide the Previous button based on the current question
  document.getElementById("prev-btn").style.display = currentQuestion > 0 ? "block" : "none";
  document.getElementById("next-btn").style.display = "none";
}

// Check the user's answer
function checkAnswer(button, index) {
  const correctAnswer = quizData[currentQuestion].correct;
  const allButtons = document.querySelectorAll(".answer-btn");

  console.log(`User selected: ${index}, Correct answer: ${correctAnswer}`); // Debug log

  if (index === correctAnswer) {
    button.classList.add("correct");
    score++;  // Increment score for correct answer
  } else {
    button.classList.add("wrong");
    allButtons[correctAnswer].classList.add("correct");
  }

  allButtons.forEach(btn => btn.disabled = true);
  document.getElementById("next-btn").style.display = "block";
}

// Go to the next question
function nextQuestion() {
  currentQuestion++;

  if (currentQuestion < quizData.length) {
    loadQuestion();
  } else {
    showResults();
  }
}

// Function to go back to the previous question
function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--; // Go to the previous question
    loadQuestion(true); // Pass 'true' to indicate viewing the previous question
  }

  // Hide 'Previous' button on the first question
  if (currentQuestion === 0) {
    document.getElementById("prev-btn").style.display = "none";
  }

  // Ensure the 'Next' button is visible
  document.getElementById("next-btn").style.display = "block";
}

// Show results at the end of the quiz
function showResults() {
  document.getElementById("quiz-container").style.display = "none";
  document.getElementById("result-container").style.display = "block";

  const totalQuestions = quizData.length;
  const scoreElement = document.getElementById("score");
  scoreElement.textContent = `You scored ${score} out of ${totalQuestions}`;

  // Create a restart button
  const restartBtn = document.createElement("button");
  restartBtn.textContent = "Menu";
  restartBtn.onclick = () => {
    window.location.href = "index.html"; // Redirect to menu page or home page
  };
  
  document.getElementById("result-container").appendChild(restartBtn);
}

// Call fetchQuizData on window load to retrieve questions
window.onload = fetchQuizData;
