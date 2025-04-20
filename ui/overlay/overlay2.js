// overlayUI.js
// import './styles.css'

export function initOverlayUI(iina) {
  // DOM Elements
  const firstClickPositionElement = document.getElementById("firstMousePos");
  const secondClickPositionElement = document.getElementById("secondMousePos");
  const rectangleCoordinatesElement = document.getElementById("rectangleCoords");
  const normalizedRectangleCoordinatesElement = document.getElementById("normalisedRectangleCoords");
  const scaleElement = document.getElementById("scale");
  const rootElement = document.getElementById("root");
  const bodyElement = document.body;
  const timeElement = document.getElementById("time");

  timeElement.innerText = "HELLO!"

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
    updatePosition(x, y) {
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;
    }
    setBorderRadius(radius) {
      this.element.style.borderRadius = radius;
    }
  }

  const firstSquare = new Square("#DF418F");
  const secondSquare = new Square("#DF418F");

  const rectangleElement = document.createElement("div");
  rectangleElement.style.position = "absolute";
  rectangleElement.style.border = "2px solid rgba(223, 65, 143, 1)";
  bodyElement.appendChild(rectangleElement);

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

    updateBodySize(frameWidth, frameHeight);

    firstSquare.updatePosition(firstClick.x, firstClick.y);
    secondSquare.updatePosition(secondClick.x, secondClick.y);
    firstSquare.setBorderRadius("100%");

    if (secondClick.x !== 0 && secondClick.y !== 0) {
      rectangleElement.style.display = "block";
      updateRectangle(rectangleCoordinates);
    } else {
      rectangleElement.style.display = "none";
    }

    displayCoordinates(rectangleCoordinates, normalizedCoordinates);
  });

  iina.onMessage("clear-rectangle", () => {
    rectangleElement.style.display = "none";
    rectangleCoordinatesElement.innerHTML = "";
    normalizedRectangleCoordinatesElement.innerHTML = "";
    firstSquare.updatePosition(0, 0);
    secondSquare.updatePosition(0, 0);
  });

  function updateBodySize(width, height) {
    bodyElement.style.width = `${width}px`;
    bodyElement.style.height = `${height}px`;
  }

  function formatDecimals(objArray) {
    objArray.forEach(obj => {
      Object.keys(obj).forEach(key => {
        obj[key] = Number(Math.round(obj[key]));
      });
    });
  }

  function updateRectangle(coordinates) {
    rectangleElement.style.left = `${coordinates.x}px`;
    rectangleElement.style.top = `${coordinates.y}px`;
    rectangleElement.style.width = `${coordinates.width}px`;
    rectangleElement.style.height = `${coordinates.height}px`;
  }

  function displayCoordinates(rectangleCoordinates, normalizedCoordinates) {
    rectangleCoordinatesElement.innerHTML = `<p><span class="label">Crop:</span><br/>w:${rectangleCoordinates.width} h:${rectangleCoordinates.height} <br/>x:${rectangleCoordinates.x} y:${rectangleCoordinates.y}</p>`;
    normalizedRectangleCoordinatesElement.innerHTML = `<p><span class="label">Normalised crop:</span><br/>w:${normalizedCoordinates.width} h:${normalizedCoordinates.height} <br/>x:${normalizedCoordinates.x} y:${normalizedCoordinates.y}</p>`;
  }
}
