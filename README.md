# 3D Car Racing Simulator

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://kndnsow.github.io/Car_Simumator/)

A high-speed, infinite 3D racing game built with **Three.js** and the **Cannon.js** physics engine. Dodge obstacles, collect powerful upgrades, and push your car to its limits on a dynamically generated road.

## Screenshot

<img width="1919" height="962" alt="screenshot_0" src="https://github.com/user-attachments/assets/4796ed50-b18c-4867-9c99-f8e40621ebb0" />

## Live Demo

You can play the game live in your browser by clicking here:
[**Click Here**](https://kndnsow.github.io/Car_Simumator/)

---

## Features

-   **Infinite Road Generation:** The road is procedurally generated as you drive, creating a unique and endless experience every time.
-   **Physics-Based Gameplay:** Powered by Cannon.js for realistic car handling, collisions, and obstacle interactions.
-   **Dynamic Upgrade System:** Collect four types of upgrades to enhance your vehicle:
    -   🚀 **Max Speed:** Permanently increases your car's top speed.
    -   🛡️ **Resistance:** Withstands higher speed collisions before losing upgrades.
    -   🏎️ **Better Tires:** Improves turning speed for more agile handling.
    -   🛑 **Better Brakes:** Increases braking force for quicker stops.
-   **Intelligent Collision Penalties:** The number of upgrades you lose upon crashing depends on your speed at impact—a minor bump is forgiving, but a high-speed collision is devastating!
-   **Responsive Controls:**
    -   **PC:** Use `WASD` or Arrow Keys for precise control.
    -   **Mobile:** Utilizes device gyroscope for intuitive tilt-to-steer controls.
-   **Pause Menu:** Pause the game at any time by pressing `Esc` to see your current stats, resume, or return to the main menu.
-   **Detailed Game Over Screen:** Get a full breakdown of your performance, including final score, max speed reached, and total upgrades held.

---

## Controls

### 🖥️ PC Controls
-   **Accelerate:** `W` or `Up Arrow`
-   **Brake/Reverse:** `S` or `Down Arrow`
-   **Steer Left:** `A` or `Left Arrow`
-   **Steer Right:** `D` or `Right Arrow`
-   **Pause Game:** `Escape`

### 📱 Mobile Controls
-   **Steer:** Tilt your device left and right.
-   **Accelerate / Brake:** Use the on-screen touch buttons.

---

## Technology Stack

-   **Rendering Engine:** [Three.js](https://threejs.org/)
-   **Physics Engine:** [Cannon.js](https://github.com/schteppe/cannon.js)
-   **Core Logic:** JavaScript (ES6)
-   **Platform:** HTML5 Canvas & CSS3

---

## How To Run Locally

To run this project on your local machine, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kndnsow/Car_Simumator.git
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd Car_Simumator
    ```

3.  **Open `index.html`:**
    Since this project does not require a complex build setup, you can run it by opening the `index.html` file in your web browser. For best results and to avoid potential CORS issues with file loading, it is recommended to use a simple local server.

---

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.
