# 💻 Smash Keys

<div align="center">
  <h3>A futuristic, real-time multiplayer typing arena.</h3>
  <p>Race head-to-head against friends, track your stats, climb the global leaderboard, and level up your typing speed.</p>
</div>

---

## 🚀 Features

* **🏎️ Real-Time Multiplayer Racing**: Create private rooms via 6-character room codes and race against friends in real-time. Live opponent progress is visualized via racing tracks.
* **⌨️ Dynamic Typing Engine**: Multiple modes including Time constraints (15s, 30s, 60s), Word constraints, Code snippets, and Custom text.
* **📈 In-Depth Analytics**: Post-race performance metrics including WPM (Words Per Minute), raw speed, accuracy, consistency, and visual keystroke heatmaps to identify weak keys.
* **🎮 Gamification & Progression**: Gain XP, level up, maintain daily streaks, and unlock achievements as you improve.
* **🎨 Highly Customizable**: Tailor your experience with multiple syntax-highlighted themes (Nord, Dracula, Carbon, Matrix), caret styles, typography options, and mechanical keyboard sound effects.
* **🏆 Global Leaderboards**: Compete against top typists worldwide and claim your spot on the leaderboards.

## 🛠️ Tech Stack

Smash Keys is built with a lightweight, high-performance stack:

* **Frontend**: Vanilla HTML5, CSS3 (Custom Variables, Flexbox/Grid, Glassmorphism), Vanilla JavaScript (ES6 Modules)
* **Backend**: Node.js, Express.js
* **Real-Time Communication**: WebSockets (`ws`)
* **Database**: MongoDB (Mongoose)
* **Authentication**: JWT (JSON Web Tokens) & bcryptjs

## ⚙️ Local Development Setup

To run Smash Keys locally on your machine, follow these steps:

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* A [MongoDB](https://www.mongodb.com/) instance (local or Atlas)

### 1. Clone the repository
```bash
git clone https://github.com/vanshmehandru/smashkeys.git
cd smashkeys
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (you can copy `.env.example`):
```bash
cp .env.example .env
```
Ensure your `.env` contains the following:
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/smashkeys
JWT_SECRET=your_super_secret_jwt_key_here
```

### 4. Start the Server
Run the local development server:
```bash
npm start
```
The application will be running at `http://localhost:3000`.

## 🌐 Deployment

Smash Keys is configured for easy deployment on platforms like Render or Railway. 

1. Push your code to GitHub.
2. Connect your GitHub repository to Render as a **Web Service**.
3. Set your Build Command to `npm install` and Start Command to `npm start`.
4. Add your `MONGODB_URI` and `JWT_SECRET` as Environment Variables in the Render dashboard.

## 📄 License
This project is licensed under the MIT License.
