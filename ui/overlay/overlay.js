// DOM Elements
const firstClickPositionElement = document.getElementById("firstMousePos");
const secondClickPositionElement = document.getElementById("secondMousePos");
const rectangleCoordinatesElement = document.getElementById("rectangleCoords");
const normalizedRectangleCoordinatesElement = document.getElementById("normalisedRectangleCoords");
const scaleElement = document.getElementById("scale");
const rootElement = document.getElementById("root");
const bodyElement = document.body; // Reference to the body element
// bodyElement.style.backgroundColor = "rgba(255, 0, 0, 0.4)";
const timeElement = document.getElementById("time");

timeElement.innerText = "HELLO!"
// Square Class to represent click markers
class Square {
  constructor(color, size = 5) {
    this.element = document.createElement("div");
    this.element.style.position = "absolute";
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.backgroundColor = color;
    this.element.style.transform = "translate(-50%, -50%)";
    bodyElement.appendChild(this.element);
  }

  // Update the position of the square
  updatePosition(x, y) {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  // Add optional styles (e.g., borderRadius)
  setBorderRadius(radius) {
    this.element.style.borderRadius = radius;
  }
}

// Create squares for the first and second clicks
const firstSquare = new Square("#DF418F");
const secondSquare = new Square("#DF418F");

// Create a rectangle to highlight the area between the two clicks
const rectangleElement = document.createElement("div");
rectangleElement.style.position = "absolute";
rectangleElement.style.border = "2px solid rgba(223, 65, 143, 1)";

bodyElement.appendChild(rectangleElement);

// Handle updates from IINA
iina.onMessage("update", ({
                            dimensions,
                            windowSize,
                            firstClick,
                            secondClick,
                            rectangleCoordinates,
                            normalizedCoordinates,
                            isHidden,
                          }) => {
  const { videoWidth, videoHeight } = dimensions;
  const { width: frameWidth, height: frameHeight } = windowSize;

  formatDecimals([firstClick, secondClick, rectangleCoordinates, normalizedCoordinates]);

  // Update displayed information
  document.getElementById("dimensions").innerText = `${videoWidth}x${videoHeight}`;
  document.getElementById("windowSize").innerText = `${frameWidth}x${frameHeight}`;

  if (isHidden) {
    rootElement.classList.add("hidden");
  } else {
    rootElement.classList.remove("hidden");
  }

  firstClickPositionElement.innerText = `x: ${firstClick.x}, y: ${firstClick.y}`;
  secondClickPositionElement.innerText = `x: ${secondClick.x}, y: ${secondClick.y}`;

  const scale = videoWidth / frameWidth;
  scaleElement.innerText = `${scale.toFixed(2)}`;

  // Update body size to match the window
  updateBodySize(frameWidth, frameHeight);

  // Update square positions
  firstSquare.updatePosition(firstClick.x, firstClick.y);
  secondSquare.updatePosition(secondClick.x, secondClick.y);
  firstSquare.setBorderRadius("100%");

  // Update rectangle and coordinates
  if (secondClick.x !== 0 && secondClick.y !== 0) {
    // Re-enable the rectangle if new click positions are detected
    rectangleElement.style.display = "block";
    updateRectangle(rectangleCoordinates);
  } else {
    // Hide the rectangle if no valid crop area is selected
    rectangleElement.style.display = "none";
  }

  // Display coordinates
  displayCoordinates(rectangleCoordinates, normalizedCoordinates);
});

// Handle the "clear-rectangle" message
iina.onMessage("clear-rectangle", () => {
  // Hide the rectangle
  rectangleElement.style.display = "none";

  // Clear the displayed coordinates
  rectangleCoordinatesElement.innerHTML = "";
  normalizedRectangleCoordinatesElement.innerHTML = "";

  // Reset the square positions (optional)
  firstSquare.updatePosition(0, 0);
  secondSquare.updatePosition(0, 0);
});

// Update the body size to match the window
function updateBodySize(width, height) {
  bodyElement.style.width = `${width}px`;
  bodyElement.style.height = `${height}px`;
}

function formatDecimals(objArray) {
  objArray.forEach(obj => {

    Object.keys(obj).forEach(key => {
      obj[key] = Number(Math.round(obj[key]));
    });

  })

}

// Update the rectangle element's position and size
function updateRectangle(coordinates) {
  rectangleElement.style.left = `${coordinates.x}px`;
  rectangleElement.style.top = `${coordinates.y}px`;
  rectangleElement.style.width = `${coordinates.width}px`;
  rectangleElement.style.height = `${coordinates.height}px`;
}


// Display the rectangle and normalized coordinates
function displayCoordinates(rectangleCoordinates, normalizedCoordinates) {
  rectangleCoordinatesElement.innerHTML = `<p><span class="label">Crop:</span><br/>w:${rectangleCoordinates.width} h:${rectangleCoordinates.height} <br/>x:${rectangleCoordinates.x} y:${rectangleCoordinates.y}</p>`;
  normalizedRectangleCoordinatesElement.innerHTML = `<p><span class="label">Normalised crop:</span><br/>w:${normalizedCoordinates.width} h:${normalizedCoordinates.height} <br/>x:${normalizedCoordinates.x} y:${normalizedCoordinates.y}</p>`;
}
