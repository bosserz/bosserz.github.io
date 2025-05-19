let secretNumber = Math.floor(Math.random() * 100) + 1;
const submitGuess = document.getElementById('submitGuess');
const restartGame = document.getElementById('restartGame');
const guessInput = document.getElementById('guessInput');
const message = document.getElementById('message');

submitGuess.addEventListener('click', () => {
  const guess = parseInt(guessInput.value);

  if (isNaN(guess) || guess < 1 || guess > 100) {
    message.textContent = "Please enter a valid number between 1 and 100.";
    return;
  }

  if (guess === secretNumber) {
    message.textContent = `🎉 Correct! The number was ${secretNumber}.`;
    message.style.color = 'green';
    guessInput.disabled = true;
    submitGuess.disabled = true;
  } else if (guess < secretNumber) {
    message.textContent = "Too low. Try again.";
    message.style.color = 'red';
  } else {
    message.textContent = "Too high. Try again.";
    message.style.color = 'red';
  }

  guessInput.value = '';
});

restartGame.addEventListener('click', () => {
  secretNumber = Math.floor(Math.random() * 100) + 1;
  message.textContent = '';
  guessInput.value = '';
  guessInput.disabled = false;
  submitGuess.disabled = false;
});
