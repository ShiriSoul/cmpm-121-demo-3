import "./style.css";

// creates the starting button element
const starterButton = document.createElement("button");
starterButton.textContent = "Click Me";
starterButton.id = "starterButton";
document.body.appendChild(starterButton);

// starting button event listener to display message
starterButton.addEventListener("click", () => {
  alert("You clicked the button!");
});
